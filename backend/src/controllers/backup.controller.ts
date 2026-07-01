import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { createBackup, getBackupDownloadUrl, restoreBackup } from '../services/backup.service';
import { createAuditLog } from '../services/auditLog.service';

const backupSchema = z.object({
  schoolId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000).optional(),
  type: z.string().optional(),
  scope: z.string().optional(),
});

const restoreSchema = z.object({
  backupId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  confirmed: z.boolean().optional(),
});

const listQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().trim().max(200).optional(),
});

const idSchema = z.object({
  id: z.string().uuid(),
});

const isUuid = (value?: string) => Boolean(value && z.string().uuid().safeParse(value).success);

const serviceStatus = {
  backupExecutionImplemented: true,
  restoreExecutionImplemented: true,
  downloadImplemented: true,
  deleteImplemented: false,
  rejectRestoreImplemented: true,
};

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const actorRole = (req: Request) => req.auth?.role ?? 'UNKNOWN';

const mapUser = (user: { id: string; email: string } | null | undefined) =>
  user ? { id: user.id, name: user.email, email: user.email } : null;

const backupInclude = {
  school: { select: { id: true, name: true, code: true } },
  requestedBy: { select: { id: true, email: true } },
};

const restoreInclude = {
  backup: {
    select: {
      id: true,
      schoolId: true,
      school: { select: { id: true, name: true, code: true } },
    },
  },
  requestedBy: { select: { id: true, email: true } },
  approvedBy: { select: { id: true, email: true } },
};

const mapBackup = (backup: any) => ({
  id: backup.id,
  type: 'FULL_DATABASE',
  scope: 'PLATFORM',
  schoolId: backup.schoolId,
  schoolName: backup.school?.name ?? null,
  schoolCode: backup.school?.code ?? null,
  status: backup.status,
  fileSize: null,
  createdBy: mapUser(backup.requestedBy),
  startedAt: backup.startedAt?.toISOString() ?? null,
  completedAt: backup.finishedAt?.toISOString() ?? null,
  createdAt: backup.createdAt.toISOString(),
  updatedAt: backup.updatedAt.toISOString(),
  errorMessage: backup.status === 'FAILED' ? 'Backup failed. Review server logs for details.' : null,
  downloadAvailable: backup.status === 'COMPLETED' && Boolean(backup.storagePath),
  reason: backup.reason ?? null,
});

const mapRestore = (restore: any) => ({
  id: restore.id,
  backupId: restore.backupId,
  scope: 'PLATFORM',
  schoolId: restore.backup?.schoolId ?? null,
  schoolName: restore.backup?.school?.name ?? null,
  schoolCode: restore.backup?.school?.code ?? null,
  status: restore.status,
  requestedBy: mapUser(restore.requestedBy),
  approvedBy: mapUser(restore.approvedBy),
  requestedAt: restore.createdAt.toISOString(),
  approvedAt: restore.approvedById ? restore.updatedAt.toISOString() : null,
  completedAt: restore.finishedAt?.toISOString() ?? null,
  createdAt: restore.createdAt.toISOString(),
  updatedAt: restore.updatedAt.toISOString(),
  errorMessage: restore.status === 'FAILED' ? 'Restore failed. Review server logs for details.' : null,
  reason: restore.reason ?? null,
});

const resolveOptionalSchoolScope = (req: Request, requested?: string) => {
  if (req.auth?.role === 'SUPER_ADMIN') {
    return requested;
  }
  return resolveSchoolId(req, requested ?? req.auth?.schoolId);
};

export const requestBackup = async (req: Request, res: Response) => {
  const payload = backupSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = requireAuth(req);

  const job = await prisma.backupJob.create({
    data: {
      schoolId,
      requestedById: auth.userId,
      reason: payload.reason ?? null,
    },
    include: backupInclude,
  });

  await createAuditLog({
    schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'BackupJob',
    entityId: job.id,
    action: 'BACKUP_REQUESTED',
    afterState: { backupId: job.id, schoolId },
  });

  res.status(201).json(mapBackup(job));
};

export const requestRestore = async (req: Request, res: Response) => {
  const payload = restoreSchema.parse(req.body);
  if (!payload.confirmed) {
    throw new HttpError(400, 'Restore confirmation is required');
  }

  const requestedSchoolId = payload.schoolId;
  const schoolId = resolveSchoolId(req, requestedSchoolId);
  const auth = requireAuth(req);

  const backup = await prisma.backupJob.findFirst({
    where: { id: payload.backupId, schoolId },
  });

  if (!backup) throw new HttpError(404, 'Backup not found');

  const restoreJob = await prisma.restoreJob.create({
    data: {
      backupId: payload.backupId,
      requestedById: auth.userId,
      reason: payload.reason ?? null,
    },
    include: restoreInclude,
  });

  await createAuditLog({
    schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'RestoreJob',
    entityId: restoreJob.id,
    action: 'RESTORE_REQUESTED',
    afterState: { restoreId: restoreJob.id, backupId: payload.backupId },
  });

  res.status(201).json(mapRestore(restoreJob));
};

export const approveRestore = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { id } = idSchema.parse(req.params);
  const requestedSchoolId = req.body.schoolId ?? (req.query.schoolId as string | undefined);
  const schoolId = resolveOptionalSchoolScope(req, requestedSchoolId);

  const restoreJob = await prisma.restoreJob.findFirst({
    where: { id, ...(schoolId ? { backup: { schoolId } } : {}) },
    include: restoreInclude,
  });

  if (!restoreJob) throw new HttpError(404, 'Restore job not found');
  if (restoreJob.status !== 'REQUESTED') throw new HttpError(409, 'Only requested restore jobs can be approved');

  const updated = await prisma.restoreJob.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: auth.userId },
    include: restoreInclude,
  });

  await createAuditLog({
    schoolId: updated.backup.schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'RestoreJob',
    entityId: updated.id,
    action: 'RESTORE_APPROVED',
    beforeState: { status: restoreJob.status },
    afterState: { status: updated.status },
  });

  res.status(200).json(mapRestore(updated));
};

export const rejectRestore = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { id } = idSchema.parse(req.params);
  const payload = z.object({ reason: z.string().trim().min(1).max(1000).optional() }).parse(req.body ?? {});
  const requestedSchoolId = req.body.schoolId ?? (req.query.schoolId as string | undefined);
  const schoolId = resolveOptionalSchoolScope(req, requestedSchoolId);

  const restoreJob = await prisma.restoreJob.findFirst({
    where: { id, ...(schoolId ? { backup: { schoolId } } : {}) },
    include: restoreInclude,
  });

  if (!restoreJob) throw new HttpError(404, 'Restore job not found');
  if (restoreJob.status !== 'REQUESTED') throw new HttpError(409, 'Only requested restore jobs can be rejected');

  const updated = await prisma.restoreJob.update({
    where: { id },
    data: { status: 'REJECTED', reason: payload.reason ?? restoreJob.reason },
    include: restoreInclude,
  });

  await createAuditLog({
    schoolId: updated.backup.schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'RestoreJob',
    entityId: updated.id,
    action: 'RESTORE_REJECTED',
    beforeState: { status: restoreJob.status },
    afterState: { status: updated.status, reason: payload.reason ?? null },
  });

  res.status(200).json(mapRestore(updated));
};

export const runBackup = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { id } = idSchema.parse(req.params);
  const backup = await prisma.backupJob.findUnique({ where: { id }, include: backupInclude });

  if (!backup) throw new HttpError(404, 'Backup not found');
  if (!['REQUESTED', 'FAILED'].includes(backup.status)) throw new HttpError(409, 'Backup cannot be run from its current status');

  try {
    await createBackup({ jobId: backup.id, schoolId: backup.schoolId, requestedBy: auth.userId, reason: backup.reason });
  } catch (error) {
    await createAuditLog({
      schoolId: backup.schoolId,
      actorId: auth.userId,
      actorRole: actorRole(req),
      entityType: 'BackupJob',
      entityId: backup.id,
      action: 'BACKUP_FAILED',
      afterState: { backupId: backup.id, message: error instanceof Error ? error.message : 'unknown_error' },
    });
    throw error;
  }

  const updated = await prisma.backupJob.findUniqueOrThrow({ where: { id }, include: backupInclude });
  await createAuditLog({
    schoolId: updated.schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'BackupJob',
    entityId: updated.id,
    action: 'BACKUP_COMPLETED',
    beforeState: { status: backup.status },
    afterState: { status: updated.status },
  });
  res.status(200).json(mapBackup(updated));
};

export const downloadBackup = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  const downloadUrl = await getBackupDownloadUrl(id);
  res.redirect(302, downloadUrl);
};

export const runRestore = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { id } = idSchema.parse(req.params);
  const restoreJob = await prisma.restoreJob.findUnique({ where: { id }, include: restoreInclude });

  if (!restoreJob) throw new HttpError(404, 'Restore job not found');
  if (restoreJob.status !== 'APPROVED') throw new HttpError(409, 'Restore must be approved before it can run');

  try {
    await restoreBackup({
      jobId: restoreJob.id,
      schoolId: restoreJob.backup.schoolId,
      backupId: restoreJob.backupId,
      requestedBy: auth.userId,
      reason: restoreJob.reason,
    });
  } catch (error) {
    await createAuditLog({
      schoolId: restoreJob.backup.schoolId,
      actorId: auth.userId,
      actorRole: actorRole(req),
      entityType: 'RestoreJob',
      entityId: restoreJob.id,
      action: 'RESTORE_FAILED',
      afterState: { restoreId: restoreJob.id, message: error instanceof Error ? error.message : 'unknown_error' },
    });
    throw error;
  }

  const updated = await prisma.restoreJob.findUniqueOrThrow({ where: { id }, include: restoreInclude });
  await createAuditLog({
    schoolId: updated.backup.schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    entityType: 'RestoreJob',
    entityId: updated.id,
    action: 'RESTORE_COMPLETED',
    beforeState: { status: restoreJob.status },
    afterState: { status: updated.status },
  });
  res.status(200).json(mapRestore(updated));
};

export const listBackups = async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const schoolId = resolveOptionalSchoolScope(req, query.schoolId);

  const backups = await prisma.backupJob.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              ...(isUuid(query.search) ? [{ id: query.search }] : []),
              { school: { name: { contains: query.search, mode: 'insensitive' } } },
              { school: { code: { contains: query.search, mode: 'insensitive' } } },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: backupInclude,
  });

  res.status(200).json({
    items: backups.map(mapBackup),
    total: backups.length,
    serviceStatus,
  });
};

export const getBackup = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  const backup = await prisma.backupJob.findUnique({
    where: { id },
    include: backupInclude,
  });

  if (!backup) throw new HttpError(404, 'Backup not found');

  res.status(200).json(mapBackup(backup));
};

export const listRestores = async (req: Request, res: Response) => {
  const query = listQuerySchema.parse(req.query);
  const schoolId = resolveOptionalSchoolScope(req, query.schoolId);

  const restores = await prisma.restoreJob.findMany({
    where: {
      ...(schoolId ? { backup: { schoolId } } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              ...(isUuid(query.search) ? [{ id: query.search }, { backupId: query.search }] : []),
              { backup: { school: { name: { contains: query.search, mode: 'insensitive' } } } },
              { backup: { school: { code: { contains: query.search, mode: 'insensitive' } } } },
              { reason: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: restoreInclude,
  });

  res.status(200).json({
    items: restores.map(mapRestore),
    total: restores.length,
    serviceStatus,
  });
};

export const getRestore = async (req: Request, res: Response) => {
  const { id } = idSchema.parse(req.params);
  const restore = await prisma.restoreJob.findUnique({
    where: { id },
    include: restoreInclude,
  });

  if (!restore) throw new HttpError(404, 'Restore job not found');

  res.status(200).json(mapRestore(restore));
};
