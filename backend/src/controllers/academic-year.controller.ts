import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const dateSchema = z.coerce.date();

const createSchema = z.object({
  name: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  isActive: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  isActive: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

export const createAcademicYear = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const academicYear = await prisma.academicYear.create({
    data: {
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      isActive: payload.isActive ?? false,
      schoolId,
    },
  });

  res.status(201).json(academicYear);
};

export const listAcademicYears = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const items = await prisma.academicYear.findMany({
    where: { schoolId },
    orderBy: { startDate: 'desc' },
  });

  res.status(200).json(items);
};

export const getAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const academicYear = await prisma.academicYear.findFirst({
    where: { id, schoolId },
  });

  if (!academicYear) {
    throw new HttpError(404, 'Academic year not found');
  }

  res.status(200).json(academicYear);
};

export const updateAcademicYear = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.academicYear.findFirst({
    where: { id, schoolId },
  });

  if (!existing) {
    throw new HttpError(404, 'Academic year not found');
  }

  const academicYear = await prisma.academicYear.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      startDate: payload.startDate ?? undefined,
      endDate: payload.endDate ?? undefined,
      isActive: payload.isActive ?? undefined,
    },
  });

  res.status(200).json(academicYear);
};

export const deleteAcademicYear = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.academicYear.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Academic year not found');
  }

  await prisma.academicYear.delete({ where: { id } });

  res.status(204).send();
};
