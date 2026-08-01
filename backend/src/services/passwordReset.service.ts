import type { Request } from 'express';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { hashToken } from '../utils/token';
import { hashPassword } from '../utils/password';
import { generateOtp, getOtpExpiry, verifyOtp as verifyOtpHash } from '../utils/otp';
import { buildAuthAuditMetadata, createAuthAuditLog, maskEmailForAudit } from '../utils/audit';
import { schoolIdentifierWhere } from '../utils/schoolDomain';
import type { ForgotPasswordInput, ForgotPasswordOtpInput, LoginType, ResetPasswordInput, ResetPasswordOtpInput } from '../validations/auth.validation';
import { EmailService, type EmailDeliveryStatus } from './email.service';

export const PASSWORD_RESET_PUBLIC_RESPONSE = {
  message: 'If an account exists, password reset instructions have been sent.',
} as const;

export const PASSWORD_RESET_SUCCESS_RESPONSE = {
  message: 'Password has been reset successfully. Please login again.',
} as const;

export const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token.';

const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 15;
const PASSWORD_RESET_OTP_TTL_MINUTES = 10;

const expectedRolesByLoginType: Record<LoginType, string[]> = {
  admin: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
  staff: ['ACCOUNTANT', 'LIBRARIAN', 'STAFF'],
  teacher: ['TEACHER'],
  parent: ['PARENT'],
  student: [],
};

const firstHeaderValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

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
  compact(firstHeaderValue(req.headers['x-original-user-agent'])) || compact(firstHeaderValue(req.headers['user-agent']));

const generateRawResetToken = () => crypto.randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('hex');

const hashPasswordResetOtp = (userId: string, resetTokenId: string, otp: string) => hashToken(`${userId}:${resetTokenId}:${otp}`);

const sameEmailActiveUserIds = async (tx: Prisma.TransactionClient, email: string) => {
  const users = await tx.user.findMany({
    where: {
      email: { equals: email, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
};

const buildResetLink = (rawToken: string) => {
  const frontendUrl = env.FRONTEND_URL.replace(/\/+$/, '');
  return `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

const resolvePasswordResetSchoolId = async (input: Pick<ForgotPasswordInput, 'schoolId' | 'schoolCode'>) => {
  const schoolId = compact(input.schoolId);
  const schoolCode = compact(input.schoolCode);
  if (!schoolId && !schoolCode) return null;

  const school = await prisma.school.findFirst({
    where: schoolId ? { id: schoolId } : schoolIdentifierWhere(schoolCode),
    select: { id: true },
  });

  if (!school) return undefined;
  return school.id;
};

const isRoleAllowedForLoginType = (loginType: LoginType | undefined, roleNames: string[]) => {
  if (!loginType) return true;
  const expectedRoles = expectedRolesByLoginType[loginType] ?? [];
  return expectedRoles.length > 0 && roleNames.some((role) => expectedRoles.includes(role));
};

type PasswordResetUser = {
  id: string;
  email: string;
  schoolId: string | null;
  roles: Array<{ role: { name: string } }>;
};

const findPasswordResetUser = async (
  input: Pick<ForgotPasswordInput, 'email' | 'loginType'>,
  selectedSchoolId: string | null,
) => {
  const users = await prisma.user.findMany({
    where: {
      email: { equals: input.email, mode: 'insensitive' },
      ...(selectedSchoolId ? { schoolId: selectedSchoolId } : {}),
      status: 'ACTIVE',
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      schoolId: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!users.length) {
    return { user: null, matchedLoginType: false };
  }

  if (!input.loginType) {
    return { user: users[0], matchedLoginType: true };
  }

  const matchingUser = users.find((user) =>
    isRoleAllowedForLoginType(
      input.loginType,
      user.roles.map((entry) => entry.role.name),
    ),
  );
  return {
    user: (matchingUser ?? users[0]) as PasswordResetUser,
    matchedLoginType: Boolean(matchingUser),
  };
};

const logForgotPasswordAudit = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
  email: string;
  resetTokenId: string;
  expiresAt: Date;
  delivery: EmailDeliveryStatus;
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

const logPasswordResetSuccessAudit = async (params: { req: Request; userId: string; schoolId: string | null; resetTokenId: string }) => {
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
}): Promise<EmailDeliveryStatus> => {
  const result = await EmailService.sendEmail({
    intent: 'PASSWORD_RESET',
    to: params.email,
    userId: params.userId,
    data: {
      resetLink: params.resetLink,
      expiresAt: params.expiresAt.toISOString(),
    },
    safePayload: {
      purpose: 'PASSWORD_RESET',
      expiresAt: params.expiresAt.toISOString(),
    },
  });

  if (result.status !== 'email_not_configured') {
    return result.status;
  }

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

  logger.warn({ email: params.email, userId: params.userId, schoolId: params.schoolId }, 'password reset email service not configured');
  return 'email_not_configured' as const;
};

const sendPasswordResetOtpEmail = async (params: {
  email: string;
  userId: string;
  schoolId: string | null;
  otp: string;
  expiresAt: Date;
}): Promise<EmailDeliveryStatus> => {
  const result = await EmailService.sendEmail({
    intent: 'PASSWORD_RESET',
    to: params.email,
    userId: params.userId,
    subject: 'Your password reset OTP',
    body: [
      'We received a request to reset your password.',
      'Your password reset OTP is {{otp}}.',
      'This OTP expires at {{expiresAt}}.',
      'If you did not request this, you can ignore this message.',
    ].join('\n\n'),
    data: {
      otp: params.otp,
      expiresAt: params.expiresAt.toISOString(),
    },
    safePayload: {
      purpose: 'PASSWORD_RESET_OTP',
      expiresAt: params.expiresAt.toISOString(),
    },
  });

  if (result.status !== 'email_not_configured') {
    return result.status;
  }

  if (env.NODE_ENV === 'development') {
    logger.info(
      {
        email: params.email,
        userId: params.userId,
        schoolId: params.schoolId,
        otp: params.otp,
        expiresAt: params.expiresAt.toISOString(),
      },
      'development password reset otp',
    );
    return 'development_log' as const;
  }

  logger.warn({ email: params.email, userId: params.userId, schoolId: params.schoolId }, 'password reset OTP email service not configured');
  return 'email_not_configured' as const;
};

const sendPasswordChangedNotification = async (params: { email: string; userId: string; schoolId: string | null }) => {
  const result = await EmailService.sendEmail({
    intent: 'PASSWORD_CHANGED',
    to: params.email,
    userId: params.userId,
    safePayload: { purpose: 'PASSWORD_CHANGED' },
  });

  if (result.status !== 'email_not_configured') {
    return;
  }

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

  logger.warn({ email: params.email, userId: params.userId, schoolId: params.schoolId }, 'password changed email service not configured');
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

  const { user, matchedLoginType } = await findPasswordResetUser(input, selectedSchoolId);

  if (!user) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      schoolId: selectedSchoolId,
      reason: 'account_not_found_or_inactive',
    });
    return;
  }

  if (!matchedLoginType) {
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

export const requestPasswordResetOtp = async (req: Request, input: ForgotPasswordOtpInput) => {
  const selectedSchoolId = await resolvePasswordResetSchoolId(input);
  if (selectedSchoolId === undefined) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      reason: 'school_not_found_or_mismatch',
    });
    return;
  }

  const { user, matchedLoginType } = await findPasswordResetUser(input, selectedSchoolId);

  if (!user) {
    await logForgotPasswordSkippedAudit({
      req,
      input,
      schoolId: selectedSchoolId,
      reason: 'account_not_found_or_inactive',
    });
    return;
  }

  if (!matchedLoginType) {
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
  const expiresAt = getOtpExpiry(PASSWORD_RESET_OTP_TTL_MINUTES);
  const otp = generateOtp();
  const resetTokenId = crypto.randomUUID();
  const tokenHash = hashPasswordResetOtp(user.id, resetTokenId, otp);

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
        id: resetTokenId,
        userId: user.id,
        schoolId: user.schoolId ?? null,
        tokenHash,
        expiresAt,
        createdIp: getRequestIpAddress(req),
        userAgent: getRequestUserAgent(req),
      },
      select: { id: true },
    });
  });

  const delivery = await sendPasswordResetOtpEmail({
    email: user.email,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    otp,
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
    rejectInvalidResetToken('token_already_used', {
      resetRecordId: resetToken.id,
      userId: resetToken.userId,
    });
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
    rejectInvalidResetToken('token_expired', {
      resetRecordId: resetToken.id,
      userId: resetToken.userId,
    });
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
    rejectInvalidResetToken('user_inactive_or_missing', {
      resetRecordId: resetToken.id,
      userId: resetToken.userId,
    });
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
    rejectInvalidResetToken('token_tenant_mismatch', {
      resetRecordId: resetToken.id,
      userId: resetToken.userId,
    });
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
      rejectInvalidResetToken('token_not_usable', {
        resetRecordId: resetToken.id,
        userId: resetToken.userId,
      });
    }

    const sameEmailUserIds = await sameEmailActiveUserIds(tx, resetToken.user.email);

    await tx.user.updateMany({
      where: { id: { in: sameEmailUserIds.length ? sameEmailUserIds : [resetToken.userId] } },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: { in: sameEmailUserIds.length ? sameEmailUserIds : [resetToken.userId] },
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await tx.refreshSession.updateMany({
      where: {
        userId: { in: sameEmailUserIds.length ? sameEmailUserIds : [resetToken.userId] },
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

export const resetPasswordWithOtp = async (req: Request, input: ResetPasswordOtpInput) => {
  const selectedSchoolId = await resolvePasswordResetSchoolId(input);
  if (selectedSchoolId === undefined) {
    await logPasswordResetFailedAudit({
      req,
      email: input.email,
      reason: 'school_not_found_or_mismatch',
    });
    rejectInvalidResetToken('school_not_found_or_mismatch');
  }

  const { user, matchedLoginType } = await findPasswordResetUser(input, selectedSchoolId);

  if (!user) {
    await logPasswordResetFailedAudit({
      req,
      email: input.email,
      schoolId: selectedSchoolId,
      reason: 'account_not_found_or_inactive',
    });
    rejectInvalidResetToken('account_not_found_or_inactive');
  }

  if (!matchedLoginType) {
    await logPasswordResetFailedAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      email: user.email,
      reason: 'role_mismatch',
    });
    rejectInvalidResetToken('role_mismatch');
  }

  const now = new Date();
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      schoolId: user.schoolId ?? null,
      usedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      tokenHash: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken) {
    await logPasswordResetFailedAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      email: user.email,
      reason: 'token_not_found',
    });
    rejectInvalidResetToken('token_not_found');
  }

  if (resetToken.expiresAt <= now) {
    await logPasswordResetFailedAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      email: user.email,
      resetTokenId: resetToken.id,
      reason: 'token_expired',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('token_expired', {
      resetRecordId: resetToken.id,
      userId: user.id,
    });
  }

  if (!verifyOtpHash(`${user.id}:${resetToken.id}:${input.otp}`, resetToken.tokenHash)) {
    await logPasswordResetFailedAudit({
      req,
      userId: user.id,
      schoolId: user.schoolId ?? null,
      email: user.email,
      resetTokenId: resetToken.id,
      reason: 'invalid_otp',
      expiresAt: resetToken.expiresAt,
      usedAt: resetToken.usedAt,
    });
    rejectInvalidResetToken('invalid_otp', {
      resetRecordId: resetToken.id,
      userId: user.id,
    });
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
        userId: user.id,
        schoolId: user.schoolId ?? null,
        email: user.email,
        resetTokenId: resetToken.id,
        reason: 'token_not_usable',
        expiresAt: resetToken.expiresAt,
        usedAt: resetToken.usedAt,
      });
      rejectInvalidResetToken('token_not_usable', {
        resetRecordId: resetToken.id,
        userId: user.id,
      });
    }

    const sameEmailUserIds = await sameEmailActiveUserIds(tx, user.email);

    await tx.user.updateMany({
      where: { id: { in: sameEmailUserIds.length ? sameEmailUserIds : [user.id] } },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await tx.passwordResetToken.updateMany({
      where: {
        userId: { in: sameEmailUserIds.length ? sameEmailUserIds : [user.id] },
        usedAt: null,
      },
      data: { usedAt: now },
    });

    await tx.refreshSession.updateMany({
      where: {
        userId: { in: sameEmailUserIds.length ? sameEmailUserIds : [user.id] },
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
    userId: user.id,
    schoolId: user.schoolId ?? null,
    resetTokenId: resetToken.id,
  });

  await sendPasswordChangedNotification({
    email: user.email,
    userId: user.id,
    schoolId: user.schoolId ?? null,
  });
};
