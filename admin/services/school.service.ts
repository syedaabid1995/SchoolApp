import { api } from '../lib/api';

export type School = {
  id: string;
  name: string;
  code: string;
  status: 'ACTIVE' | 'SUSPENDED';
  deletedAt?: string | null;
  subscriptionPlan: string;
  adminEmail?: string | null;
  adminEmails?: string[];
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

export type SchoolAdminsResponse = {
  school: {
    id: string;
    name: string;
    code: string;
  };
  admins: Array<{
    id: string;
    email: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    createdBy: string;
    createdAt: string;
  }>;
};

export type CreateSchoolResponse = {
  school: School;
  adminUser?: SchoolAdminUser;
  tempPassword?: string;
  whatsappSentTo?: string | null;
  manualShareRequired?: boolean;
  manualShareText?: string | null;
  manualShareUrl?: string | null;
};

export const listSchools = async (params?: { page?: number; limit?: number; status?: string; query?: string; includeDeleted?: boolean }) => {
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
  subscriptionPlan: string;
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

export const restoreSchool = async (id: string) => {
  const { data } = await api.post<School>(`/admin/schools/${id}/restore`);
  return data;
};

export const createSchoolAdmin = async (schoolId: string, adminEmail: string) => {
  const { data } = await api.post<{
    adminUser: SchoolAdminUser;
    tempPassword: string;
    whatsappSentTo?: string | null;
    manualShareRequired?: boolean;
    manualShareText?: string | null;
    manualShareUrl?: string | null;
  }>(
    `/admin/schools/${schoolId}/admins`,
    { adminEmail },
  );
  return data;
};

export const listSchoolAdmins = async (schoolId: string) => {
  const { data } = await api.get<SchoolAdminsResponse>(`/admin/schools/${schoolId}/admins`);
  return data;
};

export const updateSchoolAdminStatus = async (
  schoolId: string,
  adminId: string,
  status: 'ACTIVE' | 'INACTIVE',
) => {
  const { data } = await api.patch<{ id: string; email: string; status: 'ACTIVE' | 'INACTIVE'; createdAt: string }>(
    `/admin/schools/${schoolId}/admins/${adminId}/status`,
    { status },
  );
  return data;
};
