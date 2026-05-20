import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';

export const AUTH_SECURITY_SETTINGS_KEY = 'auth.security';

export type AuthSecuritySettings = {
  twoStepEnabled: boolean;
  emailOtpEnabled: boolean;
  authenticatorAppEnabled: boolean;
  requiredRoles: string[];
};

export const DEFAULT_MFA_REQUIRED_ROLES = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const pickRoles = (value: unknown) => {
  if (!Array.isArray(value)) return DEFAULT_MFA_REQUIRED_ROLES;
  const roles = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  return roles.length ? Array.from(new Set(roles)).slice(0, 20) : DEFAULT_MFA_REQUIRED_ROLES;
};

export const defaultAuthSecuritySettings = (): AuthSecuritySettings => ({
  twoStepEnabled: env.AUTH_TWO_STEP_ENABLED,
  emailOtpEnabled: true,
  authenticatorAppEnabled: true,
  requiredRoles: DEFAULT_MFA_REQUIRED_ROLES,
});

export const normalizeAuthSecuritySettings = (value: unknown): AuthSecuritySettings => {
  const fallback = defaultAuthSecuritySettings();
  const source = isRecord(value) ? value : {};

  return {
    twoStepEnabled: pickBoolean(source.twoStepEnabled, fallback.twoStepEnabled),
    emailOtpEnabled: pickBoolean(source.emailOtpEnabled, fallback.emailOtpEnabled),
    authenticatorAppEnabled: pickBoolean(source.authenticatorAppEnabled, fallback.authenticatorAppEnabled),
    requiredRoles: pickRoles(source.requiredRoles),
  };
};

export const getAuthSecuritySettings = async () => {
  const entry = await prisma.configEntry.findUnique({
    where: { key: AUTH_SECURITY_SETTINGS_KEY },
    select: { value: true },
  });

  return normalizeAuthSecuritySettings(entry?.value);
};

export const saveAuthSecuritySettings = async (settings: AuthSecuritySettings) => {
  const normalized = normalizeAuthSecuritySettings(settings);
  const entry = await prisma.configEntry.upsert({
    where: { key: AUTH_SECURITY_SETTINGS_KEY },
    update: {
      value: normalized as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
    create: {
      key: AUTH_SECURITY_SETTINGS_KEY,
      value: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  return normalizeAuthSecuritySettings(entry.value);
};

export const isTwoStepVerificationEnabled = async () => {
  const settings = await getAuthSecuritySettings();
  return settings.twoStepEnabled && (settings.emailOtpEnabled || settings.authenticatorAppEnabled);
};

export const isEmailOtpVerificationEnabled = async () => {
  const settings = await getAuthSecuritySettings();
  return settings.twoStepEnabled && settings.emailOtpEnabled;
};

export const isAuthenticatorAppVerificationEnabled = async () => {
  const settings = await getAuthSecuritySettings();
  return settings.twoStepEnabled && settings.authenticatorAppEnabled;
};

export const assertEmailOtpVerificationEnabled = async () => {
  if (!(await isEmailOtpVerificationEnabled())) {
    throw new HttpError(404, 'Email verification is disabled.');
  }
};

export const assertAuthenticatorAppVerificationEnabled = async () => {
  if (!(await isAuthenticatorAppVerificationEnabled())) {
    throw new HttpError(404, 'Authenticator app verification is disabled.');
  }
};
