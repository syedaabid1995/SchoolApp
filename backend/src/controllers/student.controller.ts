import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { enforceLimits } from '../services/subscription.service';
import { logAudit } from '../utils/audit';

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

const transferRequestSchema = z.object({
  toSchoolId: z.string().uuid(),
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const transferDecisionSchema = z.object({
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createStudent = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  await enforceLimits(schoolId, 'students');

  const existing = await prisma.student.findFirst({
    where: { schoolId, admissionNo: payload.admissionNo },
    select: { id: true, admissionNo: true, firstName: true, lastName: true },
  });
  if (existing) {
    throw new HttpError(409, 'Admission number already exists');
  }

  const student = await prisma.$transaction(async (tx) => {
    const createdStudent = await tx.student.create({
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

    await tx.usageCounter.upsert({
      where: { schoolId },
      update: { students: { increment: 1 } },
      create: { schoolId, students: 1, teachers: 0 },
    });

    await tx.studentStatusHistory.create({
      data: {
        studentId: createdStudent.id,
        status: 'ENROLLED',
        reason: 'Initial enrollment',
      },
    });

    return createdStudent;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: student.id,
    action: 'CREATE',
    afterState: {
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      classId: student.classId,
      sectionId: student.sectionId,
      status: student.status,
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
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      parentLinks: {
        include: {
          parent: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
        },
      },
    },
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
    select: {
      id: true,
      admissionNo: true,
      firstName: true,
      lastName: true,
      dob: true,
      classId: true,
      sectionId: true,
      status: true,
    },
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

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: student.id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: {
      admissionNo: student.admissionNo,
      firstName: student.firstName,
      lastName: student.lastName,
      dob: student.dob,
      classId: student.classId,
      sectionId: student.sectionId,
      status: student.status,
    },
  });

  res.status(200).json(student);
};

export const deleteStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.student.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      admissionNo: true,
      firstName: true,
      lastName: true,
      dob: true,
      classId: true,
      sectionId: true,
      status: true,
    },
  });

  if (!existing) {
    throw new HttpError(404, 'Student not found');
  }

  await prisma.student.delete({ where: { id } });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  res.status(200).json({ success: true });
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

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_PARENT',
    entityId: `${id}:${payload.parentId}`,
    action: 'LINK',
    afterState: { studentId: id, parentId: payload.parentId },
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

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_PARENT',
    entityId: `${id}:${parentId}`,
    action: 'UNLINK',
    beforeState: { studentId: id, parentId },
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

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_STATUS',
    entityId: updated.id,
    action: 'STATUS_CHANGE',
    beforeState: { status: student.status },
    afterState: { status: updated.status, reason: payload.reason ?? null },
  });

  res.status(200).json(updated);
};

export const listTransferTargets = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const schools = await prisma.school.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      id: { not: schoolId },
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });

  res.status(200).json(schools);
};

export const createTransferRequest = async (req: Request, res: Response) => {
  const payload = transferRequestSchema.parse(req.body);
  const fromSchoolId = resolveSchoolId(req, payload.schoolId);
  const { id } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId: fromSchoolId },
    select: { id: true },
  });
  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const existing = await prisma.studentTransferRequest.findFirst({
    where: {
      studentId: id,
      status: 'PENDING',
    },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, 'Transfer request already pending');
  }

  const request = await prisma.studentTransferRequest.create({
    data: {
      studentId: id,
      fromSchoolId,
      toSchoolId: payload.toSchoolId,
      requestedById: req.auth.userId,
      reason: payload.reason ?? null,
      status: 'PENDING',
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      fromSchool: { select: { id: true, name: true, code: true } },
      toSchool: { select: { id: true, name: true, code: true } },
    },
  });

  await logAudit(req, {
    schoolId: fromSchoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: request.id,
    action: 'REQUEST',
    afterState: {
      studentId: request.studentId,
      fromSchoolId: request.fromSchoolId,
      toSchoolId: request.toSchoolId,
      status: request.status,
      reason: request.reason,
    },
  });

  res.status(201).json(request);
};

export const listIncomingTransferRequests = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const requests = await prisma.studentTransferRequest.findMany({
    where: { toSchoolId: schoolId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
      fromSchool: { select: { id: true, name: true, code: true } },
    },
  });

  res.status(200).json(requests);
};

export const acceptTransferRequest = async (req: Request, res: Response) => {
  const payload = transferDecisionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const request = await prisma.studentTransferRequest.findFirst({
    where: { id, toSchoolId: schoolId, status: 'PENDING' },
    include: { student: true, fromSchool: true, toSchool: true },
  });
  if (!request) {
    throw new HttpError(404, 'Transfer request not found');
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: request.studentId },
      data: {
        schoolId: request.toSchoolId,
        classId: null,
        sectionId: null,
        status: 'ENROLLED',
      },
    });

    await tx.studentStatusHistory.create({
      data: {
        studentId: request.studentId,
        status: 'TRANSFERRED',
        reason: payload.reason ?? `Transfer accepted to ${request.toSchool.name}`,
      },
    });

    return tx.studentTransferRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        decidedById: req.auth.userId,
        decidedAt: new Date(),
        reason: payload.reason ?? null,
      },
    });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: result.id,
    action: 'ACCEPT',
    beforeState: { status: 'PENDING' },
    afterState: { status: result.status, reason: result.reason },
  });

  res.status(200).json(result);
};

export const rejectTransferRequest = async (req: Request, res: Response) => {
  const payload = transferDecisionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const existing = await prisma.studentTransferRequest.findFirst({
    where: { id, toSchoolId: schoolId, status: 'PENDING' },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, 'Transfer request not found');
  }

  const request = await prisma.studentTransferRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      decidedById: req.auth.userId,
      decidedAt: new Date(),
      reason: payload.reason ?? null,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_TRANSFER',
    entityId: request.id,
    action: 'REJECT',
    beforeState: { status: 'PENDING' },
    afterState: { status: request.status, reason: request.reason },
  });

  res.status(200).json(request);
};
