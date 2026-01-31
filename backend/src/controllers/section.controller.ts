import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createSection = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const foundClass = await prisma.class.findFirst({
    where: { id: payload.classId, schoolId },
    select: { id: true },
  });

  if (!foundClass) {
    throw new HttpError(404, 'Class not found');
  }

  const section = await prisma.section.create({
    data: {
      classId: payload.classId,
      name: payload.name,
    },
  });

  res.status(201).json(section);
};

export const listSections = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const classId = req.query.classId as string | undefined;

  const sections = await prisma.section.findMany({
    where: {
      class: { schoolId },
      ...(classId ? { classId } : {}),
    },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(sections);
};

export const getSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const section = await prisma.section.findFirst({
    where: { id, class: { schoolId } },
  });

  if (!section) {
    throw new HttpError(404, 'Section not found');
  }

  res.status(200).json(section);
};

export const updateSection = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.section.findFirst({
    where: { id, class: { schoolId } },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Section not found');
  }

  const section = await prisma.section.update({
    where: { id },
    data: { name: payload.name ?? undefined },
  });

  res.status(200).json(section);
};

export const deleteSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.section.findFirst({
    where: { id, class: { schoolId } },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Section not found');
  }

  await prisma.section.delete({ where: { id } });

  res.status(204).send();
};
