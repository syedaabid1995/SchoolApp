import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createSubject = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const subject = await prisma.subject.create({
    data: {
      name: payload.name,
      code: payload.code ?? null,
      schoolId,
    },
  });

  res.status(201).json(subject);
};

export const listSubjects = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(subjects);
};

export const getSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const subject = await prisma.subject.findFirst({
    where: { id, schoolId },
  });

  if (!subject) {
    throw new HttpError(404, 'Subject not found');
  }

  res.status(200).json(subject);
};

export const updateSubject = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.subject.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Subject not found');
  }

  const subject = await prisma.subject.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      code: payload.code === undefined ? undefined : payload.code,
    },
  });

  res.status(200).json(subject);
};

export const deleteSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.subject.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Subject not found');
  }

  await prisma.subject.delete({ where: { id } });

  res.status(204).send();
};
