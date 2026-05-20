import { api } from '../lib/api';

export type AdminUserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'TEACHER'
  | 'ACCOUNTANT'
  | 'LIBRARIAN'
  | 'STAFF'
  | 'PARENT'
  | 'STUDENT'
  | string;

export type AdminUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'LOCKED' | 'PENDING' | string;

export type AdminUser = {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  role: AdminUserRole | null;
  status?: AdminUserStatus;
  schoolId?: string | null;
  schoolName?: string | null;
  school?: {
    id: string;
    name: string;
    code: string;
  } | null;
  isActive?: boolean;
  isLocked?: boolean;
  mustChangePassword?: boolean;
  mfaEnabled?: boolean;
  mfaMethod?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  profile?: {
    type: string;
    displayName: string;
  };
};

export type AdminUserListResponse = {
  items: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminUserSummary = {
  total: number;
  superAdmins: number;
  schoolAdmins: number;
  teachers: number;
  parents: number;
  students: number;
  lockedUsers: number;
  mfaEnabledAdmins: number;
};

export type AdminUserActivity = {
  id: string;
  event: string;
  entityType?: string;
  entityId?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type AdminUserSession = {
  id: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt: string;
};

export type AdminUserListParams = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  schoolId?: string;
  mfaEnabled?: boolean | '';
  locked?: boolean | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type ApiEnvelope<T> = T | { success: boolean; data: T };

const unwrapData = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const cleanParams = (params?: AdminUserListParams) => {
  if (!params) return undefined;
  return Object.entries(params).reduce<Record<string, string | number | boolean>>((result, [key, value]) => {
    if (value === undefined || value === null || value === '') return result;
    result[key] = value;
    return result;
  }, {});
};

export const getAdminUsers = async (params?: AdminUserListParams) => {
  const { data } = await api.get<ApiEnvelope<AdminUserListResponse>>('/admin/users', {
    params: cleanParams(params),
  });
  return unwrapData(data);
};

export const getAdminUsersSummary = async () => {
  const { data } = await api.get<ApiEnvelope<AdminUserSummary>>('/admin/users/summary');
  return unwrapData(data);
};

export const getAdminUserById = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<AdminUser>>(`/admin/users/${id}`);
  return unwrapData(data);
};

export const updateAdminUserStatus = async (id: string, payload: { status: string; reason?: string | null }) => {
  const { data } = await api.patch<ApiEnvelope<AdminUser>>(`/admin/users/${id}/status`, payload);
  return unwrapData(data);
};

export const lockAdminUser = async (id: string, payload: { reason?: string | null }) => {
  const { data } = await api.patch<ApiEnvelope<AdminUser>>(`/admin/users/${id}/lock`, payload);
  return unwrapData(data);
};

export const unlockAdminUser = async (id: string, payload: { reason?: string | null }) => {
  const { data } = await api.patch<ApiEnvelope<AdminUser>>(`/admin/users/${id}/unlock`, payload);
  return unwrapData(data);
};

export const forcePasswordReset = async (id: string, payload: { reason?: string | null }) => {
  const { data } = await api.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/force-password-reset`, payload);
  return unwrapData(data);
};

export const revokeUserSessions = async (id: string, payload: { reason?: string | null }) => {
  const { data } = await api.post<ApiEnvelope<{ revokedSessions: number }>>(`/admin/users/${id}/revoke-sessions`, payload);
  return unwrapData(data);
};

export const disableUserMfa = async (id: string, payload: { reason?: string | null }) => {
  const { data } = await api.post<ApiEnvelope<AdminUser>>(`/admin/users/${id}/disable-mfa`, payload);
  return unwrapData(data);
};

export const getAdminUserActivity = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<{ items: AdminUserActivity[] }>>(`/admin/users/${id}/activity`);
  return unwrapData(data);
};

export const getAdminUserSessions = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<{ items: AdminUserSession[] }>>(`/admin/users/${id}/sessions`);
  return unwrapData(data);
};
