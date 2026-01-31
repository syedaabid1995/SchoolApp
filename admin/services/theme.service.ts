import { api } from '../lib/api';

export const listThemes = async () => {
  const { data } = await api.get('/themes');
  return data;
};

export const createTheme = async (payload: { name: string; tokens: Record<string, string> }) => {
  const { data } = await api.post('/themes', payload);
  return data;
};

export const updateTheme = async (id: string, tokens: Record<string, string>) => {
  const { data } = await api.patch(`/themes/${id}`, { tokens });
  return data;
};

export const publishTheme = async (id: string) => {
  const { data } = await api.post(`/themes/${id}/publish`);
  return data;
};

export const rollbackTheme = async (id: string, targetId: string) => {
  const { data } = await api.post(`/themes/${id}/rollback`, { targetId });
  return data;
};
