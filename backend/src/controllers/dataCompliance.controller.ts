import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { exportTenantData, getExportJob } from '../services/dataExport.service';
import { requestDeletion, approveDeletion, executeDeletion, listDeletionJobs } from '../services/dataDeletion.service';

const exportSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

const deleteRequestSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().min(1).optional(),
});

export const requestExport = async (req: Request, res: Response) => {
  const payload = exportSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const result = await exportTenantData({
    schoolId,
    requestedById: auth.userId,
    actorRole: 'SCHOOL_ADMIN',
  });

  res.status(202).json(result);
};

export const getExportStatus = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const job = await getExportJob(req.params.id, schoolId);
  res.status(200).json(job);
};

export const requestDeletionApi = async (req: Request, res: Response) => {
  const payload = deleteRequestSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const job = await requestDeletion({ schoolId, requestedById: auth.userId, reason: payload.reason ?? null });
  res.status(202).json(job);
};

export const approveDeletionApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const job = await approveDeletion({
    jobId: req.params.id,
    schoolId,
    approvedById: auth.userId,
  });

  res.status(200).json(job);
};

export const executeDeletionApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.body.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const result = await executeDeletion({
    jobId: req.params.id,
    schoolId,
    actorId: auth.userId,
    actorRole: 'SUPER_ADMIN',
  });

  res.status(200).json(result);
};

export const listDeletionJobsApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const jobs = await listDeletionJobs(schoolId);
  res.status(200).json(jobs);
};
