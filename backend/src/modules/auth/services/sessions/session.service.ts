import type { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { AuthSessionRepository } from '../../repositories/session.repository';
import { env } from '../../../../config/env';
import { logger } from '../../../../config/logger';
import { HttpError } from '../../../../middlewares/error.middleware';
import {
  assertLoginFailureLimit,
  authLimiterSchoolScope,
  AUTH_RATE_LIMIT_MESSAGE,
  consumeMfaChallengeLimit,
  recordLoginFailure,
  resetLoginFailureCounter,
} from '../../../../middlewares/rate-limit.middleware';
import {
  createRefreshSession,
  getCookieValue,
  revokeRefreshSession,
  rotateRefreshSession,
  validateRefreshSession,
} from '../../../../services/refreshSession.service';
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_PUBLIC_RESPONSE,
  PASSWORD_RESET_SUCCESS_RESPONSE,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../../../../services/passwordReset.service';
import {
  createLoginMfaChallenge,
  MFA_VERIFICATION_ERROR_MESSAGE,
  MfaVerificationError,
  isLoginMfaRequired,
  resendLoginMfaOtp,
  verifyLoginMfaChallenge,
} from '../../../../services/mfa.service';
import {
  createTotpLoginChallenge,
  disableTotp as disableTotpService,
  startTotpSetup as startTotpSetupService,
  TotpVerificationError,
  verifyTotpLoginChallenge,
  verifyTotpSetup as verifyTotpSetupService,
} from '../../../../services/totp.service';
import { isAuthenticatorAppVerificationEnabled } from '../../../../services/authSecurity.service';
import { buildAuthAuditMetadata, createAuthAuditLog, maskEmailForAudit } from '../../../../utils/audit';
import { AuthorizationService } from '../../../../services/authorization.service';
import { hashPassword, verifyPassword } from '../../../../utils/password';
import { schoolIdentifierWhere } from '../../../../utils/schoolDomain';
import { hashToken } from '../../../../utils/token';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resendTwoFactorSchema,
  resetPasswordSchema,
  totpDisableSchema,
  totpVerifyLoginSchema,
  totpVerifySetupSchema,
  verifyTwoFactorSchema,
  type LoginType,
} from '../../../../validations/auth.validation';

const GENERIC_LOGIN_ERROR = 'Invalid login details. Please try again.';
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jwtSecret: Secret = env.JWT_SECRET;

export type AuthTokenPayload = {
  sub: string;
  schoolId: string | null;
  role: string | null;
  email?: string | null;
  subscriptionRestricted?: boolean;
  impersonatedByUserId?: string | null;
  impersonatedByRole?: string | null;
  impersonatedByEmail?: string | null;
  jti?: string;
  typ: 'access' | 'refresh';
};

const signToken = (payload: AuthTokenPayload, expiresIn: SignOptions['expiresIn']) =>
  jwt.sign(payload, jwtSecret, { expiresIn });

const refreshCookieOptions = (maxAgeSeconds: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeSeconds * 1000,
});

const clearCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};

const clearAuthCookies = (res: Response) => {
  for (const name of ['access_token', 'refresh_token', 'accessToken', 'refreshToken']) {
    res.clearCookie(name, clearCookieOptions);
  }
};

const shouldReturnTokensInBody = (req: Request) => req.header('x-client-platform') === 'school-mobile';

const getSchoolAccessState = async (schoolId: string): Promise<'ACTIVE' | 'PAYMENT_RESTRICTED' | 'SUSPENDED'> => {
  const school = await AuthSessionRepository.school.findUnique({
    where: { id: schoolId },
    select: { id: true, status: true, statusReason: true },
  });
  if (!school) {
    throw new HttpError(403, 'School is suspended');
  }
  if (school.status === 'ACTIVE') return 'ACTIVE';

  const reason = (school.statusReason ?? '').toLowerCase();
  if (reason.includes('payment') || reason.includes('subscription') || reason.includes('overdue')) {
    return 'PAYMENT_RESTRICTED';
  }

  return 'SUSPENDED';
};

const ensureTeacherActive = async (userId: string, schoolId: string | null) => {
  const profile = await AuthSessionRepository.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await AuthSessionRepository.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await AuthSessionRepository.studentParent.findMany({
    where: { parentId: { in: parentIds } },
    select: { student: { select: { school: { select: { id: true, status: true } } } } },
  });
  const hasActiveSchool = links.some((link) => link.student.school?.status === 'ACTIVE');
  if (!hasActiveSchool) {
    throw new HttpError(403, 'Parent is inactive');
  }
};

const rejectLogin = (reason: string, meta?: Record<string, unknown>): never => {
  logger.warn({ reason, ...meta }, 'login rejected');
  throw new HttpError(401, GENERIC_LOGIN_ERROR);
};

const expectedRolesByLoginType: Record<LoginType, string[]> = {
  admin: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  staff: ['ACCOUNTANT', 'LIBRARIAN', 'STAFF'],
  teacher: ['TEACHER'],
  parent: ['PARENT'],
  student: [],
};

const isRoleAllowedForLoginType = (loginType: LoginType | undefined, roleName: string | null) => {
  if (!loginType) return true;
  const expectedRoles = expectedRolesByLoginType[loginType] ?? [];
  return expectedRoles.length > 0 && Boolean(roleName) && expectedRoles.includes(roleName);
};

const displayNameFromUser = (user: {
  email: string;
  teacherProfile?: { firstName: string; lastName: string } | null;
  parentProfiles?: Array<{ firstName: string; lastName: string }>;
}) => {
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : '';
  const parent = user.parentProfiles?.[0];
  const parentName = parent ? `${parent.firstName} ${parent.lastName}`.trim() : '';
  return teacherName || parentName || user.email;
};

const resolveLoginSchoolId = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await AuthSessionRepository.school.findFirst({
    where: schoolId ? { id: schoolId } : schoolIdentifierWhere(schoolCode),
    select: { id: true },
  });

  if (!school) {
    rejectLogin('school_not_found_or_mismatch', { schoolId: schoolId ?? null, schoolCode: schoolCode ?? null });
  }

  return school.id;
};

const resolveLoginSchoolIdSilently = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await AuthSessionRepository.school.findFirst({
    where: schoolId ? { id: schoolId } : schoolIdentifierWhere(schoolCode),
    select: { id: true },
  });

  return school?.id ?? null;
};

const logAuthAuditForIdentifier = async (params: {
  req?: Request;
  identifier: string;
  schoolId: string | null;
  action: 'LOGIN_FAILED' | 'RATE_LIMIT_TRIGGERED';
  afterState?: Record<string, unknown>;
}) => {
  const user = await AuthSessionRepository.user.findFirst({
    where: {
      email: { equals: params.identifier, mode: 'insensitive' },
      schoolId: params.schoolId,
    },
    select: { id: true, schoolId: true },
  });

  if (!user) {
    logger.warn(
      buildAuthAuditMetadata(params.req, {
        action: params.action,
        identifier: maskEmailForAudit(params.identifier),
        schoolId: params.schoolId,
        skippedReason: 'audit_actor_unknown',
        ...(params.afterState ?? {}),
      }),
      'auth audit skipped because actor is unknown',
    );
    return;
  }
  await logAuthAudit({
    req: params.req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    action: params.action,
    afterState: params.afterState,
  });
};

const logAuthAudit = async (params: {
  req?: Request;
  userId: string;
  schoolId: string | null;
  entityId?: string;
  action:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'MFA_CHALLENGE_CREATED'
    | 'MFA_OTP_RESENT'
    | 'MFA_VERIFIED'
    | 'MFA_FAILED'
    | 'LOGOUT'
    | 'RATE_LIMIT_TRIGGERED'
    | 'PASSWORD_CHANGE_SUCCESS'
    | 'REFRESH_TOKEN_USED'
    | 'REFRESH_TOKEN_REVOKED'
    | 'LOGOUT_ALL';
  afterState?: Record<string, unknown>;
}) => {
  try {
    await createAuthAuditLog({
      req: params.req,
      schoolId: params.schoolId,
      userId: params.userId,
      entityId: params.entityId ?? params.userId,
      action: params.action,
      metadata: params.afterState ?? {},
    });
  } catch {
    // Authentication must still follow the primary result if audit logging is unavailable.
  }
};

const maskIpAddress = (ipAddress?: string | null) => {
  if (!ipAddress) return null;
  const compactIp = ipAddress.replace(/^::ffff:/, '');
  const ipv4Parts = compactIp.split('.');
  if (ipv4Parts.length === 4) {
    return `${ipv4Parts.slice(0, 3).join('.')}.x`;
  }
  const ipv6Parts = compactIp.split(':').filter(Boolean);
  if (ipv6Parts.length > 2) {
    return `${ipv6Parts.slice(0, 2).join(':')}:****`;
  }
  return compactIp;
};

const currentRefreshTokenHashFromRequest = (req: Request) => {
  const token = getCookieValue(req, 'refresh_token') ?? getCookieValue(req, 'refreshToken');
  return token ? hashToken(token) : null;
};


export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: bodyToken } = refreshSchema.parse(req.body ?? {});
  const token = getCookieValue(req, 'refresh_token') ?? getCookieValue(req, 'refreshToken') ?? bodyToken;
  if (!token) {
    throw new HttpError(401, 'Missing refresh token');
  }

  let decoded: JwtPayload | AuthTokenPayload;
  try {
    decoded = jwt.verify(token, jwtSecret) as JwtPayload | AuthTokenPayload;
  } catch {
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (typeof decoded === 'string' || decoded.typ !== 'refresh' || !decoded.sub) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const session = await validateRefreshSession({
    refreshToken: token,
    userId: decoded.sub,
    schoolId: decoded.schoolId ?? null,
  });

  const user = await AuthSessionRepository.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, schoolId: true, status: true, email: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  if (schoolAccessState === 'SUSPENDED') throw new HttpError(403, 'School is suspended');

  const roleRow = await AuthSessionRepository.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });

  const roleName = roleRow?.role.name ?? null;
  if (roleName === 'TEACHER') {
    await ensureTeacherActive(user.id, user.schoolId ?? null);
  }
  if (roleName === 'PARENT') {
    await ensureParentActive(user.id);
  }

  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleName,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
    impersonatedByUserId: decoded.impersonatedByUserId ?? null,
    impersonatedByRole: decoded.impersonatedByRole ?? null,
    impersonatedByEmail: decoded.impersonatedByEmail ?? null,
  };

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshTokenMaxAge = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  const nextRefreshToken = signToken(
    { ...payloadBase, jti: crypto.randomUUID(), typ: 'refresh' },
    refreshTokenMaxAge,
  );

  await rotateRefreshSession({
    req,
    previousSessionId: session.id,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    refreshToken: nextRefreshToken,
    expiresAt: session.expiresAt,
  });

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: session.id,
    action: 'REFRESH_TOKEN_USED',
    afterState: {
      rotated: true,
      role: roleName,
      expiresAt: session.expiresAt.toISOString(),
    },
  });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS * 1000,
  });
  res.cookie('refresh_token', nextRefreshToken, refreshCookieOptions(refreshTokenMaxAge));

  res.status(200).json({
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    refreshTokenMaxAge,
    refreshTokenExpiresAt: session.expiresAt.toISOString(),
    ...(shouldReturnTokensInBody(req) ? { accessToken, refreshToken: nextRefreshToken } : {}),
  });
};

export const logout = async (req: Request, res: Response) => {
  const token = getCookieValue(req, 'refresh_token') ?? getCookieValue(req, 'refreshToken');
  if (token) {
    const session = await revokeRefreshSession(token);
    if (session) {
      await logAuthAudit({
        req,
        userId: session.userId,
        schoolId: session.schoolId ?? null,
        entityId: session.id,
        action: 'LOGOUT',
        afterState: { revoked: true },
      });
      await logAuthAudit({
        req,
        userId: session.userId,
        schoolId: session.schoolId ?? null,
        entityId: session.id,
        action: 'REFRESH_TOKEN_REVOKED',
        afterState: { source: 'logout', revoked: true },
      });
    }
  }

  clearAuthCookies(res);

  res.status(200).json({ success: true });
};

export const listSessions = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const currentTokenHash = currentRefreshTokenHashFromRequest(req);
  const now = new Date();
  const sessions = await AuthSessionRepository.refreshSession.findMany({
    where: {
      userId: req.auth.userId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      tokenHash: true,
      deviceName: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  res.status(200).json({
    sessions: sessions.map(({ tokenHash, ipAddress, ...session }) => ({
      ...session,
      ipAddress: maskIpAddress(ipAddress),
      currentSession: Boolean(currentTokenHash && tokenHash === currentTokenHash),
    })),
  });
};

export const revokeSession = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const sessionId = req.params.sessionId;
  if (!uuidPattern.test(sessionId)) {
    throw new HttpError(404, 'Session not found');
  }
  const session = await AuthSessionRepository.refreshSession.findFirst({
    where: {
      id: sessionId,
      userId: req.auth.userId,
    },
    select: { id: true, userId: true, schoolId: true, tokenHash: true, revokedAt: true },
  });

  if (!session) {
    throw new HttpError(404, 'Session not found');
  }

  const now = new Date();
  if (!session.revokedAt) {
    await AuthSessionRepository.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });
  }

  await logAuthAudit({
    req,
    userId: session.userId,
    schoolId: session.schoolId ?? null,
    entityId: session.id,
    action: 'REFRESH_TOKEN_REVOKED',
    afterState: { revoked: true },
  });

  const currentTokenHash = currentRefreshTokenHashFromRequest(req);
  if (currentTokenHash && currentTokenHash === session.tokenHash) {
    clearAuthCookies(res);
  }

  res.status(200).json({ message: 'Session revoked successfully.' });
};

export const logoutAll = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const now = new Date();
  const result = await AuthSessionRepository.refreshSession.updateMany({
    where: {
      userId: req.auth.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: now,
      lastUsedAt: now,
    },
  });

  await logAuthAudit({
    req,
    userId: req.auth.userId,
    schoolId: req.auth.schoolId ?? null,
    action: 'LOGOUT_ALL',
    afterState: { revokedSessionCount: result.count },
  });

  clearAuthCookies(res);

  res.status(200).json({ message: 'Logged out from all devices.' });
};

export const SessionService = {
  listSessions,
  logout,
  logoutAll,
  refreshToken,
  revokeSession,
};
