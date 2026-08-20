import crypto from 'crypto';
import { env } from '../config/env';

const ENCRYPTION_VERSION = 'sfv1';
const HASH_VERSION = 'sfh1';

type SensitiveFieldCryptoOptions = {
  key?: string;
  encryptionEnabled?: boolean;
  associatedData?: string;
};

const keyMaterial = (options?: SensitiveFieldCryptoOptions) =>
  options?.key ?? env.SENSITIVE_FIELD_ENCRYPTION_KEY;

const encryptionEnabled = (options?: SensitiveFieldCryptoOptions) =>
  options?.encryptionEnabled ?? env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;

const encryptionKey = (options?: SensitiveFieldCryptoOptions) => {
  const material = keyMaterial(options);
  if (!material) {
    throw new Error('SENSITIVE_FIELD_ENCRYPTION_KEY is required for sensitive field encryption');
  }
  return crypto.createHash('sha256').update(material).digest();
};

const setAssociatedData = (
  cipher: crypto.CipherGCM | crypto.DecipherGCM,
  associatedData: string | undefined,
) => {
  if (associatedData) {
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
  }
};

export const isEncryptedSensitiveField = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const [version, ivValue, tagValue, encryptedValue] = value.split(':');
  return version === ENCRYPTION_VERSION && Boolean(ivValue && tagValue && encryptedValue);
};

export const encryptSensitiveField = (
  value: string,
  options?: SensitiveFieldCryptoOptions,
) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(options), iv);
  setAssociatedData(cipher, options?.associatedData);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
};

export const decryptSensitiveField = (
  payload: string,
  options?: SensitiveFieldCryptoOptions,
) => {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(':');
  if (version !== ENCRYPTION_VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Unsupported encrypted sensitive field format');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(options),
    Buffer.from(ivValue, 'base64url'),
  );
  setAssociatedData(decipher, options?.associatedData);
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

export const maybeEncryptSensitiveField = <T extends string | null | undefined>(
  value: T,
  options?: SensitiveFieldCryptoOptions,
): T | string => {
  if (value === null || value === undefined || value === '') return value;
  if (isEncryptedSensitiveField(value)) return value;
  if (!encryptionEnabled(options)) return value;
  return encryptSensitiveField(value, options);
};

export const maybeDecryptSensitiveField = <T extends string | null | undefined>(
  value: T,
  options?: SensitiveFieldCryptoOptions,
): T | string => {
  if (value === null || value === undefined || value === '') return value;
  if (!isEncryptedSensitiveField(value)) return value;
  return decryptSensitiveField(value, options);
};

export const normalizeSensitiveLookupValue = (value: string) =>
  value.trim().toLowerCase();

export const hashSensitiveLookupValue = (
  value: string,
  options?: SensitiveFieldCryptoOptions,
) => {
  const normalized = normalizeSensitiveLookupValue(value);
  if (!normalized) return '';

  const hash = crypto
    .createHmac('sha256', encryptionKey(options))
    .update(normalized)
    .digest('hex');

  return `${HASH_VERSION}:${hash}`;
};

export const isSensitiveLookupHash = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${HASH_VERSION}:`);
