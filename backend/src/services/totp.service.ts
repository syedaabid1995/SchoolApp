import type { Request } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import {
  consumeTotpDisableLimit,
  consumeTotpSetupVerifyLimit,
} from '../middlewares/rate-limit.middleware';
import { createAuthAuditLog, getAuditRequestIp, getAuditUserAgent } from '../utils/audit';
import { encryptSecret, decryptSecret } from '../utils/cryptoVault';
import {
  createTotpUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyTotpCode,
} from '../utils/totp';
import { hashOtp } from '../utils/otp';
import { assertAuthenticatorAppVerificationEnabled } from './authSecurity.service';

const TOTP_LOGIN_PURPOSE = 'TOTP_LOGIN';
const TOTP_ERROR_MESSAGE = 'Invalid or expired verification code.';
const SETUP_ERROR_MESSAGE = 'Invalid authenticator code.';
const ISSUER = 'School Management System';

export class TotpVerificationError extends HttpError {
  reason: string;
  userId?: string;
  schoolId?: string | null;
  challengeId?: string;

  constructor(
    reason: string,
    context: { userId?: string; schoolId?: string | null; challengeId?: string } = {},
  ) {
    super(401, TOTP_ERROR_MESSAGE);
    this.reason = reason;
    this.userId = context.userId;
    this.schoolId = context.schoolId;
    this.challengeId = context.challengeId;
  }
}

const requireAuthUser = async (req: Request) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      email: true,
      schoolId: true,
      status: true,
      school: { select: { name: true } },
      totpCredential: {
        select: {
          id: true,
          encryptedSecret: true,
          enabledAt: true,
          disabledAt: true,
        },
      },
    },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Unauthorized');
  }

  return user;
};

const auditTotp = async (params: {
  req?: Request;
  userId: string;
  schoolId?: string | null;
  action: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await createAuthAuditLog({
      req: params.req,
      userId: params.userId,
      schoolId: params.schoolId ?? null,
      entityId: params.entityId ?? params.userId,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  } catch {
    // TOTP flow must not depend on audit logging.
  }
};

export const startTotpSetup = async (req: Request) => {
  await assertAuthenticatorAppVerificationEnabled();

  const user = await requireAuthUser(req);
  const existing = user.totpCredential;

  if (existing?.enabledAt && !existing.disabledAt) {
    throw new HttpError(409, 'Authenticator app is already enabled.');
  }

  const secret = generateTotpSecret();
  const issuer = user.school?.name || ISSUER;
  const label = user.email;
  const otpauthUrl = createTotpUri({ issuer, label, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });

  const credential = await prisma.totpCredential.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      schoolId: user.schoolId ?? null,
      encryptedSecret: encryptSecret(secret),
      issuer,
      label,
      enabledAt: null,
      disabledAt: null,
    },
    update: {
      schoolId: user.schoolId ?? null,
      encryptedSecret: encryptSecret(secret),
      issuer,
      label,
      enabledAt: null,
      disabledAt: null,
      setupStartedAt: new Date(),
    },
    select: { id: true },
  });

  await auditTotp({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: credential.id,
    action: 'TOTP_SETUP_STARTED',
    metadata: { issuer, label },
  });

  return {
    secret,
    issuer,
    label,
    otpauthUrl,
    qrCodeDataUrl,
  };
};

const verifyTotpOrBackup = async (params: {
  req?: Request;
  userId: string;
  schoolId: string | null;
  encryptedSecret: string;
  code: string;
}) => {
  const code = params.code.trim();
  const secret = decryptSecret(params.encryptedSecret);

  if (/^\d{6}$/.test(code) && (await verifyTotpCode({ code, secret }))) {
    await prisma.totpCredential.update({
      where: { userId: params.userId },
      data: { lastUsedAt: new Date() },
    });
    return { ok: true, method: 'totp' as const };
  }

  const codeHash = hashBackupCode(code);
  const backupCode = await prisma.totpBackupCode.findFirst({
    where: {
      userId: params.userId,
      codeHash,
      usedAt: null,
    },
    select: { id: true },
  });

  if (!backupCode) {
    return { ok: false, method: null };
  }

  const result = await prisma.totpBackupCode.updateMany({
    where: {
      id: backupCode.id,
      userId: params.userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  if (result.count !== 1) {
    return { ok: false, method: null };
  }

  await auditTotp({
    req: params.req,
    userId: params.userId,
    schoolId: params.schoolId,
    entityId: backupCode.id,
    action: 'BACKUP_CODE_USED',
    metadata: { method: 'backup_code' },
  });

  return { ok: true, method: 'backup_code' as const };
};

export const verifyTotpSetup = async (req: Request, code: string) => {
  await assertAuthenticatorAppVerificationEnabled();

  const user = await requireAuthUser(req);
  await consumeTotpSetupVerifyLimit(user.id);

  const credential = await prisma.totpCredential.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      encryptedSecret: true,
      enabledAt: true,
      disabledAt: true,
    },
  });

  if (!credential || (credential.enabledAt && !credential.disabledAt)) {
    throw new HttpError(400, SETUP_ERROR_MESSAGE);
  }

  const secret = decryptSecret(credential.encryptedSecret);
  if (!(await verifyTotpCode({ code, secret }))) {
    throw new HttpError(401, SETUP_ERROR_MESSAGE);
  }

  const now = new Date();
  const backupCodes = generateBackupCodes();
  const createdIp = getAuditRequestIp(req);
  const userAgent = getAuditUserAgent(req);

  await prisma.$transaction([
    prisma.totpCredential.update({
      where: { userId: user.id },
      data: {
        enabledAt: now,
        disabledAt: null,
        lastUsedAt: now,
      },
    }),
    prisma.totpBackupCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.totpBackupCode.createMany({
      data: backupCodes.map((backupCode) => ({
        userId: user.id,
        schoolId: user.schoolId ?? null,
        codeHash: hashBackupCode(backupCode),
        createdIp,
        userAgent,
      })),
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaMethod: 'totp',
      },
    }),
  ]);

  await auditTotp({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: credential.id,
    action: 'TOTP_ENABLED',
    metadata: { backupCodeCount: backupCodes.length },
  });

  return {
    message: 'Authenticator app enabled successfully.',
    backupCodes,
  };
};

export const disableTotp = async (req: Request, code: string) => {
  await assertAuthenticatorAppVerificationEnabled();

  const user = await requireAuthUser(req);
  await consumeTotpDisableLimit(user.id);

  const credential = await prisma.totpCredential.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      encryptedSecret: true,
      enabledAt: true,
      disabledAt: true,
    },
  });

  if (!credential?.enabledAt || credential.disabledAt) {
    throw new HttpError(400, 'Authenticator app is not enabled.');
  }

  const verification = await verifyTotpOrBackup({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    encryptedSecret: credential.encryptedSecret,
    code,
  });

  if (!verification.ok) {
    throw new HttpError(401, TOTP_ERROR_MESSAGE);
  }

  await prisma.$transaction([
    prisma.totpCredential.update({
      where: { userId: user.id },
      data: {
        disabledAt: new Date(),
      },
    }),
    prisma.totpBackupCode.deleteMany({
      where: { userId: user.id },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaMethod: null,
      },
    }),
  ]);

  await auditTotp({
    req,
    userId: user.id,
    schoolId: user.schoolId ?? null,
    entityId: credential.id,
    action: 'TOTP_DISABLED',
    metadata: { verificationMethod: verification.method },
  });

  return { message: 'Authenticator app disabled successfully.' };
};

export const createTotpLoginChallenge = async (params: {
  req: Request;
  userId: string;
  schoolId: string | null;
}) => {
  await assertAuthenticatorAppVerificationEnabled();

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.mfaChallenge.updateMany({
      where: {
        userId: params.userId,
        purpose: TOTP_LOGIN_PURPOSE,
        verifiedAt: null,
        expiresAt: { gt: now },
      },
      data: { verifiedAt: now },
    });

    return tx.mfaChallenge.create({
      data: {
        userId: params.userId,
        schoolId: params.schoolId,
        otpHash: hashOtp(crypto.randomUUID()),
        purpose: TOTP_LOGIN_PURPOSE,
        expiresAt,
        createdIp: getAuditRequestIp(params.req),
        userAgent: getAuditUserAgent(params.req),
      },
      select: {
        id: true,
        expiresAt: true,
      },
    });
  });

  return {
    challengeId: challenge.id,
    expiresAt: challenge.expiresAt,
  };
};

export const verifyTotpLoginChallenge = async (params: {
  req: Request;
  challengeId: string;
  code: string;
}) => {
  await assertAuthenticatorAppVerificationEnabled();

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
      attempts: true,
      maxAttempts: true,
      user: {
        select: {
          id: true,
          email: true,
          schoolId: true,
          status: true,
          mustChangePassword: true,
          teacherProfile: { select: { firstName: true, lastName: true } },
          parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
          totpCredential: {
            select: {
              encryptedSecret: true,
              enabledAt: true,
              disabledAt: true,
            },
          },
        },
      },
    },
  });

  if (!challenge || challenge.purpose !== TOTP_LOGIN_PURPOSE) {
    throw new TotpVerificationError('challenge_not_found', { challengeId: params.challengeId });
  }

  const errorContext = {
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
    challengeId: challenge.id,
  };

  if (challenge.verifiedAt) {
    throw new TotpVerificationError('challenge_already_verified', errorContext);
  }

  if (challenge.expiresAt <= now) {
    throw new TotpVerificationError('challenge_expired', errorContext);
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new TotpVerificationError('challenge_attempts_exceeded', errorContext);
  }

  const credential = challenge.user.totpCredential;
  if (!credential?.enabledAt || credential.disabledAt) {
    throw new TotpVerificationError('totp_not_enabled', errorContext);
  }

  const verification = await verifyTotpOrBackup({
    req: params.req,
    userId: challenge.userId,
    schoolId: challenge.schoolId ?? null,
    encryptedSecret: credential.encryptedSecret,
    code: params.code,
  });

  if (!verification.ok) {
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new TotpVerificationError('invalid_totp', errorContext);
  }

  const result = await prisma.mfaChallenge.updateMany({
    where: {
      id: challenge.id,
      purpose: TOTP_LOGIN_PURPOSE,
      verifiedAt: null,
      expiresAt: { gt: now },
      attempts: { lt: challenge.maxAttempts },
    },
    data: { verifiedAt: now },
  });

  if (result.count !== 1) {
    throw new TotpVerificationError('challenge_no_longer_valid', errorContext);
  }

  return {
    challengeId: challenge.id,
    user: challenge.user,
    verificationMethod: verification.method,
  };
};
