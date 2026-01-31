import { api } from '../lib/api';

export type ConsentRecord = {
  id: string;
  parentId: string;
  type: string;
  status: string;
  document?: { version: string };
  createdAt: string;
};

export const listConsents = async (params?: { parentId?: string }) => {
  const { data } = await api.get<ConsentRecord[]>('/consents/records', { params });
  return data;
};
