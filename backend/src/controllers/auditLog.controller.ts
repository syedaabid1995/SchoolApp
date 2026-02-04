import type { Request, Response } from 'express';
import { z } from 'zod';
import { queryAuditLogs } from '../services/auditLog.service';
import { resolveSchoolId } from '../utils/tenant';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';

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
