import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createSchool,
  createSchoolAdmin,
  listSchoolAdmins,
  setSchoolAdminStatus,
  listSchools,
  updateSchool,
  setSchoolStatus,
  softDeleteSchool,
} from '../services/schoolAdmin.service';
import { logAudit } from '../utils/audit';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  subscriptionPlan: z.enum(['STARTER', 'STANDARD', 'PREMIUM']),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  adminEmail: z.string().email().optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  query: z.string().min(1).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  subscriptionPlan: z.enum(['STARTER', 'STANDARD', 'PREMIUM']).optional(),
  statusReason: z.string().min(1).nullable().optional(),
  lastLoginAt: z.coerce.date().nullable().optional(),
  activeUsersCount: z.number().int().min(0).optional(),
});

const statusSchema = z.object({
  reason: z.string().min(1).nullable().optional(),
});

const createSchoolAdminSchema = z.object({
  adminEmail: z.string().email(),
});

const schoolAdminStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export const createSchoolApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const result = await createSchool(payload);
  if (result.adminUser) {
    await logAudit(req, {
      schoolId: result.school.id,
      entityType: 'USER',
      entityId: result.adminUser.id,
      action: 'SCHOOL_ADMIN_CREATED',
      afterState: { email: result.adminUser.email, status: result.adminUser.status },
    });
  }
  res.status(201).json(result);
};

export const listSchoolsApi = async (req: Request, res: Response) => {
  const payload = listSchema.parse(req.query);
  const result = await listSchools(payload);
  res.status(200).json(result);
};

export const listSchoolAdminsApi = async (req: Request, res: Response) => {
  const result = await listSchoolAdmins(req.params.id);
  res.status(200).json(result);
};

export const updateSchoolApi = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const school = await updateSchool(req.params.id, payload);
  res.status(200).json(school);
};

export const activateSchoolApi = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const school = await setSchoolStatus(req.params.id, 'ACTIVE', payload.reason ?? null);
  res.status(200).json(school);
};

export const suspendSchoolApi = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const school = await setSchoolStatus(req.params.id, 'SUSPENDED', payload.reason ?? null);
  res.status(200).json(school);
};

export const deleteSchoolApi = async (req: Request, res: Response) => {
  const school = await softDeleteSchool(req.params.id);
  res.status(200).json(school);
};

export const createSchoolAdminApi = async (req: Request, res: Response) => {
  const payload = createSchoolAdminSchema.parse(req.body);
  const result = await createSchoolAdmin(req.params.id, payload.adminEmail);
  await logAudit(req, {
    schoolId: req.params.id,
    entityType: 'USER',
    entityId: result.adminUser.id,
    action: 'SCHOOL_ADMIN_CREATED',
    afterState: { email: result.adminUser.email, status: result.adminUser.status },
  });
  res.status(201).json(result);
};

export const setSchoolAdminStatusApi = async (req: Request, res: Response) => {
  const payload = schoolAdminStatusSchema.parse(req.body);
  const updated = await setSchoolAdminStatus(req.params.id, req.params.adminId, payload.status);
  await logAudit(req, {
    schoolId: req.params.id,
    entityType: 'USER',
    entityId: updated.id,
    action: 'SCHOOL_ADMIN_STATUS_UPDATED',
    afterState: { status: updated.status },
  });
  res.status(200).json(updated);
};
