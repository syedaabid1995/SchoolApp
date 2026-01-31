import { api } from '../lib/api';

export const listFeatureFlags = async () => {
  const { data } = await api.get('/features/flags');
  return data;
};

export const createFeatureFlag = async (payload: { code: string; description?: string; enabled: boolean }) => {
  const { data } = await api.post('/features/flags', payload);
  return data;
};

export const updateFeatureFlag = async (id: string, payload: Partial<{ description: string; enabled: boolean }>) => {
  const { data } = await api.patch(`/features/flags/${id}`, payload);
  return data;
};

export const listConfigEntries = async () => {
  const { data } = await api.get('/features/configs');
  return data;
};

export const createConfigEntry = async (payload: { key: string; value: string; description?: string }) => {
  const { data } = await api.post('/features/configs', payload);
  return data;
};

export const updateConfigEntry = async (id: string, payload: Partial<{ value: string; description: string }>) => {
  const { data } = await api.patch(`/features/configs/${id}`, payload);
  return data;
};
