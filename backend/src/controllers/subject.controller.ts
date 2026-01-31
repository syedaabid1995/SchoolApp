import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  classId: z.string().uuid().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createSubject = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  if (payload.classId) {
    const foundClass = await prisma.class.findFirst({
      where: { id: payload.classId, schoolId },
      select: { id: true },
    });
    if (!foundClass) {
      throw new HttpError(404, 'Class not found');
    }
  }

  if (payload.academicYearId) {
    const foundYear = await prisma.academicYear.findFirst({
      where: { id: payload.academicYearId, schoolId },
      select: { id: true },
    });
    if (!foundYear) {
      throw new HttpError(404, 'Academic year not found');
    }
  }

  const subject = await prisma.subject.create({
    data: {
      name: payload.name,
      code: payload.code ?? null,
      schoolId,
      classId: payload.classId ?? null,
      academicYearId: payload.academicYearId ?? null,
    },
  });

  res.status(201).json(subject);
};

export const listSubjects = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
    include: {
      class: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
  });

  res.status(200).json(subjects);
};

export const getSubject = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const subject = await prisma.subject.findFirst({
    where: { id, schoolId },
    include: {
      class: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
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
      classId: payload.classId === undefined ? undefined : payload.classId,
      academicYearId: payload.academicYearId === undefined ? undefined : payload.academicYearId,
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
