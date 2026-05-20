import crypto from 'crypto';

const OTP_DIGITS = 6;
const DEFAULT_OTP_EXPIRY_MINUTES = 5;
const OTP_HASH_PATTERN = /^[0-9a-f]{64}$/i;

export const generateOtp = (): string =>
  crypto.randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');

export const hashOtp = (otp: string): string =>
  crypto.createHash('sha256').update(otp).digest('hex');

export const verifyOtp = (otp: string, otpHash: string): boolean => {
  if (!OTP_HASH_PATTERN.test(otpHash)) return false;

  const expected = Buffer.from(otpHash, 'hex');
  const actual = Buffer.from(hashOtp(otp), 'hex');

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const getOtpExpiry = (minutes = DEFAULT_OTP_EXPIRY_MINUTES): Date =>
  new Date(Date.now() + minutes * 60 * 1000);
