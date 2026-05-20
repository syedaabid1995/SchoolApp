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

const firstHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const getAuditRequestIp = (req?: Request) => {
  if (!req) return null;
  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  const realIp = firstHeaderValue(req.headers['x-real-ip']);
  return forwardedFor?.split(',')[0]?.trim() || realIp?.trim() || req.ip || req.socket.remoteAddress || null;
};

export const getAuditUserAgent = (req?: Request) => {
  if (!req) return null;
  return firstHeaderValue(req.headers['x-original-user-agent']) || firstHeaderValue(req.headers['user-agent']) || null;
};

export const maskEmailForAudit = (value?: string | null) => {
  const email = value?.trim().toLowerCase();
  if (!email) return null;
  const [name, domain] = email.split('@');
  if (!name || !domain) return '***';
  const visible = name.length <= 2 ? name[0] : `${name[0]}${name[name.length - 1]}`;
  return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
};

const unsafeAuditKeyPattern = /(password|rawtoken|refreshtoken|resettoken|tokenhash|authorization|cookie|secret)/i;

const sanitizeAuthAuditValue = (value: unknown): Prisma.InputJsonValue | null => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuthAuditValue(entry)) as Prisma.InputJsonArray;
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, Prisma.InputJsonValue | null>>(
      (result, [key, entry]) => {
        if (unsafeAuditKeyPattern.test(key)) return result;
        result[key] = sanitizeAuthAuditValue(entry);
        return result;
      },
      {},
    );
  }
  return String(value);
};

export const buildAuthAuditMetadata = (
  req?: Request,
  metadata?: Record<string, unknown>,
): Prisma.InputJsonValue => {
  return sanitizeAuthAuditValue({
    ...(metadata ?? {}),
    ipAddress: getAuditRequestIp(req),
    userAgent: getAuditUserAgent(req),
    eventAt: new Date().toISOString(),
  }) as Prisma.InputJsonObject;
};

export const createAuthAuditLog = async (params: {
  req?: Request;
  userId: string;
  schoolId?: string | null;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) => {
  const actorRole = await resolveActorRole(params.userId);
  const log = await createAuditLog({
    schoolId: params.schoolId ?? null,
    actorId: params.userId,
    actorRole,
    entityType: 'AUTH',
    entityId: params.entityId ?? params.userId,
    action: params.action,
    afterState: buildAuthAuditMetadata(params.req, params.metadata),
  });
  await deleteCacheByPattern('cache:audit_logs:*');
  return log;
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
