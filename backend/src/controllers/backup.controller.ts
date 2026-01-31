import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { createBackup, restoreBackup } from '../services/backup.service';

const backupSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().min(1).optional(),
});

const restoreSchema = z.object({
  backupId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
  reason: z.string().min(1).optional(),
});

export const requestBackup = async (req: Request, res: Response) => {
  const payload = backupSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const job = await prisma.backupJob.create({
    data: {
      schoolId,
      requestedById: auth.userId,
      reason: payload.reason ?? null,
    },
  });

  await createBackup({ schoolId, requestedBy: auth.userId, reason: payload.reason ?? null });

  res.status(202).json(job);
};

export const requestRestore = async (req: Request, res: Response) => {
  const payload = restoreSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

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
  });

  await restoreBackup({
    schoolId,
    backupId: payload.backupId,
    requestedBy: auth.userId,
    reason: payload.reason ?? null,
  });

  res.status(202).json(restoreJob);
};

export const approveRestore = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const { id } = req.params;

  const restoreJob = await prisma.restoreJob.findFirst({
    where: { id, backup: { schoolId } },
  });

  if (!restoreJob) throw new HttpError(404, 'Restore job not found');

  const updated = await prisma.restoreJob.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: auth.userId },
  });

  res.status(200).json(updated);
};

export const listBackups = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const backups = await prisma.backupJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(backups);
};

export const listRestores = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const restores = await prisma.restoreJob.findMany({
    where: { backup: { schoolId } },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(restores);
};
