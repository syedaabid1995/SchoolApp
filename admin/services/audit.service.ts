import { api } from '../lib/api';

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;

export type AuditLogItem = {
  id: string;
  event?: string;
  action?: string;
  severity?: AuditSeverity;
  schoolId?: string | null;
  schoolName?: string | null;
  actor?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    teacherProfile?: { id: string; firstName: string; lastName: string } | null;
    parentProfiles?: Array<{ id: string; firstName: string; lastName: string }>;
  } | null;
  actorId?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataSummary?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditLogDetail = AuditLogItem & {
  school?: { id: string; name: string; code: string } | null;
  metadata?: Record<string, unknown>;
};

export type AuditLogListResponse = {
  items: AuditLogItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
};

export type AuditSummary = {
  total: number;
  today: number;
  highRiskToday: number;
  failedLoginsToday: number;
  securityEventsToday: number;
  adminActionsToday: number;
  exportsToday: number;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  byEvent: Array<{ event: string; count: number }>;
};

export type AuditExportStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | string;

export type AuditExportItem = {
  id: string;
  format: 'csv' | 'json' | string;
  status: AuditExportStatus;
  rowCount?: number | null;
  requestedBy?: {
    id: string;
    name?: string | null;
  } | null;
  schoolId?: string | null;
  schoolName?: string | null;
  reason?: string | null;
  createdAt: string;
  completedAt?: string | null;
  downloadAvailable?: boolean;
};

export type AuditLogParams = {
  page?: number;
  limit?: number;
  search?: string;
  event?: string;
  action?: string;
  actorId?: string;
  actorRole?: string;
  schoolId?: string;
  targetType?: string;
  targetId?: string;
  entityType?: string;
  entityId?: string;
  severity?: string;
  ipAddress?: string;
  dateFrom?: string;
  dateTo?: string;
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

const cleanParams = (params?: Record<string, unknown>) => {
  if (!params) return undefined;
  return Object.entries(params).reduce<Record<string, string | number | boolean>>((result, [key, value]) => {
    if (value === undefined || value === null || value === '') return result;
    result[key] = value as string | number | boolean;
    return result;
  }, {});
};

export const listAuditLogs = async (params?: AuditLogParams) => {
  const { data } = await api.get<AuditLogListResponse>('/audit-logs', { params: cleanParams(params) });
  return data;
};

export const getAuditLogs = async (params?: AuditLogParams) => {
  const { data } = await api.get<ApiEnvelope<AuditLogListResponse>>('/admin/audit-logs', {
    params: cleanParams(params),
  });
  return unwrapData(data);
};

export const getAuditLogSummary = async () => {
  const { data } = await api.get<ApiEnvelope<AuditSummary>>('/admin/audit-logs/summary');
  return unwrapData(data);
};

export const getHighRiskAuditLogs = async (params?: { dateFrom?: string; dateTo?: string; limit?: number }) => {
  const { data } = await api.get<ApiEnvelope<{ items: AuditLogItem[] }>>('/admin/audit-logs/high-risk', {
    params: cleanParams(params),
  });
  return unwrapData(data);
};

export const getAuditLogById = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<AuditLogDetail>>(`/admin/audit-logs/${id}`);
  return unwrapData(data);
};

export const requestAuditExport = async (payload: {
  format: 'csv' | 'json';
  filters: Record<string, unknown>;
  reason: string;
}) => {
  const { data } = await api.post<ApiEnvelope<{
    exportId: string;
    status: string;
    format: string;
    downloadAvailable?: boolean;
    message: string;
  }>>('/admin/audit-logs/export', payload);
  return unwrapData(data);
};

export const getAuditExports = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  format?: string;
  requestedById?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const { data } = await api.get<ApiEnvelope<{
    items: AuditExportItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>>('/admin/audit-exports', { params: cleanParams(params) });
  return unwrapData(data);
};

export const getAuditExportById = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<AuditExportItem>>(`/admin/audit-exports/${id}`);
  return unwrapData(data);
};

export const downloadAuditExport = async (id: string) => {
  const response = await api.get<Blob>(`/admin/audit-exports/${id}/download`, { responseType: 'blob' });
  return response.data;
};
