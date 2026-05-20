import type { Request, Response } from 'express';
import { z } from 'zod';
import { queryAuditLogs } from '../services/auditLog.service';
import { resolveSchoolId } from '../utils/tenant';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { HttpError } from '../middlewares/error.middleware';
import {
  getAuditExportById,
  getAuditExportDownload,
  getAuditLogDetail,
  getAuditSummary,
  listAdvancedAuditLogs,
  listAuditExports,
  listHighRiskAuditLogs,
  requestAuditExport,
} from '../services/adminAudit.service';
import { createAuditLog } from '../services/auditLog.service';

const querySchema = z.object({
  schoolId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  actorRole: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const adminQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(160).optional(),
  event: z.string().trim().min(1).max(120).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  actorId: z.string().uuid().optional(),
  actorRole: z.string().trim().min(1).max(60).optional(),
  schoolId: z.string().uuid().optional(),
  targetType: z.string().trim().min(1).max(80).optional(),
  targetId: z.string().trim().min(1).max(120).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  ipAddress: z.string().trim().min(1).max(80).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'event', 'actorRole', 'schoolName', 'severity']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const highRiskSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const exportRequestSchema = z.object({
  format: z.enum(['csv', 'json']),
  filters: adminQuerySchema
    .omit({ page: true, limit: true, sortBy: true, sortOrder: true })
    .partial()
    .default({}),
  reason: z.string().trim().min(3).max(500),
});

const exportListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().trim().min(1).max(40).optional(),
  format: z.enum(['csv', 'json']).optional(),
  requestedById: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const actorFromRequest = (req: Request) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  return {
    userId: req.auth.userId,
    role: req.auth.role ?? 'SUPER_ADMIN',
  };
};

export const listAuditLogs = async (req: Request, res: Response) => {
  const payload = querySchema.parse(req.query);
  let schoolId: string | undefined = undefined;
  if (payload.schoolId) {
    schoolId = resolveSchoolId(req, payload.schoolId);
  } else if (req.auth?.role !== 'SUPER_ADMIN') {
    schoolId = req.auth?.schoolId ?? undefined;
  }

  const queryFingerprint = buildQueryFingerprint({
    schoolId: schoolId ?? null,
    actorId: payload.actorId ?? null,
    actorRole: payload.actorRole ?? null,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    action: payload.action ?? null,
    dateFrom: payload.dateFrom?.toISOString() ?? null,
    dateTo: payload.dateTo?.toISOString() ?? null,
    page: payload.page,
    limit: payload.limit,
  });
  const { value: logs, status } = await rememberCache(
    cacheKeys.auditLogs(queryFingerprint),
    cacheTTL.DASHBOARD,
    () =>
      queryAuditLogs({
        schoolId: schoolId ?? undefined,
        actorId: payload.actorId,
        actorRole: payload.actorRole,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        page: payload.page,
        limit: payload.limit,
      }),
  );
  setCacheHeader(res, status);

  res.status(200).json(logs);
};

export const listAdminAuditLogsApi = async (req: Request, res: Response) => {
  const payload = adminQuerySchema.parse(req.query);
  const result = await listAdvancedAuditLogs({
    page: payload.page,
    limit: payload.limit,
    search: payload.search,
    event: payload.event,
    action: payload.action,
    actorId: payload.actorId,
    actorRole: payload.actorRole,
    schoolId: payload.schoolId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    severity: payload.severity,
    ipAddress: payload.ipAddress,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    sortBy: payload.sortBy,
    sortOrder: payload.sortOrder,
  });
  res.status(200).json({ success: true, data: result });
};

export const getAdminAuditSummaryApi = async (_req: Request, res: Response) => {
  const result = await getAuditSummary();
  res.status(200).json({ success: true, data: result });
};

export const getAdminHighRiskAuditLogsApi = async (req: Request, res: Response) => {
  const payload = highRiskSchema.parse(req.query);
  const result = await listHighRiskAuditLogs({
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    limit: payload.limit,
  });
  res.status(200).json({ success: true, data: result });
};

export const getAdminAuditLogDetailApi = async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const result = await getAuditLogDetail(id);
  const actor = actorFromRequest(req);
  await createAuditLog({
    schoolId: result.schoolId ?? null,
    actorId: actor.userId,
    actorRole: actor.role ?? 'SUPER_ADMIN',
    entityType: 'AUDIT_LOG',
    entityId: id,
    action: 'AUDIT_LOG_DETAIL_VIEWED',
    afterState: { targetAuditLogId: id },
  });
  res.status(200).json({ success: true, data: result });
};

export const requestAdminAuditExportApi = async (req: Request, res: Response) => {
  const payload = exportRequestSchema.parse(req.body);
  const result = await requestAuditExport({
    format: payload.format,
    filters: payload.filters,
    reason: payload.reason,
    actor: actorFromRequest(req),
  });
  res.status(201).json({ success: true, data: result });
};

export const listAdminAuditExportsApi = async (req: Request, res: Response) => {
  const payload = exportListSchema.parse(req.query);
  const result = await listAuditExports({
    page: payload.page,
    limit: payload.limit,
    status: payload.status,
    format: payload.format,
    requestedById: payload.requestedById,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
  });
  res.status(200).json({ success: true, data: result });
};

export const getAdminAuditExportApi = async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const result = await getAuditExportById(id);
  res.status(200).json({ success: true, data: result });
};

export const downloadAdminAuditExportApi = async (req: Request, res: Response) => {
  const { id } = idParamsSchema.parse(req.params);
  const result = await getAuditExportDownload(id, actorFromRequest(req));
  res.setHeader('Content-Type', result.contentType);
  res.download(result.filePath, result.fileName);
};
