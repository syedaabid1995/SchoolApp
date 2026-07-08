import { api } from '../lib/api';

export type PushPreference = {
  pushEnabled: boolean;
};

export const getPushPreference = async () => {
  const { data } = await api.get<PushPreference>('/notifications/push/preferences/me');
  return data;
};

export const updatePushPreference = async (pushEnabled: boolean) => {
  const { data } = await api.patch<PushPreference>('/notifications/push/preferences/me', { pushEnabled });
  return data;
};

export const registerPushDevice = async (payload: {
  token: string;
  platform: 'WEB';
  app: string;
  deviceId?: string | null;
}) => {
  const { data } = await api.post('/notifications/push/devices', payload);
  return data;
};

export const unregisterPushDevice = async (token: string) => {
  const { data } = await api.post<{ success: boolean }>('/notifications/push/devices/unregister', { token });
  return data;
};
