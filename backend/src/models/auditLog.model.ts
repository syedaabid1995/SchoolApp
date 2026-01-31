import { Prisma } from '@prisma/client';

export const auditLogSelect = {
  id: true,
  schoolId: true,
  actorId: true,
  actorRole: true,
  entityType: true,
  entityId: true,
  action: true,
  beforeState: true,
  afterState: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

export type AuditLogRecord = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;
