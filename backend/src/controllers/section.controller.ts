import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { logAudit } from '../utils/audit';

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

  const normalizedName = payload.name.trim().replace(/\s+/g, ' ');
  const duplicate = await prisma.section.findFirst({
    where: { schoolId, name: { equals: normalizedName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) {
    throw new HttpError(409, 'Section name already exists for this school');
  }

  const section = await prisma.section.create({
    data: {
      name: normalizedName,
      school: { connect: { id: schoolId } },
      class: { connect: { id: payload.classId } },
    },
  });

  await prisma.classSection.upsert({
    where: {
      classId_sectionId: {
        classId: payload.classId,
        sectionId: section.id,
      },
    },
    update: {},
    create: {
      schoolId,
      classId: payload.classId,
      sectionId: section.id,
    },
  });

  res.status(201).json(section);
};

export const listSections = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const classId = req.query.classId as string | undefined;

  const sections = await prisma.section.findMany({
    where: {
      schoolId,
      ...(classId
        ? {
            OR: [
              { classId },
              { classSections: { some: { classId, schoolId } } },
            ],
          }
        : {}),
    },
    include: {
      classSections: { select: { classId: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(
    sections.map((section) => ({
      ...section,
      classId: classId ?? section.classId ?? section.classSections[0]?.classId ?? null,
    })),
  );
};

export const getSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const section = await prisma.section.findFirst({
    where: { id, schoolId },
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
    where: { id, schoolId },
    select: { id: true, name: true, classId: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Section not found');
  }

  if (payload.name) {
    const normalizedName = payload.name.trim().replace(/\s+/g, ' ');
    const duplicate = await prisma.section.findFirst({
      where: { schoolId, id: { not: id }, name: { equals: normalizedName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) {
      throw new HttpError(409, 'Section name already exists for this school');
    }
  }

  const section = await prisma.section.update({
    where: { id },
    data: { name: payload.name ? payload.name.trim().replace(/\s+/g, ' ') : undefined },
  });

  res.status(200).json(section);
};

export const deleteSection = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.section.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { students: true, classSections: true } } },
  });

  if (!existing) {
    throw new HttpError(404, 'Section not found');
  }

  if (existing._count.students > 0 || existing._count.classSections > 0) {
    throw new HttpError(409, 'Cannot delete section while linked with class or students');
  }

  await prisma.section.delete({ where: { id } });

  await logAudit(req, {
    schoolId,
    entityType: 'SECTION',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  res.status(204).send();
};
