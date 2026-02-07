import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

const defaultExamTypes = [
  { code: 'MIDTERM', name: 'Mid Term' },
  { code: 'QUIZ', name: 'Unit Test' },
  { code: 'ASSIGNMENT', name: 'Monthly' },
  { code: 'FINAL', name: 'Final' },
];

const ensureDefaultExamTypes = async (schoolId: string) => {
  const count = await prisma.examTypeConfig.count({ where: { schoolId } });
  if (count > 0) return;
  await prisma.examTypeConfig.createMany({
    data: defaultExamTypes.map((item) => ({
      schoolId,
      code: item.code,
      name: item.name,
      isActive: true,
    })),
    skipDuplicates: true,
  });
};

export const listExamTypes = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  await ensureDefaultExamTypes(schoolId);
  const activeOnly = req.query.activeOnly === 'true';
  const items = await prisma.examTypeConfig.findMany({
    where: { schoolId, ...(activeOnly ? { isActive: true } : {}) },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  res.status(200).json(items);
};

export const createExamType = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const code = payload.code.trim().toUpperCase();
  const existing = await prisma.examTypeConfig.findFirst({
    where: { schoolId, code },
  });
  if (existing) {
    throw new HttpError(409, 'Exam type code already exists');
  }
  const examType = await prisma.examTypeConfig.create({
    data: {
      schoolId,
      code,
      name: payload.name.trim(),
      isActive: payload.isActive ?? true,
    },
  });
  res.status(201).json(examType);
};

export const updateExamType = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.examTypeConfig.findFirst({
    where: { id, schoolId },
  });
  if (!existing) {
    throw new HttpError(404, 'Exam type not found');
  }

  const examType = await prisma.examTypeConfig.update({
    where: { id },
    data: {
      name: payload.name?.trim() ?? undefined,
      isActive: payload.isActive ?? undefined,
    },
  });

  res.status(200).json(examType);
};
