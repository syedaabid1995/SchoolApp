import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { exportTenantData, getExportJob } from '../services/dataExport.service';
import { requestDeletion, approveDeletion, executeDeletion, listDeletionJobs } from '../services/dataDeletion.service';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { AuthorizationService } from '../services/authorization.service';
import {
  approveAdminDeletionRequest,
  approveAdminExportRequest,
  getAdminComplianceSummary,
  getAdminDeletionRequestById,
  getAdminExportRequestById,
  getComplianceJobHistory,
  listAdminComplianceJobs,
  listAdminConsentRecords,
  listAdminDeletionRequests,
  listAdminExportRequests,
  rejectAdminDeletionRequest,
  rejectAdminExportRequest,
} from '../services/dataCompliance.service';

const exportSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

const deleteRequestSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().min(1).optional(),
});

const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.string().trim().optional(),
  schoolId: z.string().uuid().optional(),
  query: z.string().trim().max(120).optional(),
});

const noteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

const managedRoles = new Set(['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF']);

const parseAdminListQuery = (query: Request['query']) => adminListQuerySchema.parse(query) as {
  page: number;
  limit: number;
  status?: string;
  schoolId?: string;
  query?: string;
};

const scopeAdminQuery = (req: Request) => {
  const query = parseAdminListQuery(req.query);
  if (req.auth?.schoolId) {
    if (query.schoolId && query.schoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { ...query, schoolId: req.auth.schoolId };
  }
  return query;
};

const requireCompliancePermission = async (req: Request, permissionCode: string) => {
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  if (!auth.schoolId || auth.role === 'SUPER_ADMIN' || !managedRoles.has(auth.role ?? '')) return;
  if (!await AuthorizationService.hasAnyEffectivePermission(auth, permissionCode)) {
    throw new HttpError(403, `Missing required compliance permission: ${permissionCode}`);
  }
};

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

export const getComplianceSummaryApi = async (req: Request, res: Response) => {
  const summary = await getAdminComplianceSummary({ schoolId: req.auth?.schoolId ?? undefined });
  res.status(200).json({ success: true, data: summary });
};

export const listExportRequestsApi = async (req: Request, res: Response) => {
  const query = scopeAdminQuery(req);
  const result = await listAdminExportRequests(query);
  res.status(200).json({ success: true, data: result });
};

export const getExportRequestByIdApi = async (req: Request, res: Response) => {
  const result = await getAdminExportRequestById(req.params.id);
  if (req.auth?.schoolId && result.schoolId !== req.auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
  res.status(200).json({ success: true, data: result });
};

export const approveExportRequestApi = async (req: Request, res: Response) => {
  await requireCompliancePermission(req, P.complianceExportReview);
  const payload = noteSchema.parse(req.body);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const result = await approveAdminExportRequest({
    id: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'SUPER_ADMIN',
    actorSchoolId: auth.schoolId,
    note: payload.note ?? null,
  });
  res.status(200).json({ success: true, data: result });
};

export const rejectExportRequestApi = async (req: Request, res: Response) => {
  await requireCompliancePermission(req, P.complianceExportReview);
  const payload = rejectSchema.parse(req.body);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const result = await rejectAdminExportRequest({
    id: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'SUPER_ADMIN',
    actorSchoolId: auth.schoolId,
    reason: payload.reason,
  });
  res.status(200).json({ success: true, data: result });
};

export const listDeletionRequestsApi = async (req: Request, res: Response) => {
  const query = scopeAdminQuery(req);
  const result = await listAdminDeletionRequests(query);
  res.status(200).json({ success: true, data: result });
};

export const getDeletionRequestByIdApi = async (req: Request, res: Response) => {
  const result = await getAdminDeletionRequestById(req.params.id);
  if (req.auth?.schoolId && result.schoolId !== req.auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
  res.status(200).json({ success: true, data: result });
};

export const approveDeletionRequestApi = async (req: Request, res: Response) => {
  await requireCompliancePermission(req, P.complianceDeletionReview);
  const payload = noteSchema.parse(req.body);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const result = await approveAdminDeletionRequest({
    id: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'SUPER_ADMIN',
    actorSchoolId: auth.schoolId,
    note: payload.note ?? null,
  });
  res.status(200).json({ success: true, data: result });
};

export const rejectDeletionRequestApi = async (req: Request, res: Response) => {
  await requireCompliancePermission(req, P.complianceDeletionReview);
  const payload = rejectSchema.parse(req.body);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const result = await rejectAdminDeletionRequest({
    id: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'SUPER_ADMIN',
    actorSchoolId: auth.schoolId,
    reason: payload.reason,
  });
  res.status(200).json({ success: true, data: result });
};

export const listConsentRecordsApi = async (req: Request, res: Response) => {
  const query = scopeAdminQuery(req);
  const result = await listAdminConsentRecords(query);
  res.status(200).json({ success: true, data: result });
};

export const listComplianceJobsApi = async (req: Request, res: Response) => {
  const query = scopeAdminQuery(req);
  const result = await listAdminComplianceJobs(query);
  res.status(200).json({ success: true, data: result });
};

export const getComplianceJobHistoryApi = async (req: Request, res: Response) => {
  const result = await getComplianceJobHistory({ jobId: req.params.id, actorSchoolId: req.auth?.schoolId });
  res.status(200).json({ success: true, data: result });
};
