import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { logAudit } from '../utils/audit';

const createSchema = z.object({
  name: z.string().min(1),
  academicYearId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  academicYearId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createClass = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: payload.academicYearId, schoolId },
    select: { id: true },
  });
  if (!academicYear) {
    throw new HttpError(404, 'Academic year not found');
  }

  try {
    const newClass = await prisma.class.create({
      data: {
        name: payload.name,
        schoolId,
        academicYearId: payload.academicYearId,
      },
    });

    res.status(201).json(newClass);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new HttpError(409, 'Class name already exists for this school');
    }
    throw err;
  }
};

export const listClasses = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
    include: {
      academicYear: { select: { id: true, name: true } },
    },
  });

  res.status(200).json(classes);
};

export const getClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const found = await prisma.class.findFirst({
    where: { id, schoolId },
    include: { academicYear: { select: { id: true, name: true } } },
  });

  if (!found) {
    throw new HttpError(404, 'Class not found');
  }

  res.status(200).json(found);
};

export const updateClass = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.class.findFirst({
    where: { id, schoolId },
    select: { id: true, name: true, academicYearId: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Class not found');
  }

  const updated = await prisma.class.update({
    where: { id },
    data: {
      name: payload.name ?? undefined,
      academicYearId: payload.academicYearId === undefined ? undefined : payload.academicYearId,
    },
  });

  res.status(200).json(updated);
};

export const deleteClass = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.class.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Class not found');
  }

  await prisma.class.delete({ where: { id } });

  await logAudit(req, {
    schoolId,
    entityType: 'CLASS',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  res.status(204).send();
};
