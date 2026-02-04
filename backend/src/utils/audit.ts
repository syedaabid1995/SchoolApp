import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { createAuditLog } from '../services/auditLog.service';
import { deleteCacheByPattern } from '../services/cache/cache.service';

export const resolveActorRole = async (userId: string) => {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  const names = roles.map((r) => r.role.name);
  if (names.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (names.includes('SCHOOL_ADMIN')) return 'SCHOOL_ADMIN';
  if (names.includes('TEACHER')) return 'TEACHER';
  if (names.includes('ACCOUNTANT')) return 'ACCOUNTANT';
  if (names.includes('LIBRARIAN')) return 'LIBRARIAN';
  if (names.includes('STAFF')) return 'STAFF';
  if (names.includes('PARENT')) return 'PARENT';
  return 'UNKNOWN';
};

export const logAudit = async (
  req: Request,
  payload: {
    schoolId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    beforeState?: Prisma.InputJsonValue | null;
    afterState?: Prisma.InputJsonValue | null;
  },
) => {
  if (!req.auth?.userId) return;
  try {
    const actorRole = await resolveActorRole(req.auth.userId);
    await createAuditLog({
      schoolId: payload.schoolId ?? null,
      actorId: req.auth.userId,
      actorRole,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      beforeState: payload.beforeState ?? null,
      afterState: payload.afterState ?? null,
    });
    await deleteCacheByPattern('cache:audit_logs:*');
  } catch {
    // Do not block primary flow on audit failure.
  }
};
