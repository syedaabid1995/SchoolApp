import { api } from '../lib/api';

export type ComplianceStatus =
  | 'REQUESTED'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'NOT_IMPLEMENTED';

export type ComplianceSubjectType = 'STUDENT' | 'PARENT' | 'TEACHER' | 'USER' | 'SCHOOL' | string;

export type ComplianceSummary = {
  exportRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    failed: number;
  };
  deletionRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
    failed: number;
  };
  consents: {
    total: number;
    active: number;
    revoked: number;
    expired: number;
  };
  jobs: {
    running: number;
    completed: number;
    failed: number;
  };
};

export type ComplianceActor = {
  id: string;
  name: string;
  email?: string;
  role?: string;
};

export type DataExportRequest = {
  id: string;
  requestNumber?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  requestedBy?: ComplianceActor | null;
  subjectType?: ComplianceSubjectType;
  subjectId?: string | null;
  status: ComplianceStatus | string;
  reason?: string | null;
  requestedAt?: string | null;
  approvedBy?: ComplianceActor | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  completedAt?: string | null;
  expiresAt?: string | null;
  downloadAvailable?: boolean;
};

export type DataDeletionRequest = {
  id: string;
  requestNumber?: string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  requestedBy?: ComplianceActor | null;
  subjectType?: ComplianceSubjectType;
  subjectId?: string | null;
  status: ComplianceStatus | string;
  reason?: string | null;
  requestedAt?: string | null;
  approvedBy?: ComplianceActor | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  completedAt?: string | null;
};

export type ConsentRecord = {
  id: string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  subjectType?: ComplianceSubjectType;
  subjectId?: string | null;
  consentType: string;
  documentVersion?: string;
  status: string;
  givenAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
};

export type ComplianceJob = {
  id: string;
  type: string;
  status: ComplianceStatus | string;
  schoolId?: string | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
};

export type ComplianceListResponse<T> = {
  items: T[];
  total: number;
};

export type ComplianceFilters = {
  query?: string;
  status?: string;
  schoolId?: string;
  page?: number;
  limit?: number;
};

type ApiEnvelope<T> = T | { success?: boolean; data: T };

const unwrapData = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in payload && (payload as { data?: T }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const cleanParams = (params?: ComplianceFilters) => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );
};

export const getComplianceSummary = async () => {
  const { data } = await api.get<ApiEnvelope<ComplianceSummary>>('/admin/compliance/summary');
  return unwrapData(data);
};

export const getExportRequests = async (params?: ComplianceFilters) => {
  const { data } = await api.get<ApiEnvelope<ComplianceListResponse<DataExportRequest>>>(
    '/admin/compliance/export-requests',
    { params: cleanParams(params) },
  );
  return unwrapData(data);
};

export const getExportRequestById = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<DataExportRequest>>(`/admin/compliance/export-requests/${id}`);
  return unwrapData(data);
};

export const approveExportRequest = async (id: string, payload?: { note?: string }) => {
  const { data } = await api.post<ApiEnvelope<DataExportRequest>>(
    `/admin/compliance/export-requests/${id}/approve`,
    payload ?? {},
  );
  return unwrapData(data);
};

export const rejectExportRequest = async (id: string, payload: { reason: string }) => {
  const { data } = await api.post<ApiEnvelope<DataExportRequest>>(
    `/admin/compliance/export-requests/${id}/reject`,
    payload,
  );
  return unwrapData(data);
};

export const getDeletionRequests = async (params?: ComplianceFilters) => {
  const { data } = await api.get<ApiEnvelope<ComplianceListResponse<DataDeletionRequest>>>(
    '/admin/compliance/deletion-requests',
    { params: cleanParams(params) },
  );
  return unwrapData(data);
};

export const getDeletionRequestById = async (id: string) => {
  const { data } = await api.get<ApiEnvelope<DataDeletionRequest>>(`/admin/compliance/deletion-requests/${id}`);
  return unwrapData(data);
};

export const approveDeletionRequest = async (id: string, payload?: { note?: string }) => {
  const { data } = await api.post<ApiEnvelope<DataDeletionRequest>>(
    `/admin/compliance/deletion-requests/${id}/approve`,
    payload ?? {},
  );
  return unwrapData(data);
};

export const rejectDeletionRequest = async (id: string, payload: { reason: string }) => {
  const { data } = await api.post<ApiEnvelope<DataDeletionRequest>>(
    `/admin/compliance/deletion-requests/${id}/reject`,
    payload,
  );
  return unwrapData(data);
};

export const getConsentRecords = async (params?: ComplianceFilters) => {
  const { data } = await api.get<ApiEnvelope<ComplianceListResponse<ConsentRecord>>>(
    '/admin/compliance/consents',
    { params: cleanParams(params) },
  );
  return unwrapData(data);
};

export const getComplianceJobs = async (params?: ComplianceFilters) => {
  const { data } = await api.get<ApiEnvelope<ComplianceListResponse<ComplianceJob>>>(
    '/admin/compliance/jobs',
    { params: cleanParams(params) },
  );
  return unwrapData(data);
};
