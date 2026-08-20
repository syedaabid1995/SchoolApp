import type { CookieOptions, Request, Response } from 'express';
import crypto from 'crypto';
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import type { Prisma } from '@prisma/client';
import { AuthLoginRepository } from '../../repositories/login.repository';
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
import { checkSubscriptionStatus } from '../../../../services/subscription.service';
import { hashPassword, verifyPassword } from '../../../../utils/password';
import { schoolIdentifierWhere } from '../../../../utils/schoolDomain';
import { hashToken } from '../../../../utils/token';
import { getSchoolProfilesByIds } from '../../../../services/schoolProfile.service';
import { getEffectiveModuleFeatureFlags } from '../../../../services/feature-flag.service';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resendTwoFactorSchema,
  resetPasswordSchema,
  switchSchoolSchema,
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
  const school = await AuthLoginRepository.school.findUnique({
    where: { id: schoolId },
    select: { id: true, status: true, statusReason: true },
  });
  if (!school) {
    throw new HttpError(403, 'School is suspended');
  }
  if (school.status === 'ACTIVE') return 'ACTIVE';

  const reason = (school.statusReason ?? '').toLowerCase();
  if (reason.includes('payment') || reason.includes('subscription') || reason.includes('overdue')) {
    try {
      const subscriptionStatus = await checkSubscriptionStatus(schoolId);
      if (subscriptionStatus !== 'SUSPENDED') return 'ACTIVE';
    } catch {
      // Keep the payment-restricted state if current subscription access cannot be confirmed.
    }
    return 'PAYMENT_RESTRICTED';
  }

  return 'SUSPENDED';
};

type SchoolAccessState = Awaited<ReturnType<typeof getSchoolAccessState>>;

const ensureTeacherActive = async (userId: string, schoolId: string | null) => {
  const profile = await AuthLoginRepository.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await AuthLoginRepository.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await AuthLoginRepository.studentParent.findMany({
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

const primaryRoleNameFromUser = (user: { roles?: Array<{ role: { name: string } }> }) => user.roles?.[0]?.role.name ?? null;

const resolveLoginSchoolId = async (params: { schoolId?: string; schoolCode?: string }) => {
  const schoolId = params.schoolId?.trim();
  const schoolCode = params.schoolCode?.trim();
  if (!schoolId && !schoolCode) return null;

  const school = await AuthLoginRepository.school.findFirst({
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

  const school = await AuthLoginRepository.school.findFirst({
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
  const user = await AuthLoginRepository.user.findFirst({
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

const schoolScopedRoleNames = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

const loginUserSelect = {
  id: true,
  email: true,
  passwordHash: true,
  mustChangePassword: true,
  mfaEnabled: true,
  mfaMethod: true,
  schoolId: true,
  school: { select: { id: true, name: true, code: true } },
  status: true,
  roles: { select: { role: { select: { name: true } } }, take: 1 },
  teacherProfile: { select: { firstName: true, lastName: true } },
  parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
  totpCredential: {
    select: {
      enabledAt: true,
      disabledAt: true,
    },
  },
} as const;

type LoginSelectedUser = Prisma.UserGetPayload<{ select: typeof loginUserSelect }>;

const userSchoolOption = (user: NonNullable<LoginSelectedUser>) => ({
  id: user.school?.id ?? user.schoolId ?? '',
  name: user.school?.name ?? 'School',
  code: user.school?.code ?? '',
});

const issueAuthenticatedResponse = async (params: {
  req: Request;
  res: Response;
  user: NonNullable<LoginSelectedUser>;
  roleName: string | null;
  schoolAccessState: SchoolAccessState;
  rememberMe: boolean;
  auditLoginType: LoginType | 'switch-school' | undefined;
}) => {
  const { req, res, user, roleName, schoolAccessState, rememberMe, auditLoginType } = params;
  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleName,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
  };

  const permissions = user.schoolId
    ? await AuthorizationService.getEffectivePermissionCodesForUser(user.schoolId, user.id, roleName)
    : [];
  const moduleFlags = await getEffectiveModuleFeatureFlags({
    schoolId: user.schoolId ?? null,
    userId: user.id,
  });
  const schoolProfile = user.schoolId ? (await getSchoolProfilesByIds([user.schoolId]))[0] ?? null : null;

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

  await logAuthAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    action: 'LOGIN_SUCCESS',
    afterState: {
      loginType: auditLoginType ?? null,
      rememberMe: Boolean(rememberMe),
      role: payloadBase.role,
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
    mustChangePassword: user.mustChangePassword,
    subscriptionRestricted: payloadBase.subscriptionRestricted,
    user: {
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email,
      role: payloadBase.role,
      schoolId: user.schoolId ?? null,
      schoolName: user.school?.name ?? null,
      school: user.school ?? null,
      schoolProfile,
      permissions,
      moduleFlags,
    },
  });
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
  let schoolScope = selectedSchoolId ?? submittedSchoolScope;

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

  let selectedTeacherSchoolAccessState: SchoolAccessState | null = null;
  let user =
    selectedSchoolId || loginType !== 'teacher'
      ? await AuthLoginRepository.user.findFirst({
          where: {
            email: { equals: identifier, mode: 'insensitive' },
            schoolId: selectedSchoolId,
          },
          select: loginUserSelect,
        })
      : null;

  if (!user && !selectedSchoolId && loginType === 'parent') {
    const parentMatches = await AuthLoginRepository.user.findMany({
      where: {
        email: { equals: identifier, mode: 'insensitive' },
        roles: { some: { role: { name: 'PARENT' } } },
      },
      select: loginUserSelect,
      take: 2,
    });
    if (parentMatches.length === 1) {
      user = parentMatches[0];
      schoolScope = user.schoolId ?? schoolScope;
    }
  }

  if (!user && !selectedSchoolId && loginType === 'teacher' && email) {
    const teacherMatches = await AuthLoginRepository.user.findMany({
      where: {
        email: { equals: identifier, mode: 'insensitive' },
        roles: { some: { role: { name: 'TEACHER' } } },
      },
      select: loginUserSelect,
    });
    const validTeacherMatches: Array<{
      user: (typeof teacherMatches)[number];
      schoolAccessState: SchoolAccessState;
    }> = [];

    for (const teacherUser of teacherMatches) {
      if (teacherUser.status !== 'ACTIVE') continue;
      if (!(await verifyPassword(password, teacherUser.passwordHash))) continue;

      const teacherRoleName = primaryRoleNameFromUser(teacherUser);
      if (!isRoleAllowedForLoginType(loginType, teacherRoleName)) continue;

      let candidateSchoolAccessState: SchoolAccessState;
      try {
        candidateSchoolAccessState = teacherUser.schoolId ? await getSchoolAccessState(teacherUser.schoolId) : 'ACTIVE';
      } catch {
        continue;
      }
      if (candidateSchoolAccessState === 'SUSPENDED') continue;

      try {
        await ensureTeacherActive(teacherUser.id, teacherUser.schoolId ?? null);
      } catch {
        continue;
      }

      validTeacherMatches.push({
        user: teacherUser,
        schoolAccessState: candidateSchoolAccessState,
      });
    }

    if (validTeacherMatches.length > 1) {
      await resetLoginFailureCounter(identifier.toLowerCase(), schoolScope);
      res.status(200).json({
        schoolSelectionRequired: true,
        message: 'Select your school to continue.',
        schools: validTeacherMatches.map(({ user: teacherUser }) => ({
          id: teacherUser.school?.id ?? teacherUser.schoolId,
          name: teacherUser.school?.name ?? 'School',
          code: teacherUser.school?.code ?? '',
        })),
      });
      return;
    }

    if (validTeacherMatches.length === 1) {
      user = validTeacherMatches[0].user;
      selectedTeacherSchoolAccessState = validTeacherMatches[0].schoolAccessState;
      schoolScope = user.schoolId ?? schoolScope;
    }
  }

  if (!user) {
    await failLogin('user_not_found_or_wrong_school', { selectedSchoolId, loginType: loginType ?? null });
  }

  if (user.status !== 'ACTIVE') {
    await failLogin('user_not_active', { userId: user.id, selectedSchoolId, loginType: loginType ?? null }, user);
  }

  let schoolAccessState: SchoolAccessState = selectedTeacherSchoolAccessState ?? 'ACTIVE';
  try {
    schoolAccessState =
      selectedTeacherSchoolAccessState ?? (user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE');
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

  const roleRow = await AuthLoginRepository.userRole.findFirst({
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

  await resetLoginFailureCounter(identifier.toLowerCase(), schoolScope);
  if (schoolScope !== submittedSchoolScope) {
    await resetLoginFailureCounter(identifier.toLowerCase(), submittedSchoolScope);
  }

  await issueAuthenticatedResponse({
    req,
    res,
    user,
    roleName,
    schoolAccessState,
    rememberMe: Boolean(rememberMe),
    auditLoginType: loginType,
  });
};

const accessibleSchoolMatchesForUser = async (params: { userId: string; roleName: string | null }) => {
  if (!params.roleName || !schoolScopedRoleNames.includes(params.roleName)) {
    throw new HttpError(403, 'School switching is not available for this account.');
  }

  const currentUser = await AuthLoginRepository.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, status: true },
  });
  if (!currentUser || currentUser.status !== 'ACTIVE') {
    throw new HttpError(401, 'Unauthorized');
  }

  const matches = await AuthLoginRepository.user.findMany({
    where: {
      email: { equals: currentUser.email, mode: 'insensitive' },
      status: 'ACTIVE',
      roles: { some: { role: { name: params.roleName as any } } },
    },
    select: loginUserSelect,
  }) as LoginSelectedUser[];

  const validMatches: Array<{
    user: LoginSelectedUser;
    schoolAccessState: SchoolAccessState;
  }> = [];
  const seenSchoolIds = new Set<string>();

  for (const user of matches) {
    if (!user.schoolId || seenSchoolIds.has(user.schoolId)) continue;

    let schoolAccessState: SchoolAccessState;
    try {
      schoolAccessState = await getSchoolAccessState(user.schoolId);
    } catch {
      continue;
    }
    if (schoolAccessState === 'SUSPENDED') continue;

    if (params.roleName === 'TEACHER') {
      try {
        await ensureTeacherActive(user.id, user.schoolId);
      } catch {
        continue;
      }
    }

    seenSchoolIds.add(user.schoolId);
    validMatches.push({ user, schoolAccessState });
  }

  validMatches.sort((left, right) => userSchoolOption(left.user).name.localeCompare(userSchoolOption(right.user).name));
  return validMatches;
};

export const listAccessibleSchools = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const matches = await accessibleSchoolMatchesForUser({
    userId: req.auth.userId,
    roleName: req.auth.role ?? null,
  });

  res.status(200).json({
    schools: matches.map(({ user }) => ({
      ...userSchoolOption(user),
      selected: user.schoolId === req.auth?.schoolId,
    })),
  });
};

export const switchSchool = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const parsed = switchSchoolSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'Invalid switch school request.', parsed.error.flatten().fieldErrors);
  }

  const selectedSchoolId = await resolveLoginSchoolId(parsed.data);
  if (!selectedSchoolId) {
    throw new HttpError(400, 'School is required.');
  }

  const matches = await accessibleSchoolMatchesForUser({
    userId: req.auth.userId,
    roleName: req.auth.role ?? null,
  });
  const selected = matches.find(({ user }) => user.schoolId === selectedSchoolId);
  if (!selected) {
    throw new HttpError(403, 'You do not have access to this school.');
  }

  await issueAuthenticatedResponse({
    req,
    res,
    user: selected.user,
    roleName: req.auth.role ?? null,
    schoolAccessState: selected.schoolAccessState,
    rememberMe: false,
    auditLoginType: 'switch-school',
  });
};

export const LoginService = {
  listAccessibleSchools,
  login,
  switchSchool,
};
