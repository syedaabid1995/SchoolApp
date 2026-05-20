import type { Request, Response } from 'express';
import { z } from 'zod';
import type { UserStatus } from '@prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import {
  disableAdminUserMfa,
  forceAdminPasswordReset,
  getAdminUserActivity,
  getAdminUserById,
  getAdminUserSessions,
  getAdminUsersSummary,
  listAdminUsers,
  lockAdminUser,
  revokeAdminUserSessions,
  unlockAdminUser,
  updateAdminUserStatus,
} from '../services/adminUser.service';

const uuidSchema = z.string().uuid();

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(40).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  schoolId: z.string().uuid().optional(),
  mfaEnabled: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : value)),
  locked: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => (typeof value === 'string' ? value === 'true' : value)),
  sortBy: z.enum(['name', 'email', 'role', 'schoolName', 'status', 'lastLoginAt', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional().nullable(),
});

const statusSchema = reasonSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

const actorFromRequest = (req: Request) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  return {
    userId: req.auth.userId,
    role: req.auth.role ?? 'SUPER_ADMIN',
  };
};

export const listAdminUsersApi = async (req: Request, res: Response) => {
  const query = listUsersSchema.parse(req.query);
  const result = await listAdminUsers({
    page: query.page,
    limit: query.limit,
    search: query.search,
    role: query.role,
    status: query.status as UserStatus | undefined,
    schoolId: query.schoolId,
    mfaEnabled: query.mfaEnabled,
    locked: query.locked,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });
  res.status(200).json({ success: true, data: result });
};

export const getAdminUsersSummaryApi = async (_req: Request, res: Response) => {
  const result = await getAdminUsersSummary();
  res.status(200).json({ success: true, data: result });
};

export const getAdminUserByIdApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const result = await getAdminUserById(id);
  res.status(200).json({ success: true, data: result });
};

export const updateAdminUserStatusApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = statusSchema.parse(req.body);
  const result = await updateAdminUserStatus({
    id,
    status: payload.status as UserStatus,
    reason: payload.reason ?? null,
    actor: actorFromRequest(req),
  });
  res.status(200).json({ success: true, data: result });
};

export const lockAdminUserApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = reasonSchema.parse(req.body);
  const result = await lockAdminUser({ id, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data: result });
};

export const unlockAdminUserApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = reasonSchema.parse(req.body);
  const result = await unlockAdminUser({ id, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data: result });
};

export const forceAdminPasswordResetApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = reasonSchema.parse(req.body);
  const result = await forceAdminPasswordReset({ id, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data: result });
};

export const revokeAdminUserSessionsApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = reasonSchema.parse(req.body);
  const result = await revokeAdminUserSessions({ id, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data: result });
};

export const disableAdminUserMfaApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const payload = reasonSchema.parse(req.body);
  const result = await disableAdminUserMfa({ id, reason: payload.reason ?? null, actor: actorFromRequest(req) });
  res.status(200).json({ success: true, data: result });
};

export const getAdminUserActivityApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const result = await getAdminUserActivity(id);
  res.status(200).json({ success: true, data: result });
};

export const getAdminUserSessionsApi = async (req: Request, res: Response) => {
  const id = uuidSchema.parse(req.params.id);
  const result = await getAdminUserSessions(id);
  res.status(200).json({ success: true, data: result });
};
