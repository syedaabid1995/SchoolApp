import type { Request } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { consumeMfaResendLimit } from '../middlewares/rate-limit.middleware';
import { generateOtp, getOtpExpiry, hashOtp, verifyOtp as verifyOtpHash } from '../utils/otp';
import {
  assertEmailOtpVerificationEnabled,
  getAuthSecuritySettings,
} from './authSecurity.service';
import { sendLoginOtpEmail } from './email.service';

const LOGIN_PURPOSE = 'LOGIN';
export const MFA_VERIFICATION_ERROR_MESSAGE = 'Invalid or expired verification code.';

export class MfaVerificationError extends HttpError {
  reason: string;
  userId?: string;
  schoolId?: string | null;
  challengeId?: string;

  constructor(
    reason: string,
    context: { userId?: string; schoolId?: string | null; challengeId?: string } = {},
  ) {
    super(401, MFA_VERIFICATION_ERROR_MESSAGE);
    this.reason = reason;
    this.userId = context.userId;
    this.schoolId = context.schoolId;
    this.challengeId = context.challengeId;
  }
}

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

const assertChallengeRequestMatches = (
  req: Request,
  challenge: { createdIp?: string | null; userAgent?: string | null },
  context: { userId?: string; schoolId?: string | null; challengeId?: string },
) => {
  const requestIp = getRequestIpAddress(req);
  const requestUserAgent = getRequestUserAgent(req);
  if (challenge.createdIp && requestIp && challenge.createdIp !== requestIp) {
    throw new MfaVerificationError('challenge_request_mismatch', context);
  }
  if (challenge.userAgent && requestUserAgent && challenge.userAgent !== requestUserAgent) {
    throw new MfaVerificationError('challenge_request_mismatch', context);
  }
};

export const isLoginMfaRequired = async (params: {
  roleName: string | null;
  mfaEnabled?: boolean | null;
  hasActiveTotp?: boolean | null;
}) => {
  const settings = await getAuthSecuritySettings();
  const hasAvailableMethod =
    settings.emailOtpEnabled || (settings.authenticatorAppEnabled && Boolean(params.hasActiveTotp));
  if (!settings.twoStepEnabled || !hasAvailableMethod) {
    return false;
  }

  return Boolean(params.mfaEnabled) || Boolean(params.roleName && settings.requiredRoles.includes(params.roleName));
};

export const createLoginMfaChallenge = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
  email: string;
}) => {
  await assertEmailOtpVerificationEnabled();

  const now = new Date();
  const otp = generateOtp();
  const expiresAt = getOtpExpiry();

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.mfaChallenge.updateMany({
      where: {
        userId: params.userId,
        purpose: LOGIN_PURPOSE,
        verifiedAt: null,
        expiresAt: { gt: now },
      },
      data: { verifiedAt: now },
    });

    return tx.mfaChallenge.create({
      data: {
        userId: params.userId,
        schoolId: params.schoolId,
        otpHash: hashOtp(otp),
        purpose: LOGIN_PURPOSE,
        expiresAt,
        createdIp: getRequestIpAddress(params.req),
        userAgent: getRequestUserAgent(params.req),
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  });

  const delivery = await sendLoginOtpEmail({
    to: params.email,
    otp,
    challengeId: challenge.id,
    userId: params.userId,
    schoolId: params.schoolId,
    expiresAt: challenge.expiresAt,
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
    delivery,
  };
};

export const verifyLoginMfaChallenge = async (params: {
  req: Request;
  challengeId: string;
  otp: string;
}) => {
  await assertEmailOtpVerificationEnabled();

  const now = new Date();
  const challenge = await prisma.mfaChallenge.findUnique({
    where: { id: params.challengeId },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      otpHash: true,
      purpose: true,
      expiresAt: true,
      verifiedAt: true,
      attempts: true,
      maxAttempts: true,
      createdIp: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          email: true,
          schoolId: true,
          status: true,
          mustChangePassword: true,
          teacherProfile: { select: { firstName: true, lastName: true } },
          parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
        },
      },
    },
  });

  if (!challenge || challenge.purpose !== LOGIN_PURPOSE) {
    throw new MfaVerificationError('challenge_not_found', { challengeId: params.challengeId });
  }

  const errorContext = {
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
    challengeId: challenge.id,
  };

  if (challenge.verifiedAt) {
    throw new MfaVerificationError('challenge_already_verified', errorContext);
  }

  if (challenge.expiresAt <= now) {
    throw new MfaVerificationError('challenge_expired', errorContext);
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new MfaVerificationError('challenge_attempts_exceeded', errorContext);
  }

  assertChallengeRequestMatches(params.req, challenge, errorContext);

  if (!verifyOtpHash(params.otp, challenge.otpHash)) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new MfaVerificationError('invalid_otp', errorContext);
  }

  const result = await prisma.mfaChallenge.updateMany({
    where: {
      id: challenge.id,
      purpose: LOGIN_PURPOSE,
      verifiedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: challenge.maxAttempts },
    },
    data: { verifiedAt: now },
  });

  if (result.count !== 1) {
    throw new MfaVerificationError('challenge_no_longer_valid', errorContext);
  }

  return {
    challengeId: challenge.id,
    user: challenge.user,
  };
};

export const resendLoginMfaOtp = async (params: {
  req: Request;
  challengeId: string;
}) => {
  await assertEmailOtpVerificationEnabled();

  const now = new Date();
  const challenge = await prisma.mfaChallenge.findUnique({
    where: { id: params.challengeId },
    select: {
      id: true,
      userId: true,
      schoolId: true,
      purpose: true,
      expiresAt: true,
      verifiedAt: true,
      createdIp: true,
      userAgent: true,
      user: {
        select: {
          id: true,
          email: true,
          status: true,
        },
      },
    },
  });

  if (!challenge || challenge.purpose !== LOGIN_PURPOSE) {
    throw new MfaVerificationError('challenge_not_found', { challengeId: params.challengeId });
  }

  const errorContext = {
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
    challengeId: challenge.id,
  };

  if (challenge.verifiedAt) {
    throw new MfaVerificationError('challenge_already_verified', errorContext);
  }

  if (challenge.expiresAt <= now) {
    throw new MfaVerificationError('challenge_expired', errorContext);
  }

  if (!challenge.user || challenge.user.status !== 'ACTIVE') {
    throw new MfaVerificationError('challenge_user_inactive', errorContext);
  }

  assertChallengeRequestMatches(params.req, challenge, errorContext);

  await consumeMfaResendLimit({
    challengeId: challenge.id,
    userId: challenge.userId,
  });

  const otp = generateOtp();
  const expiresAt = getOtpExpiry();

  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: {
      otpHash: hashOtp(otp),
      attempts: 0,
      expiresAt,
    },
  });

  const delivery = await sendLoginOtpEmail({
    to: challenge.user.email,
    otp,
    challengeId: challenge.id,
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
    expiresAt,
  });

  return {
    challengeId: challenge.id,
    expiresAt,
    delivery,
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
  };
};
