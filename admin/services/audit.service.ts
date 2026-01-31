import { api } from '../lib/api';

export type AuditLogResponse = {
  items: Array<{
    id: string;
    actorId: string;
    actorRole: string;
    entityType: string;
    entityId: string;
    action: string;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    createdAt: string;
  }>;
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const listAuditLogs = async (params?: {
  page?: number;
  limit?: number;
  entityType?: string;
  actorRole?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const { data } = await api.get<AuditLogResponse>('/audit-logs', { params });
  return data;
};
