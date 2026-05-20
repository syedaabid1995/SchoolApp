import fs from 'fs/promises';
import path from 'path';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

type AuditSortBy = 'createdAt' | 'event' | 'actorRole' | 'schoolName' | 'severity';
type AuditSortOrder = 'asc' | 'desc';
type AuditFormat = 'csv' | 'json';

type AuditActor = {
  userId: string;
  role?: string | null;
};

export type AuditListParams = {
  page: number;
  limit: number;
  search?: string;
  event?: string;
  action?: string;
  actorId?: string;
  actorRole?: string;
  schoolId?: string;
  targetType?: string;
  targetId?: string;
  severity?: string;
  ipAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: AuditSortBy;
  sortOrder?: AuditSortOrder;
};

export type AuditExportFilters = Omit<AuditListParams, 'page' | 'limit' | 'sortBy' | 'sortOrder'>;

const sensitiveKeyPattern =
  /(password|passwordhash|token|accesstoken|refreshtoken|resettoken|otp|mfa|mfaSecret|totp|totpSecret|backupCode|cookie|authorization|secret|apiKey|privateKey|credential|aws|s3Secret|jwt|session)/i;

const highRiskActions = new Set([
  'LOGIN_FAILED',
  'ACCOUNT_LOCKED',
  'MFA_DISABLED',
  'USER_MFA_DISABLED_BY_ADMIN',
  'ADMIN_USER_STATUS_CHANGED',
  'ADMIN_USER_LOCKED',
  'ADMIN_USER_FORCE_PASSWORD_RESET',
  'USER_SESSIONS_REVOKED',
  'ADMIN_USER_SESSIONS_REVOKED',
  'ADMIN_USER_MFA_DISABLED',
  'SUBSCRIPTION_CANCELLED',
  'BACKUP_DOWNLOAD_REQUESTED',
  'RESTORE_APPROVED',
  'DATA_EXPORT_REQUEST_APPROVED',
  'DATA_DELETION_REQUEST_APPROVED',
  'FEATURE_FLAG_UPDATED',
  'CONFIG_UPDATED',
  'THEME_UPDATED',
  'LOGIN_BRANDING_UPDATED',
  'IMPERSONATION_STARTED',
  'SUPER_ADMIN_ROUTE_ACCESS_DENIED',
  'AUDIT_LOG_EXPORT_REQUESTED',
  'AUDIT_LOG_EXPORT_DOWNLOADED',
]);

const criticalActions = new Set([
  'DATA_DELETION_REQUEST_APPROVED',
  'RESTORE_APPROVED',
  'BACKUP_DOWNLOAD_REQUESTED',
  'IMPERSONATION_STARTED',
]);

const mediumActionPattern = /(UPDATE|CREATE|DELETE|APPROVE|REJECT|RESET|SUSPEND|CANCEL|BACKUP|RESTORE|EXPORT|IMPORT)/i;

export const severityForAction = (action: string) => {
  if (criticalActions.has(action)) return 'CRITICAL';
  if (highRiskActions.has(action)) return 'HIGH';
  if (mediumActionPattern.test(action)) return 'MEDIUM';
  return 'LOW';
};

const truncate = (value: string, max = 300) => (value.length > max ? `${value.slice(0, max)}...` : value);

export const sanitizeAuditMetadata = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return '[TRUNCATED]';
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return truncate(value, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((entry) => sanitizeAuditMetadata(entry, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, entry]) => {
      if (sensitiveKeyPattern.test(key)) {
        result[key] = '[REDACTED]';
        return result;
      }
      result[key] = sanitizeAuditMetadata(entry, depth + 1);
      return result;
    }, {});
  }
  return String(value);
};

const maskIpAddress = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  if (value.includes(':')) return `${value.split(':').slice(0, 3).join(':')}::`;
  return 'masked';
};

const metadataObject = (log: { beforeState?: unknown; afterState?: unknown }) => {
  const beforeState = sanitizeAuditMetadata(log.beforeState);
  const afterState = sanitizeAuditMetadata(log.afterState);
  return { beforeState, afterState };
};

const getValueFromMetadata = (value: unknown, key: string): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === 'string') return direct;
  for (const entry of Object.values(record)) {
    const nested = getValueFromMetadata(entry, key);
    if (nested) return nested;
  }
  return null;
};

const metadataSummary = (metadata: unknown) => {
  if (!metadata || typeof metadata !== 'object') return null;
  const text = JSON.stringify(metadata);
  return truncate(text.replace(/[{}"]/g, '').replace(/,/g, ', '), 220);
};

type AuditRecord = Prisma.AuditLogGetPayload<{
  include: {
    actor: {
      select: {
        id: true;
        email: true;
        schoolId: true;
        teacherProfile: { select: { id: true; firstName: true; lastName: true } };
        parentProfiles: { select: { id: true; firstName: true; lastName: true } };
      };
    };
  };
}>;

const actorName = (actor: AuditRecord['actor']) => {
  if (actor.teacherProfile) {
    return `${actor.teacherProfile.firstName} ${actor.teacherProfile.lastName}`.trim();
  }
  const parent = actor.parentProfiles[0];
  if (parent) {
    return `${parent.firstName} ${parent.lastName}`.trim();
  }
  return actor.email;
};

const schoolMapFor = async (logs: Array<{ schoolId: string | null }>) => {
  const ids = Array.from(new Set(logs.map((log) => log.schoolId).filter(Boolean))) as string[];
  if (!ids.length) return new Map<string, { id: string; name: string; code: string }>();
  const schools = await prisma.school.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, code: true },
  });
  return new Map(schools.map((school) => [school.id, school]));
};

const mapAuditLog = (log: AuditRecord, schoolMap: Map<string, { id: string; name: string; code: string }>) => {
  const metadata = metadataObject(log);
  const ipAddress =
    getValueFromMetadata(metadata.afterState, 'ipAddress') || getValueFromMetadata(metadata.beforeState, 'ipAddress');
  const userAgent =
    getValueFromMetadata(metadata.afterState, 'userAgent') || getValueFromMetadata(metadata.beforeState, 'userAgent');
  const school = log.schoolId ? schoolMap.get(log.schoolId) : null;
  const severity = severityForAction(log.action);
  return {
    id: log.id,
    event: log.action,
    action: log.action,
    severity,
    schoolId: log.schoolId,
    schoolName: school?.name ?? null,
    actor: {
      id: log.actor.id,
      name: actorName(log.actor),
      email: log.actor.email,
      role: log.actorRole,
    },
    targetType: log.entityType,
    targetId: log.entityId,
    ipAddress: maskIpAddress(ipAddress),
    userAgent: userAgent ? truncate(userAgent, 180) : null,
    metadataSummary: metadataSummary(metadata),
    createdAt: log.createdAt,
  };
};

const buildAuditWhere = (params: AuditListParams | AuditExportFilters): Prisma.AuditLogWhereInput => {
  const search = params.search?.trim();
  const action = params.event || params.action;
  return {
    ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
    ...(params.actorRole ? { actorRole: params.actorRole } : {}),
    ...(params.targetType ? { entityType: params.targetType } : {}),
    ...(params.targetId ? { entityId: params.targetId } : {}),
    ...(action ? { action } : {}),
    ...(params.dateFrom || params.dateTo
      ? {
          createdAt: {
            ...(params.dateFrom ? { gte: params.dateFrom } : {}),
            ...(params.dateTo ? { lte: params.dateTo } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { entityType: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
            { actor: { is: { email: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
};

const orderByFor = (sortBy?: AuditSortBy, sortOrder: AuditSortOrder = 'desc'): Prisma.AuditLogOrderByWithRelationInput => {
  if (sortBy === 'event') return { action: sortOrder };
  if (sortBy === 'actorRole') return { actorRole: sortOrder };
  return { createdAt: sortOrder };
};

const fetchAuditLogs = async (params: AuditListParams | (AuditExportFilters & { limit?: number })) => {
  const where = buildAuditWhere(params);
  const take = 'limit' in params && params.limit ? Math.min(params.limit, 50_000) : 5_000;
  const logs = await prisma.auditLog.findMany({
    where,
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
    orderBy: orderByFor('sortBy' in params ? params.sortBy : 'createdAt', 'sortOrder' in params ? params.sortOrder : 'desc'),
    take,
  });
  const schoolMap = await schoolMapFor(logs);
  return logs.map((log) => mapAuditLog(log, schoolMap));
};

const applyCalculatedFilters = (
  items: Awaited<ReturnType<typeof fetchAuditLogs>>,
  params: Pick<AuditListParams, 'severity' | 'ipAddress'>,
) =>
  items.filter((log) => {
    if (params.severity && log.severity !== params.severity) return false;
    if (params.ipAddress && !(log.ipAddress ?? '').includes(params.ipAddress)) return false;
    return true;
  });

export const listAdvancedAuditLogs = async (params: AuditListParams) => {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100);
  const requiresCalculatedFilter = Boolean(params.severity || params.ipAddress || params.sortBy === 'severity' || params.sortBy === 'schoolName');

  if (requiresCalculatedFilter) {
    const all = await fetchAuditLogs({ ...params, limit: 5_000 });
    const filtered = applyCalculatedFilters(all, params);
    const sorted =
      params.sortBy === 'severity'
        ? filtered.sort((a, b) => String(a.severity).localeCompare(String(b.severity)) * (params.sortOrder === 'asc' ? 1 : -1))
        : params.sortBy === 'schoolName'
          ? filtered.sort((a, b) => String(a.schoolName ?? '').localeCompare(String(b.schoolName ?? '')) * (params.sortOrder === 'desc' ? -1 : 1))
          : filtered;
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      pagination: { page, limit, total: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / limit)) },
    };
  }

  const where = buildAuditWhere(params);
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
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
      orderBy: orderByFor(params.sortBy, params.sortOrder),
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const schoolMap = await schoolMapFor(logs);
  return {
    items: logs.map((log) => mapAuditLog(log, schoolMap)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getAuditSummary = async () => {
  const today = startOfToday();
  const [total, todayCount, todayByAction, exportsToday, topEvents] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: today } },
      _count: { action: true },
    }),
    prisma.auditExport.count({ where: { createdAt: { gte: today } } }),
    prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
  ]);
  const severityCounts = todayByAction.reduce(
    (result, log) => {
      const severity = severityForAction(log.action).toLowerCase() as keyof typeof result;
      result[severity] += log._count.action;
      return result;
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  );
  return {
    total,
    today: todayCount,
    highRiskToday: todayByAction.reduce(
      (sum, log) => sum + (['HIGH', 'CRITICAL'].includes(severityForAction(log.action)) ? log._count.action : 0),
      0,
    ),
    failedLoginsToday: todayByAction.reduce((sum, log) => sum + (log.action === 'LOGIN_FAILED' ? log._count.action : 0), 0),
    securityEventsToday: todayByAction.reduce(
      (sum, log) => sum + (/LOGIN|MFA|PASSWORD|LOCK|SESSION|TOKEN/i.test(log.action) ? log._count.action : 0),
      0,
    ),
    adminActionsToday: todayByAction.reduce(
      (sum, log) => sum + (/ADMIN|SUPER_ADMIN|CONFIG|FEATURE|SUBSCRIPTION/i.test(log.action) ? log._count.action : 0),
      0,
    ),
    exportsToday,
    bySeverity: severityCounts,
    byEvent: topEvents.map((entry) => ({ event: entry.action, count: entry._count.action })),
  };
};

export const listHighRiskAuditLogs = async (params: { dateFrom?: Date; dateTo?: Date; limit: number }) => {
  const items = await fetchAuditLogs({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    limit: 5_000,
  });
  return {
    items: items.filter((item) => ['HIGH', 'CRITICAL'].includes(item.severity)).slice(0, params.limit),
  };
};

export const getAuditLogDetail = async (id: string) => {
  const log = await prisma.auditLog.findUnique({
    where: { id },
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
  });
  if (!log) {
    throw new HttpError(404, 'Audit log not found');
  }
  const schoolMap = await schoolMapFor([log]);
  return {
    ...mapAuditLog(log, schoolMap),
    school: log.schoolId ? schoolMap.get(log.schoolId) ?? null : null,
    metadata: metadataObject(log) as Record<string, unknown>,
  };
};

const ensureExportDateRange = (filters: AuditExportFilters) => {
  const now = new Date();
  const dateTo = filters.dateTo ?? now;
  const dateFrom = filters.dateFrom ?? new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (dateFrom > dateTo) {
    throw new HttpError(400, 'dateFrom must be before dateTo');
  }
  const days = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000));
  if (days > 90) {
    throw new HttpError(400, 'Audit export date range cannot exceed 90 days');
  }
  return { ...filters, dateFrom, dateTo };
};

const exportBaseDir = () => path.join(process.cwd(), 'exports', 'audit');

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (items: Awaited<ReturnType<typeof fetchAuditLogs>>) => {
  const headers = [
    'id',
    'event',
    'severity',
    'schoolId',
    'schoolName',
    'actorId',
    'actorName',
    'actorEmail',
    'actorRole',
    'targetType',
    'targetId',
    'ipAddress',
    'userAgent',
    'metadataSummary',
    'createdAt',
  ];
  const rows = items.map((item) => [
    item.id,
    item.event,
    item.severity,
    item.schoolId,
    item.schoolName,
    item.actor?.id,
    item.actor?.name,
    item.actor?.email,
    item.actor?.role,
    item.targetType,
    item.targetId,
    item.ipAddress,
    item.userAgent,
    item.metadataSummary,
    item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
};

export const requestAuditExport = async (params: {
  format: AuditFormat;
  filters: AuditExportFilters;
  reason: string;
  actor: AuditActor;
}) => {
  const filters = ensureExportDateRange(params.filters);
  const filtersJson = {
    ...filters,
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
  };
  const exportRow = await prisma.auditExport.create({
    data: {
      requestedById: params.actor.userId,
      schoolId: filters.schoolId ?? null,
      format: params.format,
      filters: filtersJson as Prisma.InputJsonObject,
      reason: params.reason,
      status: 'RUNNING',
    },
  });
  await createAuditLog({
    schoolId: filters.schoolId ?? null,
    actorId: params.actor.userId,
    actorRole: params.actor.role ?? 'SUPER_ADMIN',
    entityType: 'AUDIT_EXPORT',
    entityId: exportRow.id,
    action: 'AUDIT_LOG_EXPORT_REQUESTED',
    afterState: {
      format: params.format,
      filters: sanitizeAuditMetadata(filtersJson) as Prisma.InputJsonValue,
      reason: params.reason,
    },
  });

  try {
    const items = applyCalculatedFilters(await fetchAuditLogs({ ...filters, limit: 50_000 }), filters);
    await fs.mkdir(exportBaseDir(), { recursive: true });
    const fileName = `${exportRow.id}.${params.format}`;
    const fileKey = path.join('audit', fileName);
    const filePath = path.join(exportBaseDir(), fileName);
    const content =
      params.format === 'json'
        ? JSON.stringify(
            items.map((item) => ({ ...item, createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt })),
            null,
            2,
          )
        : toCsv(items);
    await fs.writeFile(filePath, content, 'utf8');
    const updated = await prisma.auditExport.update({
      where: { id: exportRow.id },
      data: {
        status: 'COMPLETED',
        rowCount: items.length,
        fileKey,
        completedAt: new Date(),
      },
    });
    await createAuditLog({
      schoolId: filters.schoolId ?? null,
      actorId: params.actor.userId,
      actorRole: params.actor.role ?? 'SUPER_ADMIN',
      entityType: 'AUDIT_EXPORT',
      entityId: exportRow.id,
      action: 'AUDIT_LOG_EXPORT_COMPLETED',
      afterState: { format: params.format, rowCount: items.length },
    });
    return {
      exportId: updated.id,
      status: updated.status,
      format: updated.format,
      downloadAvailable: true,
      message: 'Audit export completed.',
    };
  } catch (error) {
    await prisma.auditExport.update({
      where: { id: exportRow.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? truncate(error.message, 500) : 'Export failed',
        completedAt: new Date(),
      },
    });
    await createAuditLog({
      schoolId: filters.schoolId ?? null,
      actorId: params.actor.userId,
      actorRole: params.actor.role ?? 'SUPER_ADMIN',
      entityType: 'AUDIT_EXPORT',
      entityId: exportRow.id,
      action: 'AUDIT_LOG_EXPORT_FAILED',
      afterState: { format: params.format },
    });
    throw error;
  }
};

const mapAuditExport = (entry: Prisma.AuditExportGetPayload<{ include: { requestedBy: true; school: true } }>) => ({
  id: entry.id,
  format: entry.format,
  status: entry.status,
  rowCount: entry.rowCount,
  requestedBy: {
    id: entry.requestedBy.id,
    name: entry.requestedBy.email,
  },
  schoolId: entry.schoolId,
  schoolName: entry.school?.name ?? null,
  reason: entry.reason,
  createdAt: entry.createdAt,
  completedAt: entry.completedAt,
  downloadAvailable: entry.status === 'COMPLETED' && Boolean(entry.fileKey),
});

export const listAuditExports = async (params: {
  page: number;
  limit: number;
  status?: string;
  format?: string;
  requestedById?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) => {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100);
  const where: Prisma.AuditExportWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.format ? { format: params.format } : {}),
    ...(params.requestedById ? { requestedById: params.requestedById } : {}),
    ...(params.dateFrom || params.dateTo
      ? { createdAt: { ...(params.dateFrom ? { gte: params.dateFrom } : {}), ...(params.dateTo ? { lte: params.dateTo } : {}) } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditExport.findMany({
      where,
      include: { requestedBy: true, school: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditExport.count({ where }),
  ]);
  return {
    items: items.map(mapAuditExport),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

export const getAuditExportById = async (id: string) => {
  const entry = await prisma.auditExport.findUnique({
    where: { id },
    include: { requestedBy: true, school: true },
  });
  if (!entry) {
    throw new HttpError(404, 'Audit export not found');
  }
  return mapAuditExport(entry);
};

export const getAuditExportDownload = async (id: string, actor: AuditActor) => {
  const entry = await prisma.auditExport.findUnique({ where: { id } });
  if (!entry) {
    throw new HttpError(404, 'Audit export not found');
  }
  if (entry.status !== 'COMPLETED' || !entry.fileKey) {
    throw new HttpError(400, 'Audit export is not ready for download');
  }
  const fileName = path.basename(entry.fileKey);
  const filePath = path.join(exportBaseDir(), fileName);
  try {
    await fs.access(filePath);
  } catch {
    throw new HttpError(404, 'Audit export file is missing');
  }
  await createAuditLog({
    schoolId: entry.schoolId ?? null,
    actorId: actor.userId,
    actorRole: actor.role ?? 'SUPER_ADMIN',
    entityType: 'AUDIT_EXPORT',
    entityId: entry.id,
    action: 'AUDIT_LOG_EXPORT_DOWNLOADED',
    afterState: { format: entry.format, rowCount: entry.rowCount },
  });
  return {
    filePath,
    fileName,
    contentType: entry.format === 'json' ? 'application/json' : 'text/csv',
  };
};
