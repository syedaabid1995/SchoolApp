import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { enforceLimits } from '../services/subscription.service';
import { logAudit } from '../utils/audit';

const createSchema = z.object({
  admissionNo: z.string().min(1),
  fullName: z.string().min(1),
  dob: z.coerce.date().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  photoUrl: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  parentPhone: z.string().optional(),
  parentEmail: z.string().email().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalConditions: z.string().optional(),
  allergies: z.string().optional(),
  doctorContact: z.string().optional(),
  docBirthCert: z.string().optional(),
  docTransferCert: z.string().optional(),
  docAadhaar: z.string().optional(),
  docReportCard: z.string().optional(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  admissionNo: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  dob: z.coerce.date().optional().nullable(),
  gender: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianRelationship: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  parentEmail: z.string().email().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  medicalConditions: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  doctorContact: z.string().optional().nullable(),
  docBirthCert: z.string().optional().nullable(),
  docTransferCert: z.string().optional().nullable(),
  docAadhaar: z.string().optional().nullable(),
  docReportCard: z.string().optional().nullable(),
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

const photoSchema = z.object({
  url: z.string().min(1),
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

  const [firstName, ...rest] = payload.fullName.trim().split(/\s+/);
  const lastName = rest.join(' ') || 'Student';

  const student = await prisma.$transaction(async (tx) => {
    const createdStudent = await tx.student.create({
      data: {
        admissionNo: payload.admissionNo,
        firstName,
        lastName,
        fullName: payload.fullName,
        dob: payload.dob ?? null,
        gender: payload.gender ?? null,
        bloodGroup: payload.bloodGroup ?? null,
        photoUrl: payload.photoUrl ?? null,
        fatherName: payload.fatherName ?? null,
        motherName: payload.motherName ?? null,
        guardianName: payload.guardianName ?? null,
        guardianRelationship: payload.guardianRelationship ?? null,
        parentPhone: payload.parentPhone ?? null,
        parentEmail: payload.parentEmail ?? null,
        addressLine1: payload.addressLine1 ?? null,
        addressLine2: payload.addressLine2 ?? null,
        city: payload.city ?? null,
        state: payload.state ?? null,
        pincode: payload.pincode ?? null,
        emergencyContact: payload.emergencyContact ?? null,
        medicalConditions: payload.medicalConditions ?? null,
        allergies: payload.allergies ?? null,
        doctorContact: payload.doctorContact ?? null,
        docBirthCert: payload.docBirthCert ?? null,
        docTransferCert: payload.docTransferCert ?? null,
        docAadhaar: payload.docAadhaar ?? null,
        docReportCard: payload.docReportCard ?? null,
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
      fullName: student.fullName,
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
      photos: { orderBy: { createdAt: 'desc' } },
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
      fullName: true,
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
      fullName: payload.fullName ?? undefined,
      firstName: payload.fullName ? payload.fullName.trim().split(/\s+/)[0] : undefined,
      lastName: payload.fullName ? payload.fullName.trim().split(/\s+/).slice(1).join(' ') || 'Student' : undefined,
      dob: payload.dob === undefined ? undefined : payload.dob,
      gender: payload.gender === undefined ? undefined : payload.gender,
      bloodGroup: payload.bloodGroup === undefined ? undefined : payload.bloodGroup,
      photoUrl: payload.photoUrl === undefined ? undefined : payload.photoUrl,
      fatherName: payload.fatherName === undefined ? undefined : payload.fatherName,
      motherName: payload.motherName === undefined ? undefined : payload.motherName,
      guardianName: payload.guardianName === undefined ? undefined : payload.guardianName,
      guardianRelationship: payload.guardianRelationship === undefined ? undefined : payload.guardianRelationship,
      parentPhone: payload.parentPhone === undefined ? undefined : payload.parentPhone,
      parentEmail: payload.parentEmail === undefined ? undefined : payload.parentEmail,
      addressLine1: payload.addressLine1 === undefined ? undefined : payload.addressLine1,
      addressLine2: payload.addressLine2 === undefined ? undefined : payload.addressLine2,
      city: payload.city === undefined ? undefined : payload.city,
      state: payload.state === undefined ? undefined : payload.state,
      pincode: payload.pincode === undefined ? undefined : payload.pincode,
      emergencyContact: payload.emergencyContact === undefined ? undefined : payload.emergencyContact,
      medicalConditions: payload.medicalConditions === undefined ? undefined : payload.medicalConditions,
      allergies: payload.allergies === undefined ? undefined : payload.allergies,
      doctorContact: payload.doctorContact === undefined ? undefined : payload.doctorContact,
      docBirthCert: payload.docBirthCert === undefined ? undefined : payload.docBirthCert,
      docTransferCert: payload.docTransferCert === undefined ? undefined : payload.docTransferCert,
      docAadhaar: payload.docAadhaar === undefined ? undefined : payload.docAadhaar,
      docReportCard: payload.docReportCard === undefined ? undefined : payload.docReportCard,
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
      fullName: student.fullName,
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

export const addStudentPhoto = async (req: Request, res: Response) => {
  const payload = photoSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const count = await prisma.studentPhoto.count({ where: { studentId: id } });
  if (count >= 5) {
    throw new HttpError(400, 'Maximum 5 photos allowed');
  }

  const photo = await prisma.studentPhoto.create({
    data: { studentId: id, url: payload.url },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_PHOTO',
    entityId: photo.id,
    action: 'CREATE',
    afterState: { studentId: id, url: payload.url },
  });

  res.status(201).json(photo);
};

export const deleteStudentPhoto = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id, photoId } = req.params;

  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const photo = await prisma.studentPhoto.findFirst({
    where: { id: photoId, studentId: id },
  });

  if (!photo) {
    throw new HttpError(404, 'Photo not found');
  }

  await prisma.studentPhoto.delete({ where: { id: photoId } });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_PHOTO',
    entityId: photoId,
    action: 'DELETE',
    beforeState: { studentId: id, url: photo.url },
  });

  res.status(204).send();
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
    where: { id: payload.parentId },
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
