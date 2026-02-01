import { api } from '../lib/api';

export type Parent = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  students?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    admissionNo: string;
  }>;
};

export const listParents = async (params?: {
  schoolId?: string;
  query?: string;
  limit?: number;
  page?: number;
}) => {
  const { data } = await api.get<Parent[]>('/parents', { params });
  return data;
};

export const getParent = async (id: string) => {
  const { data } = await api.get<Parent>(`/parents/${id}`);
  return data;
};