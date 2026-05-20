import type { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import {
  assertLoginFailureLimit,
  authLimiterSchoolScope,
  AUTH_RATE_LIMIT_MESSAGE,
  consumeMfaChallengeLimit,
  recordLoginFailure,
  resetLoginFailureCounter,
} from '../middlewares/rate-limit.middleware';
import {
  createRefreshSession,
  getCookieValue,
  revokeRefreshSession,
  rotateRefreshSession,
  validateRefreshSession,
} from '../services/refreshSession.service';
import {
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_PUBLIC_RESPONSE,
  PASSWORD_RESET_SUCCESS_RESPONSE,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/passwordReset.service';
import {
  createLoginMfaChallenge,
  MFA_VERIFICATION_ERROR_MESSAGE,
  MfaVerificationError,
  isLoginMfaRequired,
  resendLoginMfaOtp,
  verifyLoginMfaChallenge,
} from '../services/mfa.service';
import {
  createTotpLoginChallenge,
  disableTotp as disableTotpService,
  startTotpSetup as startTotpSetupService,
  TotpVerificationError,
  verifyTotpLoginChallenge,
  verifyTotpSetup as verifyTotpSetupService,
} from '../services/totp.service';
import { isAuthenticatorAppVerificationEnabled } from '../services/authSecurity.service';
import { buildAuthAuditMetadata, createAuthAuditLog, maskEmailForAudit } from '../utils/audit';
import { getEffectivePermissionCodesForUser } from '../utils/employeePermissions';
import { hashPassword, verifyPassword } from '../utils/password';
import { hashToken } from '../utils/token';
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
} from '../validations/auth.validation';

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

const getSchoolAccessState = async (schoolId: string): Promise<'ACTIVE' | 'PAYMENT_RESTRICTED' | 'SUSPENDED'> => {
  const school = await prisma.school.findUnique({
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
  const profile = await prisma.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await prisma.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await prisma.studentParent.findMany({
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

  const school = await prisma.school.findFirst({
    where: schoolId ? { id: schoolId } : { code: schoolCode },
    select: { id: true, code: true },
  });

  if (!school || (schoolCode && school.code !== schoolCode)) {
    rejectLogin('school_not_found_or_mismatch', { schoolId: schoolId ?? null, schoolCode: schoolCode ?? null });
  }

  return school.id;
};

const resolveLoginSchoolIdSilently = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await prisma.school.findFirst({
    where: schoolId ? { id: schoolId } : { code: schoolCode },
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
  const user = await prisma.user.findFirst({
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

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    rejectLogin('validation_failed', {
      fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean),
    });
  }

  const { email, username, password, schoolId, schoolCode, rememberMe, loginType } = parsed.data;
  const identifier = (email ?? username ?? '').trim();
  const submittedSchoolScope = authLimiterSchoolScope(parsed.data);

  try {
    await assertLoginFailureLimit(identifier.toLowerCase(), submittedSchoolScope);
  } catch (err) {
    if (err instanceof HttpError && err.statusCode === 429) {
      const auditSchoolId = await resolveLoginSchoolIdSilently({ schoolId, schoolCode });
      await logAuthAuditForIdentifier({
        req,
        identifier,
        schoolId: auditSchoolId,
        action: 'RATE_LIMIT_TRIGGERED',
        afterState: {
          reason: 'login_identity_failed_attempt_limit',
          identifier: maskEmailForAudit(identifier),
          limiter: 'LOGIN',
        },
      });
      throw err;
    }
    throw err;
  }

  const selectedSchoolId = await resolveLoginSchoolId({ schoolId, schoolCode }).catch(async (err) => {
    await recordLoginFailure(identifier.toLowerCase(), submittedSchoolScope);
    await logAuthAuditForIdentifier({
      req,
      identifier,
      schoolId: null,
      action: 'LOGIN_FAILED',
      afterState: {
        reason: 'school_not_found_or_mismatch',
        identifier: maskEmailForAudit(identifier),
        loginType: loginType ?? null,
        schoolProvided: Boolean(schoolId || schoolCode),
      },
    });
    throw err;
  });
  const schoolScope = selectedSchoolId ?? submittedSchoolScope;

  if (schoolScope !== submittedSchoolScope) {
    try {
      await assertLoginFailureLimit(identifier.toLowerCase(), schoolScope);
    } catch (err) {
      if (err instanceof HttpError && err.statusCode === 429) {
        await logAuthAuditForIdentifier({
          req,
          identifier,
          schoolId: selectedSchoolId,
          action: 'RATE_LIMIT_TRIGGERED',
          afterState: {
            reason: 'login_identity_failed_attempt_limit',
            identifier: maskEmailForAudit(identifier),
            limiter: 'LOGIN',
          },
        });
      }
      throw err;
    }
  }

  const failLogin = async (
    reason: string,
    meta?: Record<string, unknown>,
    userForAudit?: { id: string; schoolId: string | null },
  ): Promise<never> => {
    const result = await recordLoginFailure(identifier.toLowerCase(), schoolScope);
    if (userForAudit) {
      await logAuthAudit({
        req,
        userId: userForAudit.id,
        schoolId: userForAudit.schoolId ?? null,
        action: 'LOGIN_FAILED',
        afterState: {
          reason,
          identifier: maskEmailForAudit(identifier),
          loginType: loginType ?? null,
        },
      });
      if (result.limited) {
        await logAuthAudit({
          req,
          userId: userForAudit.id,
          schoolId: userForAudit.schoolId ?? null,
          action: 'RATE_LIMIT_TRIGGERED',
          afterState: {
            reason: 'login_identity_failed_attempt_limit',
            identifier: maskEmailForAudit(identifier),
            limiter: 'LOGIN',
          },
        });
      }
    } else {
      await logAuthAuditForIdentifier({
        req,
        identifier,
        schoolId: selectedSchoolId,
        action: 'LOGIN_FAILED',
        afterState: {
          reason,
          identifier: maskEmailForAudit(identifier),
          loginType: loginType ?? null,
        },
      });
    }
    if (result.limited) {
      throw new HttpError(429, AUTH_RATE_LIMIT_MESSAGE);
    }
    return rejectLogin(reason, meta);
  };

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: identifier, mode: 'insensitive' },
      schoolId: selectedSchoolId,
    },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      mustChangePassword: true,
      mfaEnabled: true,
      mfaMethod: true,
      schoolId: true,
      status: true,
      teacherProfile: { select: { firstName: true, lastName: true } },
      parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
      totpCredential: {
        select: {
          enabledAt: true,
          disabledAt: true,
        },
      },
    },
  });

  if (!user) {
    await failLogin('user_not_found_or_wrong_school', { selectedSchoolId, loginType: loginType ?? null });
  }

  if (user.status !== 'ACTIVE') {
    await failLogin('user_not_active', { userId: user.id, selectedSchoolId, loginType: loginType ?? null }, user);
  }

  let schoolAccessState: Awaited<ReturnType<typeof getSchoolAccessState>> = 'ACTIVE';
  try {
    schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  } catch {
    await failLogin('school_not_found', { userId: user.id, schoolId: user.schoolId ?? null }, user);
  }
  if (schoolAccessState === 'SUSPENDED') {
    await failLogin('school_suspended', { userId: user.id, schoolId: user.schoolId ?? null }, user);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    await failLogin('invalid_password', { userId: user.id, schoolId: user.schoolId ?? null, loginType: loginType ?? null }, user);
  }

  const roleRow = await prisma.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });
  const roleName = roleRow?.role.name ?? null;

  if (!isRoleAllowedForLoginType(loginType, roleName)) {
    await failLogin('role_mismatch', { userId: user.id, schoolId: user.schoolId ?? null, loginType: loginType ?? null }, user);
  }

  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleName,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
  };

  if (payloadBase.role === 'TEACHER') {
    try {
      await ensureTeacherActive(user.id, user.schoolId ?? null);
    } catch {
      await failLogin('teacher_inactive', { userId: user.id, schoolId: user.schoolId ?? null }, user);
    }
  }
  if (payloadBase.role === 'PARENT') {
    try {
      await ensureParentActive(user.id);
    } catch {
      await failLogin('parent_inactive', { userId: user.id, schoolId: user.schoolId ?? null }, user);
    }
  }

  const hasActiveTotp = Boolean(user.totpCredential?.enabledAt && !user.totpCredential.disabledAt);
  if (await isLoginMfaRequired({ roleName, mfaEnabled: user.mfaEnabled, hasActiveTotp })) {
    if (hasActiveTotp && (await isAuthenticatorAppVerificationEnabled())) {
      try {
        await consumeMfaChallengeLimit(user.id, user.schoolId ?? null);
      } catch (err) {
        if (err instanceof HttpError && err.statusCode === 429) {
          await logAuthAudit({
            req,
            userId: user.id,
            schoolId: user.schoolId ?? null,
            action: 'RATE_LIMIT_TRIGGERED',
            afterState: {
              reason: 'totp_challenge_limit',
              limiter: 'MFA_CHALLENGE',
              role: payloadBase.role,
            },
          });
        }
        throw err;
      }

      const challenge = await createTotpLoginChallenge({
        req,
        userId: user.id,
        schoolId: user.schoolId ?? null,
      });

      await resetLoginFailureCounter(identifier.toLowerCase(), schoolScope);
      if (schoolScope !== submittedSchoolScope) {
        await resetLoginFailureCounter(identifier.toLowerCase(), submittedSchoolScope);
      }

      await logAuthAudit({
        req,
        userId: user.id,
        schoolId: user.schoolId ?? null,
        entityId: challenge.challengeId,
        action: 'MFA_CHALLENGE_CREATED',
        afterState: {
          loginType: loginType ?? null,
          role: payloadBase.role,
          method: 'totp',
          expiresAt: challenge.expiresAt.toISOString(),
        },
      });

      res.status(200).json({
        mfaRequired: true,
        mfaMethod: 'totp',
        challengeId: challenge.challengeId,
        message: 'Enter the code from your authenticator app.',
      });
      return;
    }

    try {
      await consumeMfaChallengeLimit(user.id, user.schoolId ?? null);
    } catch (err) {
      if (err instanceof HttpError && err.statusCode === 429) {
        await logAuthAudit({
          req,
          userId: user.id,
          schoolId: user.schoolId ?? null,
          action: 'RATE_LIMIT_TRIGGERED',
          afterState: {
            reason: 'mfa_challenge_limit',
            limiter: 'MFA_CHALLENGE',
            role: payloadBase.role,
          },
        });
      }
      throw err;
    }

    const challenge = await createLoginMfaChallenge({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      email: user.email,
    });

    await resetLoginFailureCounter(identifier.toLowerCase(), schoolScope);
    if (schoolScope !== submittedSchoolScope) {
      await resetLoginFailureCounter(identifier.toLowerCase(), submittedSchoolScope);
    }

    await logAuthAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      entityId: challenge.challengeId,
      action: 'MFA_CHALLENGE_CREATED',
      afterState: {
        loginType: loginType ?? null,
        role: payloadBase.role,
        method: user.mfaMethod ?? 'email',
        delivery: challenge.delivery,
        expiresAt: challenge.expiresAt.toISOString(),
      },
    });

    res.status(200).json({
      mfaRequired: true,
      mfaMethod: 'email',
      challengeId: challenge.challengeId,
      message: 'Verification code sent to your email.',
    });
    return;
  }

  const permissions = user.schoolId
    ? await getEffectivePermissionCodesForUser(user.schoolId, user.id, roleName)
    : [];

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshTokenMaxAge = rememberMe ? REMEMBER_ME_REFRESH_TOKEN_TTL_SECONDS : REFRESH_TOKEN_TTL_SECONDS;
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

  await resetLoginFailureCounter(identifier.toLowerCase(), schoolScope);
  if (schoolScope !== submittedSchoolScope) {
    await resetLoginFailureCounter(identifier.toLowerCase(), submittedSchoolScope);
  }

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    action: 'LOGIN_SUCCESS',
    afterState: {
      loginType: loginType ?? null,
      rememberMe: Boolean(rememberMe),
      role: payloadBase.role,
      subscriptionRestricted: payloadBase.subscriptionRestricted,
    },
  });

  res.cookie('refresh_token', refreshToken, refreshCookieOptions(refreshTokenMaxAge));

  res.status(200).json({
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    refreshTokenMaxAge,
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    mustChangePassword: user.mustChangePassword,
    subscriptionRestricted: payloadBase.subscriptionRestricted,
    user: {
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email,
      role: payloadBase.role,
      schoolId: user.schoolId ?? null,
      permissions,
    },
  });
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

  const roleRow = await prisma.userRole.findFirst({
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

  const roleRow = await prisma.userRole.findFirst({
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

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, schoolId: true, status: true, email: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  if (schoolAccessState === 'SUSPENDED') throw new HttpError(403, 'School is suspended');

  const roleRow = await prisma.userRole.findFirst({
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
    accessToken,
    refreshToken: nextRefreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    refreshTokenMaxAge,
    refreshTokenExpiresAt: session.expiresAt.toISOString(),
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
  const sessions = await prisma.refreshSession.findMany({
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
  const session = await prisma.refreshSession.findFirst({
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
    await prisma.refreshSession.update({
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
  const result = await prisma.refreshSession.updateMany({
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
      { fields: parsed.error.issues.map((issue) => issue.path.join('.')).filter(Boolean) },
      'forgot password validation failed',
    );
  }

  res.status(200).json(PASSWORD_RESET_PUBLIC_RESPONSE);
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

export const changePassword = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid change password request.', parsed.error.flatten().fieldErrors);
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, passwordHash: true, status: true, schoolId: true },
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

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextHash, mustChangePassword: false },
    }),
    prisma.refreshSession.updateMany({
      where: {
        userId: user.id,
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
    afterState: { refreshSessionsRevoked: currentRefreshTokenHash ? 'others' : 'all' },
  });

  res.status(200).json({ message: 'Password changed successfully.' });
};
