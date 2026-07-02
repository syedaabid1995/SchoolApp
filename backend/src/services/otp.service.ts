import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';
import { env } from '../config/env';
import { hasActiveMessagingGateway } from './messagingSettings.service';
import { sendNotification } from './notification.service';

const OTP_TTL_MINUTES = 5;
const PURPOSE = 'PARENT_LOGIN';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export const requestOtp = async (params: { schoolId: string; phone: string; actorId?: string | null; actorRole?: string | null }) => {
  const phone = normalizePhone(params.phone);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      schoolId: params.schoolId,
      phone,
      purpose: PURPOSE,
      codeHash,
      expiresAt,
    },
  });

  if (params.actorId && params.actorRole) {
    await createAuditLog({
      schoolId: params.schoolId,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: 'OtpCode',
      entityId: crypto.randomUUID(),
      action: 'REQUEST',
      afterState: { phone, purpose: PURPOSE },
    });
  }

  let smsSent = false;
  const hasSmsGateway = await hasActiveMessagingGateway({ schoolId: params.schoolId, channels: ['SMS'] });
  if (hasSmsGateway) {
    const result = await sendNotification({
      schoolId: params.schoolId,
      userId: params.actorId ?? null,
      channel: 'SMS',
      data: {
        to: phone,
        body: `Your parent login OTP is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`,
      },
    });
    smsSent = result.delivery?.status === 'SENT';
  }

  return {
    sent: smsSent,
    ...(env.NODE_ENV !== 'production' && env.OTP_EXPOSE_CODE_IN_DEV ? { code } : {}),
  };
};

export const verifyOtp = async (params: { schoolId: string; phone: string; code: string }) => {
  const phone = normalizePhone(params.phone);

  const otp = await prisma.otpCode.findFirst({
    where: {
      schoolId: params.schoolId,
      phone,
      purpose: PURPOSE,
      verifiedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw new HttpError(404, 'OTP not found');
  }

  if (otp.attempts >= otp.maxAttempts) {
    throw new HttpError(429, 'OTP attempts exceeded');
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, 'OTP expired');
  }

  const isValid = await bcrypt.compare(params.code, otp.codeHash);
  if (!isValid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new HttpError(401, 'Invalid OTP');
  }

  const verified = await prisma.otpCode.update({
    where: { id: otp.id },
    data: { verifiedAt: new Date() },
  });

  // Optional audit log if parent user exists.
  const parent = await prisma.parentProfile.findFirst({
    where: { phone },
    select: { userId: true },
  });

  if (parent?.userId) {
    await createAuditLog({
      schoolId: params.schoolId,
      actorId: parent.userId,
      actorRole: 'PARENT',
      entityType: 'OtpCode',
      entityId: verified.id,
      action: 'VERIFY',
      beforeState: { phone, verifiedAt: null },
      afterState: { phone, verifiedAt: verified.verifiedAt },
    });
  }

  return { verified: true };
};
