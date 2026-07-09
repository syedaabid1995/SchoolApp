import { api } from '../lib/api';

export type BulkImportType =
  | 'CLASS'
  | 'SECTION'
  | 'SUBJECT'
  | 'STUDENT'
  | 'TEACHER'
  | 'EXPENSE_CATEGORY'
  | 'EXPENSE';

export type ImportDefinition = {
  type: BulkImportType;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  sample: Record<string, string>;
};

export type ImportRowError = {
  rowNumber: number;
  field?: string | null;
  message: string;
  rawData?: Record<string, unknown> | null;
};

export type ImportResult = {
  type: BulkImportType;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failedCount: number;
  validCount: number;
  dryRun?: boolean;
  errors: ImportRowError[];
  job?: ImportJob;
};

export type ImportJob = {
  id: string;
  schoolId: string;
  createdById: string;
  type: BulkImportType;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  originalName: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  errorCount: number;
  dryRun: boolean;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const importForm = (type: BulkImportType, file: File, schoolId?: string) => {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  if (schoolId) form.append('schoolId', schoolId);
  return form;
};

export const listImportTypes = async () => {
  const { data } = await api.get<ImportDefinition[]>('/imports/types');
  return data;
};

export const downloadImportTemplate = async (type: BulkImportType) => {
  const { data } = await api.get<Blob>(`/imports/templates/${type}`, { responseType: 'blob' });
  return data;
};

export const previewImport = async (type: BulkImportType, file: File, schoolId?: string) => {
  const { data } = await api.post<ImportResult>('/imports/preview', importForm(type, file, schoolId), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const commitImport = async (type: BulkImportType, file: File, schoolId?: string) => {
  const { data } = await api.post<ImportResult>('/imports/commit', importForm(type, file, schoolId), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const listImports = async (params?: { schoolId?: string; limit?: number }) => {
  const { data } = await api.get<ImportJob[]>('/imports', { params });
  return data;
};
