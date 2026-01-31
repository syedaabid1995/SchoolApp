import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const dateSchema = z.coerce.date();

const createSchema = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().min(1),
  startDate: dateSchema,
  endDate: dateSchema,
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  schoolId: z.string().uuid().optional(),
});

export const createTerm = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: payload.academicYearId, schoolId },
    select: { id: true },
  });

  if (!academicYear) {
    throw new HttpError(404, 'Academic year not found');
  }

  const term = await prisma.term.create({
    data: {
      academicYearId: payload.academicYearId,
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
    },
  });

  res.status(201).json(term);
};

export const listTerms = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const academicYearId = req.query.academicYearId as string | undefined;

  const terms = await prisma.term.findMany({
    where: {
      academicYear: { schoolId },
      ...(academicYearId ? { academicYearId } : {}),
    },
    orderBy: { startDate: 'asc' },
  });

  res.status(200).json(terms);
};

export const getTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const term = await prisma.term.findFirst({
    where: { id, academicYear: { schoolId } },
  });

  if (!term) {
    throw new HttpError(404, 'Term not found');
  }

  res.status(200).json(term);
};

export const updateTerm = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.term.findFirst({
    where: { id, academicYear: { schoolId } },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Term not found');
  }

  const term = await prisma.term.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      startDate: payload.startDate ?? undefined,
      endDate: payload.endDate ?? undefined,
    },
  });

  res.status(200).json(term);
};

export const deleteTerm = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.term.findFirst({
    where: { id, academicYear: { schoolId } },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Term not found');
  }

  await prisma.term.delete({ where: { id } });

  res.status(204).send();
};
