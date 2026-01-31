import { api } from '../lib/api';

export type School = {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  subscriptionPlan: 'STARTER' | 'STANDARD' | 'PREMIUM';
  adminEmail?: string | null;
  lastLoginAt: string | null;
  activeUsersCount: number;
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SchoolListResponse = {
  items: School[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type SchoolAdminUser = {
  id: string;
  email: string;
  schoolId: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
};

export type CreateSchoolResponse = {
  school: School;
  adminUser?: SchoolAdminUser;
  tempPassword?: string;
};

export const listSchools = async (params?: { page?: number; limit?: number; status?: string; query?: string }) => {
  const normalized = params
    ? {
        ...params,
        query: params.query && params.query.trim().length > 0 ? params.query : undefined,
      }
    : undefined;
  const { data } = await api.get<SchoolListResponse>('/admin/schools', { params: normalized });
  return data;
};

export const createSchool = async (payload: {
  name: string;
  code: string;
  subscriptionPlan: 'STARTER' | 'STANDARD' | 'PREMIUM';
  status?: 'ACTIVE' | 'SUSPENDED';
  adminEmail?: string;
}) => {
  const { data } = await api.post<CreateSchoolResponse>('/admin/schools', payload);
  return data;
};

export const updateSchool = async (id: string, payload: Partial<{
  name: string;
  subscriptionPlan: string;
  statusReason: string | null;
  lastLoginAt: string | null;
  activeUsersCount: number;
}>) => {
  const { data } = await api.patch<School>(`/admin/schools/${id}`, payload);
  return data;
};

export const activateSchool = async (id: string, reason?: string) => {
  const { data } = await api.post<School>(`/admin/schools/${id}/activate`, { reason: reason ?? null });
  return data;
};

export const suspendSchool = async (id: string, reason?: string) => {
  const { data } = await api.post<School>(`/admin/schools/${id}/suspend`, { reason: reason ?? null });
  return data;
};

export const deleteSchool = async (id: string) => {
  const { data } = await api.delete<School>(`/admin/schools/${id}`);
  return data;
};
