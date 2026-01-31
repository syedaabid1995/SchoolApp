import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT']),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  scheduledAt: z.coerce.date().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  termId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).optional(),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createExam = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: payload.academicYearId, schoolId },
    select: { id: true },
  });

  if (!academicYear) {
    throw new HttpError(404, 'Academic year not found');
  }

  if (payload.termId) {
    const term = await prisma.term.findFirst({
      where: { id: payload.termId, academicYearId: payload.academicYearId },
      select: { id: true },
    });
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }
  }

  const exam = await prisma.exam.create({
    data: {
      schoolId,
      academicYearId: payload.academicYearId,
      termId: payload.termId ?? null,
      name: payload.name,
      type: payload.type,
      status: payload.status ?? 'DRAFT',
      scheduledAt: payload.scheduledAt ?? null,
    },
  });

  res.status(201).json(exam);
};

export const listExams = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const academicYearId = req.query.academicYearId as string | undefined;
  const termId = req.query.termId as string | undefined;

  const exams = await prisma.exam.findMany({
    where: {
      schoolId,
      ...(academicYearId ? { academicYearId } : {}),
      ...(termId ? { termId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(exams);
};

export const getExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const exam = await prisma.exam.findFirst({
    where: { id, schoolId },
    include: { papers: true },
  });

  if (!exam) {
    throw new HttpError(404, 'Exam not found');
  }

  res.status(200).json(exam);
};

export const updateExam = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.exam.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Exam not found');
  }

  const exam = await prisma.exam.update({
    where: { id },
    data: {
      termId: payload.termId === undefined ? undefined : payload.termId,
      name: payload.name ?? undefined,
      type: payload.type ?? undefined,
      status: payload.status ?? undefined,
      scheduledAt: payload.scheduledAt === undefined ? undefined : payload.scheduledAt,
    },
  });

  res.status(200).json(exam);
};

export const deleteExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.exam.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Exam not found');
  }

  await prisma.exam.delete({ where: { id } });

  res.status(204).send();
};
