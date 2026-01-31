import { Prisma } from '@prisma/client';

export const otpSelect = {
  id: true,
  schoolId: true,
  phone: true,
  purpose: true,
  expiresAt: true,
  attempts: true,
  maxAttempts: true,
  verifiedAt: true,
  createdAt: true,
} satisfies Prisma.OtpCodeSelect;

export type OtpRecord = Prisma.OtpCodeGetPayload<{ select: typeof otpSelect }>;
