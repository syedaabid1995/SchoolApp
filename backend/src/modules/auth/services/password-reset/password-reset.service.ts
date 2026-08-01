import type { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { AuthPasswordResetRepository } from '../../repositories/password-reset.repository';
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
  requestPasswordResetOtp,
  resetPasswordWithOtp,
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
  forgotPasswordOtpSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordOtpSchema,
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

const signToken = (payload: AuthTokenPayload, expiresIn: SignOptions['expiresIn']) => jwt.sign(payload, jwtSecret, { expiresIn });

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
  const school = await AuthPasswordResetRepository.school.findUnique({
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
  const profile = await AuthPasswordResetRepository.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await AuthPasswordResetRepository.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await AuthPasswordResetRepository.studentParent.findMany({
    where: { parentId: { in: parentIds } },
    select: {
      student: { select: { school: { select: { id: true, status: true } } } },
    },
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
  const teacherName = user.teacherProfile ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim() : '';
  const parent = user.parentProfiles?.[0];
  const parentName = parent ? `${parent.firstName} ${parent.lastName}`.trim() : '';
  return teacherName || parentName || user.email;
};

const resolveLoginSchoolId = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await AuthPasswordResetRepository.school.findFirst({
    where: schoolId ? { id: schoolId } : schoolIdentifierWhere(schoolCode),
    select: { id: true },
  });

  if (!school) {
    rejectLogin('school_not_found_or_mismatch', {
      schoolId: schoolId ?? null,
      schoolCode: schoolCode ?? null,
    });
  }

  return school.id;
};

const resolveLoginSchoolIdSilently = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await AuthPasswordResetRepository.school.findFirst({
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
  const user = await AuthPasswordResetRepository.user.findFirst({
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

export const forgotPassword = async (req: Request, res: Response) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (parsed.success) {
    try {
      await requestPasswordReset(req, parsed.data);
    } catch (err) {
      logger.error({ err }, 'forgot password processing failed');
    }
  } else {
    logger.warn(
      {
        fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
      },
      'forgot password validation failed',
    );
  }

  res.status(200).json(PASSWORD_RESET_PUBLIC_RESPONSE);
};

export const forgotPasswordOtp = async (req: Request, res: Response) => {
  const parsed = forgotPasswordOtpSchema.safeParse(req.body);
  if (parsed.success) {
    try {
      await requestPasswordResetOtp(req, parsed.data);
    } catch (err) {
      logger.error({ err }, 'forgot password OTP processing failed');
    }
  } else {
    logger.warn(
      {
        fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
      },
      'forgot password OTP validation failed',
    );
  }

  res.status(200).json({
    message: 'If an account exists, a password reset OTP has been sent.',
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const tokenIssue = parsed.error.issues.find((issue) => issue.path[0] === 'token');
    if (tokenIssue) {
      throw new HttpError(400, INVALID_RESET_TOKEN_MESSAGE);
    }

    throw new HttpError(400, 'Invalid reset password request.', parsed.error.flatten().fieldErrors);
  }

  await resetPasswordWithToken(req, parsed.data);
  clearAuthCookies(res);

  res.status(200).json(PASSWORD_RESET_SUCCESS_RESPONSE);
};

export const resetPasswordOtp = async (req: Request, res: Response) => {
  const parsed = resetPasswordOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    const otpIssue = parsed.error.issues.find((issue) => issue.path[0] === 'otp');
    if (otpIssue) {
      throw new HttpError(400, INVALID_RESET_TOKEN_MESSAGE);
    }

    throw new HttpError(400, 'Invalid reset password request.', parsed.error.flatten().fieldErrors);
  }

  await resetPasswordWithOtp(req, parsed.data);
  clearAuthCookies(res);

  res.status(200).json(PASSWORD_RESET_SUCCESS_RESPONSE);
};

export const changePassword = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid change password request.', parsed.error.flatten().fieldErrors);
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await AuthPasswordResetRepository.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, email: true, passwordHash: true, status: true, schoolId: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Unauthorized');
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const nextHash = await hashPassword(newPassword);

  const currentRefreshToken = getCookieValue(req, 'refresh_token') ?? getCookieValue(req, 'refreshToken');
  const currentRefreshTokenHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;
  const now = new Date();
  const sameEmailUsers = await AuthPasswordResetRepository.user.findMany({
    where: {
      email: { equals: user.email, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  const sameEmailUserIds = sameEmailUsers.map((item) => item.id);

  await AuthPasswordResetRepository.$transaction([
    AuthPasswordResetRepository.user.updateMany({
      where: { id: { in: sameEmailUserIds.length ? sameEmailUserIds : [user.id] } },
      data: { passwordHash: nextHash, mustChangePassword: false },
    }),
    AuthPasswordResetRepository.refreshSession.updateMany({
      where: {
        userId: { in: sameEmailUserIds.length ? sameEmailUserIds : [user.id] },
        revokedAt: null,
        ...(currentRefreshTokenHash ? { tokenHash: { not: currentRefreshTokenHash } } : {}),
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    }),
  ]);

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    action: 'PASSWORD_CHANGE_SUCCESS',
    afterState: {
      refreshSessionsRevoked: currentRefreshTokenHash ? 'others' : 'all',
      sameEmailAccountsUpdated: sameEmailUserIds.length || 1,
    },
  });

  res.status(200).json({ message: 'Password changed successfully.' });
};

export const PasswordResetService = {
  changePassword,
  forgotPassword,
  forgotPasswordOtp,
  resetPassword,
  resetPasswordOtp,
};
