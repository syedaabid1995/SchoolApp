import {
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
} from './sensitiveFieldCrypto';
import { decryptSecret, isEncryptedSecret } from './cryptoVault';

const SECRET_CREDENTIAL_KEYS = new Set([
  'password',
  'authtoken',
  'authkey',
  'accesstoken',
  'refreshtoken',
  'bearertoken',
  'apikey',
  'secretkey',
  'clientsecret',
  'webhooksecret',
  'signingsecret',
  'privatekey',
  'secret',
  'token',
]);

const normalizedCredentialKey = (key: string) => key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

const associatedDataFor = (key: string) => `SchoolMessagingConfig.credentials.${normalizedCredentialKey(key)}`;

export const isMessagingSecretCredentialKey = (key: string) =>
  SECRET_CREDENTIAL_KEYS.has(normalizedCredentialKey(key));

export const encryptMessagingCredentialsForStorage = <T extends Record<string, string>>(credentials: T): T => {
  const next = { ...credentials };
  for (const [key, value] of Object.entries(next)) {
    if (!isMessagingSecretCredentialKey(key)) continue;
    if (!value || isEncryptedSecret(value)) continue;
    next[key as keyof T] = maybeEncryptSensitiveField(value, {
      associatedData: associatedDataFor(key),
    }) as T[keyof T];
  }
  return next;
};

export const decryptMessagingCredentials = (credentials: unknown) => {
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return {};

  return Object.entries(credentials as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value !== 'string') return acc;
    if (!isMessagingSecretCredentialKey(key)) {
      acc[key] = value;
      return acc;
    }

    if (isEncryptedSecret(value)) {
      acc[key] = decryptSecret(value);
      return acc;
    }

    acc[key] = maybeDecryptSensitiveField(value, {
      associatedData: associatedDataFor(key),
    });
    return acc;
  }, {});
};
