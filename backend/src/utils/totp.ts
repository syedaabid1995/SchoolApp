import crypto from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';

export const generateTotpSecret = () => generateSecret();

export const createTotpUri = (params: {
  issuer: string;
  label: string;
  secret: string;
}) => generateURI({
  issuer: params.issuer,
  label: params.label,
  secret: params.secret,
  digits: 6,
  period: 30,
});

export const verifyTotpCode = async (params: {
  code: string;
  secret: string;
}) => {
  const result = await verify({
    token: params.code,
    secret: params.secret,
    digits: 6,
    period: 30,
    epochTolerance: 30,
  });
  return result.valid;
};

export const normalizeBackupCode = (code: string) =>
  code.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();

export const formatBackupCode = (code: string) =>
  `${code.slice(0, 4)}-${code.slice(4, 8)}`;

export const generateBackupCode = () =>
  formatBackupCode(crypto.randomBytes(4).toString('hex').toUpperCase());

export const generateBackupCodes = (count = 10) =>
  Array.from({ length: count }, () => generateBackupCode());

export const hashBackupCode = (code: string) =>
  crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');
