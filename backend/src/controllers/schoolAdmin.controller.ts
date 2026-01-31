import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  createSchool,
  listSchools,
  updateSchool,
  setSchoolStatus,
  softDeleteSchool,
} from '../services/schoolAdmin.service';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  subscriptionPlan: z.string().min(1),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  query: z.string().min(1).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  subscriptionPlan: z.string().min(1).optional(),
  statusReason: z.string().min(1).nullable().optional(),
  lastLoginAt: z.coerce.date().nullable().optional(),
  activeUsersCount: z.number().int().min(0).optional(),
});

const statusSchema = z.object({
  reason: z.string().min(1).nullable().optional(),
});

export const createSchoolApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const school = await createSchool(payload);
  res.status(201).json(school);
};

export const listSchoolsApi = async (req: Request, res: Response) => {
  const payload = listSchema.parse(req.query);
  const result = await listSchools(payload);
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
