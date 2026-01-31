import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { incrementUsage, enforceLimits } from '../services/subscription.service';

const createSchema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.coerce.date().optional(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  admissionNo: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  dob: z.coerce.date().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

const linkParentSchema = z.object({
  parentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(['TRANSFERRED', 'EXITED']),
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createStudent = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  await enforceLimits(schoolId, 'students');

  const student = await prisma.student.create({
    data: {
      admissionNo: payload.admissionNo,
      firstName: payload.firstName,
      lastName: payload.lastName,
      dob: payload.dob ?? null,
      classId: payload.classId ?? null,
      sectionId: payload.sectionId ?? null,
      schoolId,
    },
  });

  await incrementUsage(schoolId, 'students', 1);

  await prisma.studentStatusHistory.create({
    data: {
      studentId: student.id,
      status: 'ENROLLED',
      reason: 'Initial enrollment',
    },
  });

  res.status(201).json(student);
};

export const listStudents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const status = req.query.status as string | undefined;

  const students = await prisma.student.findMany({
    where: {
      schoolId,
      ...(status ? { status: status as 'ENROLLED' | 'TRANSFERRED' | 'EXITED' } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(students);
};

export const getStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    include: {
      parentLinks: { include: { parent: true } },
      statusEvents: { orderBy: { changedAt: 'desc' } },
    },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  res.status(200).json(student);
};

export const updateStudent = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Student not found');
  }

  const student = await prisma.student.update({
    where: { id },
    data: {
      admissionNo: payload.admissionNo ?? undefined,
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      dob: payload.dob === undefined ? undefined : payload.dob,
      classId: payload.classId === undefined ? undefined : payload.classId,
      sectionId: payload.sectionId === undefined ? undefined : payload.sectionId,
    },
  });

  res.status(200).json(student);
};

export const linkParent = async (req: Request, res: Response) => {
  const payload = linkParentSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const parent = await prisma.parentProfile.findFirst({
    where: { id: payload.parentId, schoolId },
    select: { id: true },
  });

  if (!parent) {
    throw new HttpError(404, 'Parent not found');
  }

  const link = await prisma.studentParent.upsert({
    where: { studentId_parentId: { studentId: id, parentId: payload.parentId } },
    update: {},
    create: { studentId: id, parentId: payload.parentId },
  });

  res.status(201).json(link);
};

export const unlinkParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id, parentId } = req.params;

  const existing = await prisma.studentParent.findFirst({
    where: { studentId: id, parentId, student: { schoolId } },
    select: { studentId: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent link not found');
  }

  await prisma.studentParent.delete({
    where: { studentId_parentId: { studentId: id, parentId } },
  });

  res.status(204).send();
};

export const changeStudentStatus = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const studentUpdate = await tx.student.update({
      where: { id },
      data: { status: payload.status },
    });

    await tx.studentStatusHistory.create({
      data: {
        studentId: id,
        status: payload.status,
        reason: payload.reason ?? null,
      },
    });

    return studentUpdate;
  });

  res.status(200).json(updated);
};
