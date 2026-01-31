import { prisma } from '../config/db';

export type AuditCreateInput = {
  schoolId?: string | null;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
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
      afterState: payload.afterState ?? null,
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
}) => {
  const where = {
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
            teacherProfile: { select: { firstName: true, lastName: true } },
            parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
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
