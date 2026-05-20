import type { Request } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { hashToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { buildAuthAuditMetadata, createAuthAuditLog, maskEmailForAudit } from '../utils/audit';
import type { ForgotPasswordInput, LoginType, ResetPasswordInput } from '../validations/auth.validation';

export const PASSWORD_RESET_PUBLIC_RESPONSE = {
  message: 'If an account exists, password reset instructions have been sent.',
} as const;

export const PASSWORD_RESET_SUCCESS_RESPONSE = {
  message: 'Password has been reset successfully. Please login again.',
} as const;

export const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token.';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;

const expectedRolesByLoginType: Record<LoginType, string[]> = {
  admin: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  staff: ['ACCOUNTANT', 'LIBRARIAN', 'STAFF'],
  teacher: ['TEACHER'],
  parent: ['PARENT'],
  student: [],
};

const firstHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const compact = (value?: string | null) => {
  const next = value?.trim();
  return next || undefined;
};

const getRequestIpAddress = (req: Request) => {
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  return compact(forwardedFor?.split(',')[0]) || compact(realIp) || compact(req.ip) || compact(req.socket.remoteAddress);
};

const getRequestUserAgent = (req: Request) =>
  compact(firstHeaderValue(req.headers['x-original-user-agent'])) ||
  compact(firstHeaderValue(req.headers['user-agent']));

const generateRawResetToken = () => crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');

const buildResetLink = (rawToken: string) => {
  const frontendUrl = env.FRONTEND_URL.replace(/\/+$/, '');
  return `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

const resolvePasswordResetSchoolId = async (input: Pick<ForgotPasswordInput, 'schoolId' | 'schoolCode'>) => {
  const schoolId = compact(input.schoolId);
  const schoolCode = compact(input.schoolCode);
  if (!schoolId && !schoolCode) return null;

  const school = await prisma.school.findFirst({
    where: schoolId ? { id: schoolId } : { code: schoolCode },
    select: { id: true, code: true },
  });

  if (!school) return undefined;
  if (schoolCode && school.code !== schoolCode) return undefined;
  return school.id;
};

const isRoleAllowedForLoginType = (loginType: LoginType | undefined, roleNames: string[]) => {
  if (!loginType) return true;
  const expectedRoles = expectedRolesByLoginType[loginType] ?? [];
  return expectedRoles.length > 0 && roleNames.some((role) => expectedRoles.includes(role));
};

const logForgotPasswordAudit = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
  email: string;
  resetTokenId: string;
  expiresAt: Date;
  delivery: 'development_log' | 'email_not_configured';
}) => {
  try {
    await createAuthAuditLog({
      req: params.req,
      schoolId: params.schoolId,
      userId: params.userId,
      entityId: params.userId,
      action: 'FORGOT_PASSWORD_REQUEST',
      metadata: {
        outcome: 'reset_token_created',
        resetRecordId: params.resetTokenId,
        expiresAt: params.expiresAt.toISOString(),
        delivery: params.delivery,
        identifier: maskEmailForAudit(params.email),
      },
    });
  } catch {
    // Password reset should not fail because audit logging is unavailable.
  }
};

const logPasswordResetSuccessAudit = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
  resetTokenId: string;
}) => {
  try {
    await createAuthAuditLog({
      req: params.req,
      schoolId: params.schoolId,
      userId: params.userId,
      entityId: params.userId,
      action: 'PASSWORD_RESET_SUCCESS',
      metadata: {
        resetRecordId: params.resetTokenId,
        refreshSessionsRevoked: true,
      },
    });
  } catch {
    // Password reset should not fail because audit logging is unavailable.
  }
};

const logForgotPasswordSkippedAudit = async (params: {
  req: Request;
  input: ForgotPasswordInput;
  schoolId?: string | null;
  reason: string;
  userId?: string;
}) => {
  try {
    const metadata = {
      outcome: 'ignored',
      reason: params.reason,
      identifier: maskEmailForAudit(params.input.email),
      schoolId: params.schoolId ?? null,
      loginType: params.input.loginType ?? null,
    };

    if (!params.userId) {
      logger.warn(
        buildAuthAuditMetadata(params.req, {
          action: 'FORGOT_PASSWORD_REQUEST',
          skippedReason: 'audit_actor_unknown',
          ...metadata,
        }),
        'forgot password audit skipped because actor is unknown',
      );
      return;
    }

    await createAuthAuditLog({
      req: params.req,
      schoolId: params.schoolId ?? null,
      userId: params.userId,
      action: 'FORGOT_PASSWORD_REQUEST',
      metadata,
    });
  } catch {
    // Password reset should not fail because audit logging is unavailable.
  }
};

const logPasswordResetFailedAudit = async (params: {
  req: Request;
  userId?: string;
  schoolId?: string | null;
  email?: string | null;
  resetTokenId?: string;
  reason: string;
  expiresAt?: Date;
  usedAt?: Date | null;
}) => {
  try {
    const metadata = {
      reason: params.reason,
      resetRecordId: params.resetTokenId,
      identifier: maskEmailForAudit(params.email),
      expiresAt: params.expiresAt?.toISOString(),
      usedAt: params.usedAt?.toISOString() ?? null,
    };

    if (!params.userId) {
      logger.warn(
        buildAuthAuditMetadata(params.req, {
          action: 'PASSWORD_RESET_FAILED',
          skippedReason: 'audit_actor_unknown',
          reason: params.reason,
        }),
        'password reset audit skipped because actor is unknown',
      );
      return;
    }

    await createAuthAuditLog({
      req: params.req,
      schoolId: params.schoolId ?? null,
      userId: params.userId,
      entityId: params.userId,
      action: 'PASSWORD_RESET_FAILED',
      metadata,
    });
  } catch {
    // Password reset should not fail because audit logging is unavailable.
  }
};

const sendPasswordResetInstructions = async (params: {
  email: string;
  userId: string;
  schoolId: string | null;
  resetLink: string;
  expiresAt: Date;
}) => {
  // A real email adapter is not configured in this codebase yet. The raw token is only logged in development.
  if (env.NODE_ENV === 'development') {
    logger.info(
      {
        email: params.email,
        userId: params.userId,
        schoolId: params.schoolId,
        resetLink: params.resetLink,
        expiresAt: params.expiresAt.toISOString(),
      },
      'development password reset link',
    );
    return 'development_log' as const;
  }

  logger.warn(
    { email: params.email, userId: params.userId, schoolId: params.schoolId },
    'password reset email service not configured',
  );
  return 'email_not_configured' as const;
};

const sendPasswordChangedNotification = async (params: {
  email: string;
  userId: string;
  schoolId: string | null;
}) => {
  // A real email adapter is not configured in this codebase yet.
  if (env.NODE_ENV === 'development') {
    logger.info(
      {
        email: params.email,
        userId: params.userId,
        schoolId: params.schoolId,
      },
      'development password changed notification',
    );
    return;
  }

  logger.warn(
    { email: params.email, userId: params.userId, schoolId: params.schoolId },
    'password changed email service not configured',
  );
};

const rejectInvalidResetToken = (reason: string, meta?: Record<string, unknown>): never => {
  logger.warn({ reason, ...meta }, 'password reset rejected');
  throw new HttpError(400, INVALID_RESET_TOKEN_MESSAGE);
};

export const requestPasswordReset = async (req: Request, input: ForgotPasswordInput) => {
  const selectedSchoolId = await resolvePasswordResetSchoolId(input);
  if (selectedSchoolId === undefined) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      reason: 'school_not_found_or_mismatch',
    });
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: input.email, mode: 'insensitive' },
      schoolId: selectedSchoolId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      schoolId: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!user) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      schoolId: selectedSchoolId,
      reason: 'account_not_found_or_inactive',
    });
    return;
  }

  const roleNames = user.roles.map((entry) => entry.role.name);
  if (!isRoleAllowedForLoginType(input.loginType, roleNames)) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      schoolId: user.schoolId ?? null,
      userId: user.id,
      reason: 'role_mismatch',
    });
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  const rawToken = generateRawResetToken();
  const resetLink = buildResetLink(rawToken);

  const resetToken = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        schoolId: user.schoolId ?? null,
        usedAt: null,
      },
      data: { usedAt: now },
    });

    return tx.passwordResetToken.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId ?? null,
        tokenHash: hashToken(rawToken),
        expiresAt,
        createdIp: getRequestIpAddress(req),
        userAgent: getRequestUserAgent(req),
      },
      select: { id: true },
    });
  });

  const delivery = await sendPasswordResetInstructions({
    email: user.email,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    resetLink,
    expiresAt,
  });

  await logForgotPasswordAudit({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    email: user.email,
    resetTokenId: resetToken.id,
    expiresAt,
    delivery,
  });
};

export const resetPasswordWithToken = async (req: Request, input: ResetPasswordInput) => {
  const now = new Date();
  const tokenHash = hashToken(input.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          schoolId: true,
          status: true,
        },
      },
    },
  });

  if (!resetToken) {
    await logPasswordResetFailedAudit({
      req,
      reason: 'token_not_found',
    });
    rejectInvalidResetToken('token_not_found');
  }
  if (resetToken.usedAt) {
    await logPasswordResetFailedAudit({
      req,
      userId: resetToken.userId,
      schoolId: resetToken.schoolId ?? null,
      email: resetToken.user?.email,
      resetTokenId: resetToken.id,
      reason: 'token_already_used',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('token_already_used', { resetRecordId: resetToken.id, userId: resetToken.userId });
  }
  if (resetToken.expiresAt <= now) {
    await logPasswordResetFailedAudit({
      req,
      userId: resetToken.userId,
      schoolId: resetToken.schoolId ?? null,
      email: resetToken.user?.email,
      resetTokenId: resetToken.id,
      reason: 'token_expired',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('token_expired', { resetRecordId: resetToken.id, userId: resetToken.userId });
  }
  if (!resetToken.user || resetToken.user.status !== 'ACTIVE') {
    await logPasswordResetFailedAudit({
      req,
      userId: resetToken.userId,
      schoolId: resetToken.schoolId ?? null,
      email: resetToken.user?.email,
      resetTokenId: resetToken.id,
      reason: 'user_inactive_or_missing',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('user_inactive_or_missing', { resetRecordId: resetToken.id, userId: resetToken.userId });
  }
  if ((resetToken.schoolId ?? null) !== (resetToken.user.schoolId ?? null)) {
    await logPasswordResetFailedAudit({
      req,
      userId: resetToken.userId,
      schoolId: resetToken.schoolId ?? null,
      email: resetToken.user.email,
      resetTokenId: resetToken.id,
      reason: 'token_tenant_mismatch',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('token_tenant_mismatch', { resetRecordId: resetToken.id, userId: resetToken.userId });
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const tokenUseResult = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (tokenUseResult.count !== 1) {
      await logPasswordResetFailedAudit({
        req,
        userId: resetToken.userId,
        schoolId: resetToken.schoolId ?? null,
        email: resetToken.user.email,
        resetTokenId: resetToken.id,
        reason: 'token_not_usable',
        expiresAt: resetToken.expiresAt,
        usedAt: resetToken.usedAt,
      });
      rejectInvalidResetToken('token_not_usable', { resetRecordId: resetToken.id, userId: resetToken.userId });
    }

    await tx.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await tx.refreshSession.updateMany({
      where: {
        userId: resetToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });
  });

  await logPasswordResetSuccessAudit({
    req,
    userId: resetToken.userId,
    schoolId: resetToken.schoolId ?? null,
    resetTokenId: resetToken.id,
  });

  await sendPasswordChangedNotification({
    email: resetToken.user.email,
    userId: resetToken.userId,
    schoolId: resetToken.schoolId ?? null,
  });
};
