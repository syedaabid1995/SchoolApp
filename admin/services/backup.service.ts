import { api } from '../lib/api';

export type BackupStatus = 'REQUESTED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NOT_IMPLEMENTED';
export type RestoreStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'NOT_IMPLEMENTED';
export type BackupScope = 'PLATFORM' | 'SCHOOL';
export type BackupType = 'FULL_DATABASE' | 'DATABASE_ONLY' | 'FILES_ONLY' | 'SCHOOL_DATA';

export type BackupServiceStatus = {
  backupExecutionImplemented: boolean;
  restoreExecutionImplemented: boolean;
  downloadImplemented: boolean;
  deleteImplemented: boolean;
  rejectRestoreImplemented: boolean;
};

export type BackupJob = {
  id: string;
  type: BackupType | string;
  scope: BackupScope | string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  status: BackupStatus | string;
  fileSize?: number | null;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string | null;
  downloadAvailable?: boolean;
  reason?: string | null;
};

export type RestoreJob = {
  id: string;
  backupId: string;
  scope: BackupScope | string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  status: RestoreStatus | string;
  requestedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  approvedBy?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string | null;
  reason?: string | null;
};

export type BackupListResponse = {
  items: BackupJob[];
  total: number;
  serviceStatus?: BackupServiceStatus;
};

export type RestoreListResponse = {
  items: RestoreJob[];
  total: number;
  serviceStatus?: BackupServiceStatus;
};

export type BackupFilters = {
  search?: string;
  status?: string;
  schoolId?: string;
};

const cleanParams = (params?: BackupFilters) => {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
};

const normalizeBackupList = (payload: BackupListResponse | BackupJob[]): BackupListResponse => {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }
  return payload;
};

const normalizeRestoreList = (payload: RestoreListResponse | RestoreJob[]): RestoreListResponse => {
  if (Array.isArray(payload)) {
    return { items: payload, total: payload.length };
  }
  return payload;
};

export const getBackupJobs = async (params?: BackupFilters) => {
  const { data } = await api.get<BackupListResponse | BackupJob[]>('/admin/backups', { params: cleanParams(params) });
  return normalizeBackupList(data);
};

export const getBackupJobById = async (id: string) => {
  const { data } = await api.get<BackupJob>(`/admin/backups/${id}`);
  return data;
};

export const createBackup = async (payload: {
  type?: BackupType | string;
  scope?: BackupScope | string;
  schoolId: string;
  reason?: string;
}) => {
  const { data } = await api.post<BackupJob>('/admin/backups', payload);
  return data;
};

export const getRestoreJobs = async (params?: BackupFilters) => {
  const { data } = await api.get<RestoreListResponse | RestoreJob[]>('/admin/restores', { params: cleanParams(params) });
  return normalizeRestoreList(data);
};

export const getRestoreJobById = async (id: string) => {
  const { data } = await api.get<RestoreJob>(`/admin/restores/${id}`);
  return data;
};

export const requestRestore = async (payload: {
  backupId: string;
  schoolId?: string;
  reason?: string;
  confirmed: boolean;
}) => {
  const { data } = await api.post<RestoreJob>('/admin/restores', payload);
  return data;
};

export const approveRestore = async (id: string) => {
  const { data } = await api.post<RestoreJob>(`/admin/restores/${id}/approve`, {});
  return data;
};

export const rejectRestore = async (id: string) => {
  const { data } = await api.post<RestoreJob>(`/admin/restores/${id}/reject`, {});
  return data;
};
