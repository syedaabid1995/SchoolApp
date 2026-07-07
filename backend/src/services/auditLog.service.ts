import { prisma } from '../config/db';
import type { Prisma } from '@prisma/client';
import { getRequestContext } from './requestContext.service';

export type AuditCreateInput = {
  schoolId?: string | null;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
};

const isJsonRecord = (value: Prisma.InputJsonValue | null | undefined): value is Prisma.InputJsonObject =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const withRequestContextMetadata = (afterState?: Prisma.InputJsonValue | null) => {
  const context = getRequestContext();
  if (!context.impersonatedByUserId) return afterState ?? null;

  const base = isJsonRecord(afterState) ? afterState : afterState === null || afterState === undefined ? {} : { value: afterState };
  return {
    ...base,
    impersonatedByUserId: context.impersonatedByUserId,
    impersonatedByRole: context.impersonatedByRole ?? 'SUPER_ADMIN',
    impersonatedByEmail: context.impersonatedByEmail ?? null,
    visibleToSuperAdminOnly: true,
  } satisfies Prisma.InputJsonObject;
};

export const createAuditLog = async (payload: AuditCreateInput) => {
  return prisma.auditLog.create({
    data: {
      schoolId: payload.schoolId ?? null,
      actorId: payload.actorId,
      actorRole: payload.actorRole,
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      beforeState: payload.beforeState ?? null,
      afterState: withRequestContextMetadata(payload.afterState),
    },
  });
};

export const queryAuditLogs = async (params: {
  schoolId?: string;
  actorId?: string;
  actorRole?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
  excludeSuperAdminOnly?: boolean;
}) => {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.actorRole ? { actorRole: params.actorRole } : {}),
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.entityId ? { entityId: params.entityId } : {}),
    ...(params.action ? { action: params.action } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
    ...(params.excludeSuperAdminOnly
      ? {
          NOT: [
            { action: 'SCHOOL_ADMIN_IMPERSONATED' },
            { afterState: { path: ['visibleToSuperAdminOnly'], equals: true } },
          ],
        }
      : {}),
  };

  const skip = (params.page - 1) * params.limit;
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.limit,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            schoolId: true,
            teacherProfile: { select: { id: true, firstName: true, lastName: true } },
            parentProfiles: { select: { id: true, firstName: true, lastName: true }, take: 1 },
          },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items,
    page: params.page,
    limit: params.limit,
    total,
    pages: Math.ceil(total / params.limit),
  };
};
