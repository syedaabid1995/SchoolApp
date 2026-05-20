import { api } from '../lib/api';

export type AuthSecuritySettings = {
  twoStepEnabled: boolean;
  emailOtpEnabled: boolean;
  authenticatorAppEnabled: boolean;
  requiredRoles: string[];
};

export const getAuthSecuritySettings = async () => {
  const { data } = await api.get<AuthSecuritySettings>('/features/auth-security');
  return data;
};

export const updateAuthSecuritySettings = async (payload: AuthSecuritySettings) => {
  const { data } = await api.put<AuthSecuritySettings>('/features/auth-security', payload);
  return data;
};
