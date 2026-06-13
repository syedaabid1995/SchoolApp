import type { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { AuthMfaRepository } from '../../repositories/mfa.repository';
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
  const school = await AuthMfaRepository.school.findUnique({
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
  const profile = await AuthMfaRepository.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await AuthMfaRepository.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await AuthMfaRepository.studentParent.findMany({
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

  const school = await AuthMfaRepository.school.findFirst({
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

  const school = await AuthMfaRepository.school.findFirst({
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
  const user = await AuthMfaRepository.user.findFirst({
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


export const verifyTwoFactor = async (req: Request, res: Response) => {
  const parsed = verifyTwoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, MFA_VERIFICATION_ERROR_MESSAGE);
  }

  let verified: Awaited<ReturnType<typeof verifyLoginMfaChallenge>>;
  try {
    verified = await verifyLoginMfaChallenge({
      req,
      challengeId: parsed.data.challengeId,
      otp: parsed.data.otp,
    });
  } catch (err) {
    if (err instanceof MfaVerificationError) {
      if (err.userId) {
        await logAuthAudit({
          req,
          userId: err.userId,
          schoolId: err.schoolId ?? null,
          entityId: err.challengeId ?? err.userId,
          action: 'MFA_FAILED',
          afterState: { reason: err.reason },
        });
      } else {
        logger.warn(
          buildAuthAuditMetadata(req, {
            action: 'MFA_FAILED',
            reason: err.reason,
            challengeId: parsed.data.challengeId,
            skippedReason: 'audit_actor_unknown',
          }),
          'MFA audit skipped because challenge actor is unknown',
        );
      }
    }
    throw err;
  }

  const { user } = verified;
  const failMfaAfterVerification = async (reason: string): Promise<never> => {
    await logAuthAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      entityId: verified.challengeId,
      action: 'MFA_FAILED',
      afterState: { reason },
    });
    throw new HttpError(401, MFA_VERIFICATION_ERROR_MESSAGE);
  };

  if (!user || user.status !== 'ACTIVE') {
    await failMfaAfterVerification('user_not_active');
  }

  let schoolAccessState: Awaited<ReturnType<typeof getSchoolAccessState>> = 'ACTIVE';
  try {
    schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  } catch {
    await failMfaAfterVerification('school_not_found');
  }
  if (schoolAccessState === 'SUSPENDED') {
    await failMfaAfterVerification('school_suspended');
  }

  const roleRow = await AuthMfaRepository.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });
  const roleName = roleRow?.role.name ?? null;

  if (roleName === 'TEACHER') {
    try {
      await ensureTeacherActive(user.id, user.schoolId ?? null);
    } catch {
      await failMfaAfterVerification('teacher_inactive');
    }
  }
  if (roleName === 'PARENT') {
    try {
      await ensureParentActive(user.id);
    } catch {
      await failMfaAfterVerification('parent_inactive');
    }
  }

  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleName,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
  };

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshTokenMaxAge = parsed.data.rememberMe ? REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS;
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenMaxAge * 1000);
  const refreshToken = signToken(
    { ...payloadBase, jti: crypto.randomUUID(), typ: 'refresh' },
    refreshTokenMaxAge,
  );

  await createRefreshSession({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    refreshToken,
    expiresAt: refreshTokenExpiresAt,
  });

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: verified.challengeId,
    action: 'MFA_VERIFIED',
    afterState: {
      role: roleName,
      rememberMe: Boolean(parsed.data.rememberMe),
      subscriptionRestricted: payloadBase.subscriptionRestricted,
    },
  });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS * 1000,
  });
  res.cookie('refresh_token', refreshToken, refreshCookieOptions(refreshTokenMaxAge));

  res.status(200).json({
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    refreshTokenMaxAge,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    ...(shouldReturnTokensInBody(req) ? { accessToken, refreshToken } : {}),
    user: {
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email,
      role: roleName,
      schoolId: user.schoolId ?? null,
    },
    message: 'Login successful.',
  });
};

export const resendTwoFactor = async (req: Request, res: Response) => {
  const parsed = resendTwoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, MFA_VERIFICATION_ERROR_MESSAGE);
  }

  const resent = await resendLoginMfaOtp({
    req,
    challengeId: parsed.data.challengeId,
  });

  await logAuthAudit({
    req,
    userId: resent.userId,
    schoolId: resent.schoolId,
    entityId: resent.challengeId,
    action: 'MFA_OTP_RESENT',
    afterState: {
      delivery: resent.delivery,
      expiresAt: resent.expiresAt.toISOString(),
    },
  });

  res.status(200).json({
    mfaRequired: true,
    challengeId: resent.challengeId,
    message: 'Verification code sent to your email.',
  });
};

export const startTotpSetup = async (req: Request, res: Response) => {
  const result = await startTotpSetupService(req);
  res.status(200).json(result);
};

export const verifyTotpSetup = async (req: Request, res: Response) => {
  const parsed = totpVerifySetupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid authenticator code.');
  }

  const result = await verifyTotpSetupService(req, parsed.data.code);
  res.status(200).json(result);
};

export const disableTotp = async (req: Request, res: Response) => {
  const parsed = totpDisableSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, MFA_VERIFICATION_ERROR_MESSAGE);
  }

  const result = await disableTotpService(req, parsed.data.code);
  res.status(200).json(result);
};

export const verifyTotpLogin = async (req: Request, res: Response) => {
  const parsed = totpVerifyLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, MFA_VERIFICATION_ERROR_MESSAGE);
  }

  let verified: Awaited<ReturnType<typeof verifyTotpLoginChallenge>>;
  try {
    verified = await verifyTotpLoginChallenge({
      req,
      challengeId: parsed.data.challengeId,
      code: parsed.data.code,
    });
  } catch (err) {
    if (err instanceof TotpVerificationError) {
      if (err.userId) {
        await logAuthAudit({
          req,
          userId: err.userId,
          schoolId: err.schoolId ?? null,
          entityId: err.challengeId ?? err.userId,
          action: 'MFA_FAILED',
          afterState: { reason: err.reason, method: 'totp' },
        });
      } else {
        logger.warn(
          buildAuthAuditMetadata(req, {
            action: 'MFA_FAILED',
            reason: err.reason,
            method: 'totp',
            challengeId: parsed.data.challengeId,
            skippedReason: 'audit_actor_unknown',
          }),
          'TOTP MFA audit skipped because challenge actor is unknown',
        );
      }
    }
    throw err;
  }

  const { user } = verified;
  const failMfaAfterVerification = async (reason: string): Promise<never> => {
    await logAuthAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      entityId: verified.challengeId,
      action: 'MFA_FAILED',
      afterState: { reason, method: 'totp' },
    });
    throw new HttpError(401, MFA_VERIFICATION_ERROR_MESSAGE);
  };

  if (!user || user.status !== 'ACTIVE') {
    await failMfaAfterVerification('user_not_active');
  }

  let schoolAccessState: Awaited<ReturnType<typeof getSchoolAccessState>> = 'ACTIVE';
  try {
    schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  } catch {
    await failMfaAfterVerification('school_not_found');
  }
  if (schoolAccessState === 'SUSPENDED') {
    await failMfaAfterVerification('school_suspended');
  }

  const roleRow = await AuthMfaRepository.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });
  const roleName = roleRow?.role.name ?? null;

  if (roleName === 'TEACHER') {
    try {
      await ensureTeacherActive(user.id, user.schoolId ?? null);
    } catch {
      await failMfaAfterVerification('teacher_inactive');
    }
  }
  if (roleName === 'PARENT') {
    try {
      await ensureParentActive(user.id);
    } catch {
      await failMfaAfterVerification('parent_inactive');
    }
  }

  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleName,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
  };

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshTokenMaxAge = parsed.data.rememberMe ? REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS;
  const refreshTokenExpiresAt = new Date(Date.now() + refreshTokenMaxAge * 1000);
  const refreshToken = signToken(
    { ...payloadBase, jti: crypto.randomUUID(), typ: 'refresh' },
    refreshTokenMaxAge,
  );

  await createRefreshSession({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    refreshToken,
    expiresAt: refreshTokenExpiresAt,
  });

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: verified.challengeId,
    action: 'MFA_VERIFIED',
    afterState: {
      role: roleName,
      method: 'totp',
      verificationMethod: verified.verificationMethod,
      rememberMe: Boolean(parsed.data.rememberMe),
      subscriptionRestricted: payloadBase.subscriptionRestricted,
    },
  });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: ACCESS_TOKEN_COOKIE_MAX_AGE_SECONDS * 1000,
  });
  res.cookie('refresh_token', refreshToken, refreshCookieOptions(refreshTokenMaxAge));

  res.status(200).json({
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    refreshTokenMaxAge,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    ...(shouldReturnTokensInBody(req) ? { accessToken, refreshToken } : {}),
    user: {
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email,
      role: roleName,
      schoolId: user.schoolId ?? null,
    },
    message: 'Login successful.',
  });
};

export const MFAService = {
  disableTotp,
  resendTwoFactor,
  startTotpSetup,
  verifyTotpLogin,
  verifyTotpSetup,
  verifyTwoFactor,
};
