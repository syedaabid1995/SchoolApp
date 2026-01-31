import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import type { Prisma } from '@prisma/client';
import { HttpError } from './error.middleware';

export type AuditPayload = {
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'OVERRIDE';
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
};

export const auditAttendance = async (
  req: Request,
  payload: AuditPayload,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  if (!req.auth) {
    throw new HttpError(401, 'Unauthorized');
  }

  await client.attendanceAudit.create({
    data: {
      recordId: payload.recordId,
      actorId: req.auth.userId,
      action: payload.action,
      previousValue: payload.previousValue ?? null,
      newValue: payload.newValue ?? null,
      reason: payload.reason ?? null,
    },
  });
};

export const auditMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next();
};
