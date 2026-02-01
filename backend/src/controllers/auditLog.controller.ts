import type { Request, Response } from 'express';
import { z } from 'zod';
import { queryAuditLogs } from '../services/auditLog.service';
import { resolveSchoolId } from '../utils/tenant';

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

  const logs = await queryAuditLogs({
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
  });

  res.status(200).json(logs);
};
