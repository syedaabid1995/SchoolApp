import { api } from '../lib/api';

export const listThemes = async (params?: { schoolId?: string }) => {
  const { data } = await api.get('/themes', { params });
  return data;
};

export const createTheme = async (payload: { name: string; tokens: Record<string, string>; schoolId?: string }) => {
  const { data } = await api.post('/themes', payload);
  return data;
};

export const updateTheme = async (id: string, tokens: Record<string, string>, schoolId?: string) => {
  const { data } = await api.patch(`/themes/${id}`, { tokens, schoolId });
  return data;
};

export const publishTheme = async (id: string, schoolId?: string) => {
  const { data } = await api.post(`/themes/${id}/publish`, { schoolId });
  return data;
};

export const rollbackTheme = async (id: string, targetId: string, schoolId?: string) => {
  const { data } = await api.post(`/themes/${id}/rollback`, { targetId, schoolId });
  return data;
};

export const getActiveTheme = async (params?: { schoolId?: string }) => {
  const { data } = await api.get('/themes/active', { params });
  return data;
};
