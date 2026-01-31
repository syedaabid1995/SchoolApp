import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(5).optional().nullable(),
  email: z.string().email().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createParent = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  if (payload.userId) {
    const user = await prisma.user.findFirst({
      where: { id: payload.userId, schoolId },
      select: { id: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }
  }

  const parent = await prisma.parentProfile.create({
    data: {
      schoolId,
      userId: payload.userId ?? null,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
    },
  });

  res.status(201).json(parent);
};

export const listParents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const parents = await prisma.parentProfile.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(parents);
};

export const getParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const parent = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
  });

  if (!parent) {
    throw new HttpError(404, 'Parent not found');
  }

  res.status(200).json(parent);
};

export const updateParent = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  const parent = await prisma.parentProfile.update({
    where: { id },
    data: {
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      phone: payload.phone === undefined ? undefined : payload.phone,
      email: payload.email === undefined ? undefined : payload.email,
      userId: payload.userId === undefined ? undefined : payload.userId,
    },
  });

  res.status(200).json(parent);
};

export const deleteParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  await prisma.parentProfile.delete({ where: { id } });

  res.status(204).send();
};
