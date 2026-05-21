import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { enforceLimits } from '../services/subscription.service';
import { logAudit } from '../utils/audit';
import path from 'path';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { invalidateStudentCache, invalidateAttendanceCache } from '../services/cache/cache.invalidation';

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    throw new HttpError(403, 'Only School Admin can manage students');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const nullableText = (value?: string | null) => normalizeText(value) ?? null;

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const safeDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const ensureAcademicScope = async (schoolId: string, payload: { academicSessionId?: string | null; classId?: string | null; sectionId?: string | null }) => {
  if (payload.academicSessionId) {
    const year = await prisma.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } });
    if (!year) throw new HttpError(404, 'Academic session not found');
  }
  if (payload.classId) {
    const cls = await prisma.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } });
    if (!cls) throw new HttpError(404, 'Class not found');
  }
  if (payload.sectionId) {
    const section = await prisma.section.findFirst({ where: { id: payload.sectionId, schoolId }, select: { id: true } });
    if (!section) throw new HttpError(404, 'Section not found');
  }
  if (payload.classId && payload.sectionId) {
    const link = await prisma.classSection.findFirst({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId }, select: { id: true } });
    if (!link) throw new HttpError(400, 'Section is not assigned to the selected class');
  }
};

const ensureRollIsUnique = async (
  schoolId: string,
  payload: { academicSessionId?: string | null; classId?: string | null; sectionId?: string | null; rollNo?: string | null },
  excludeStudentId?: string,
) => {
  const rollNo = normalizeText(payload.rollNo);
  if (!rollNo || !payload.academicSessionId || !payload.classId || !payload.sectionId) return;
  const existing = await prisma.studentEnrollment.findFirst({
    where: {
      schoolId,
      academicSessionId: payload.academicSessionId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      rollNo,
      ...(excludeStudentId ? { studentId: { not: excludeStudentId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'Roll number already exists for this class, section, and session');
};

const createSchema = z.object({
  admissionNo: z.string().min(1),
  rollNo: z.string().optional(),
  academicSessionId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1),
  dob: z.coerce.date().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  caste: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  admissionDate: z.coerce.date().optional(),
  category: z.string().optional(),
  height: z.coerce.number().positive().optional(),
  weight: z.coerce.number().positive().optional(),
  photoUrl: z.string().optional(),
  fatherName: z.string().optional(),
  fatherOccupation: z.string().optional(),
  fatherPhone: z.string().optional(),
  fatherPhotoUrl: z.string().optional(),
  motherName: z.string().optional(),
  motherOccupation: z.string().optional(),
  motherPhone: z.string().optional(),
  motherPhotoUrl: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelationship: z.string().optional(),
  guardianPhotoUrl: z.string().optional(),
  parentPhone: z.string().optional(),
  parentEmail: z.string().email().optional(),
  presentAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
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
  siblingIds: z.array(z.string().uuid()).optional(),
});

const updateSchema = z.object({
  admissionNo: z.string().min(1).optional(),
  rollNo: z.string().optional().nullable(),
  academicSessionId: z.string().uuid().optional().nullable(),
  fullName: z.string().min(1).optional(),
  dob: z.coerce.date().optional().nullable(),
  gender: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  religion: z.string().optional().nullable(),
  caste: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  admissionDate: z.coerce.date().optional().nullable(),
  category: z.string().optional().nullable(),
  height: z.coerce.number().positive().optional().nullable(),
  weight: z.coerce.number().positive().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  fatherName: z.string().optional().nullable(),
  fatherOccupation: z.string().optional().nullable(),
  fatherPhone: z.string().optional().nullable(),
  fatherPhotoUrl: z.string().optional().nullable(),
  motherName: z.string().optional().nullable(),
  motherOccupation: z.string().optional().nullable(),
  motherPhone: z.string().optional().nullable(),
  motherPhotoUrl: z.string().optional().nullable(),
  guardianName: z.string().optional().nullable(),
  guardianRelationship: z.string().optional().nullable(),
  guardianPhotoUrl: z.string().optional().nullable(),
  parentPhone: z.string().optional().nullable(),
  parentEmail: z.string().email().optional().nullable(),
  presentAddress: z.string().optional().nullable(),
  permanentAddress: z.string().optional().nullable(),
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
  siblingIds: z.array(z.string().uuid()).optional(),
});

const documentSchema = z.object({
  title: z.string().min(1).max(160),
  url: z.string().min(1),
  fileName: z.string().max(255).optional().nullable(),
  mimeType: z.string().max(120).optional().nullable(),
  sizeBytes: z.coerce.number().int().positive().optional().nullable(),
});

const timelineSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  timelineDate: z.coerce.date(),
});

const linkParentSchema = z.object({
  parentId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const statusSchema = z.object({
  status: z.enum(['ENROLLED', 'TRANSFERRED', 'EXITED', 'DISABLED']),
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

const importUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx'].includes(ext)) return cb(null, true);
    return cb(new Error('Only CSV and Excel files are supported'));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadStudentImportMiddleware = importUpload.single('file');

const importSchema = z.object({
  academicSessionId: z.string().uuid(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
});

const normalizeImportKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeImportRows = (rows: Record<string, unknown>[]) =>
  rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[normalizeImportKey(key)] = String(value ?? '').trim();
    }
    return normalized;
  });

const loadStudentImportRows = async (file: Express.Multer.File) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.csv') {
    const content = file.buffer.toString('utf8');
    if (content.includes('\uFFFD')) throw new HttpError(400, 'CSV must be UTF-8 encoded');
    return normalizeImportRows(parse(content, { columns: true, skip_empty_lines: true, trim: true }));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headers = (sheet.getRow(1).values as unknown[])
    .slice(1)
    .map((value) => normalizeImportKey(String(value ?? '')));
  const rows: Record<string, unknown>[] = [];
  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      record[header] = cell.text || cell.value || '';
    });
    if (Object.values(record).some((value) => String(value ?? '').trim())) {
      rows.push(record);
    }
  }
  return normalizeImportRows(rows);
};

const buildStudentSampleCsv = () => {
  const headers = [
    'admission_no',
    'roll_no',
    'first_name',
    'last_name',
    'gender',
    'date_of_birth',
    'blood_group',
    'religion',
    'caste',
    'email',
    'phone',
    'admission_date',
    'category',
    'height',
    'weight',
    'father_name',
    'father_occupation',
    'father_phone',
    'mother_name',
    'mother_occupation',
    'mother_phone',
    'guardian_relation',
    'present_address',
    'permanent_address',
  ];
  const sample = [
    'ADM-1001',
    '1',
    'Aarav',
    'Sharma',
    'Male',
    '2012-04-12',
    'O+',
    'Hindu',
    'General',
    'aarav@example.com',
    '9000000010',
    '2026-06-01',
    'Regular',
    '145.5',
    '38.2',
    'Rohit Sharma',
    'Engineer',
    '9000000011',
    'Neha Sharma',
    'Teacher',
    '9000000012',
    'Father',
    'Present address line',
    'Permanent address line',
  ];
  return `${headers.join(',')}\n${sample.map((value) => `"${value}"`).join(',')}\n`;
};

const requiredImportFields = ['admission_no', 'roll_no', 'first_name', 'last_name', 'date_of_birth'];

export const createStudent = async (req: Request, res: Response) => {
  const auth = requireSchoolAdmin(req);
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  await enforceLimits(schoolId, 'students');
  await ensureAcademicScope(schoolId, payload);
  await ensureRollIsUnique(schoolId, payload);

  const existing = await prisma.student.findFirst({
    where: { schoolId, admissionNo: payload.admissionNo },
    select: { id: true, admissionNo: true, firstName: true, lastName: true },
  });
  if (existing) {
    throw new HttpError(409, 'Admission number already exists');
  }

  const fullName = normalizeText(payload.fullName)!;
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || 'Student';

  const student = await prisma.$transaction(async (tx) => {
    const createdStudent = await tx.student.create({
      data: {
        admissionNo: normalizeText(payload.admissionNo)!,
        rollNo: normalizeText(payload.rollNo) ?? null,
        academicSessionId: payload.academicSessionId ?? null,
        firstName,
        lastName,
        fullName,
        dob: payload.dob ?? null,
        gender: payload.gender ?? null,
        bloodGroup: payload.bloodGroup ?? null,
        religion: nullableText(payload.religion),
        caste: nullableText(payload.caste),
        email: nullableText(payload.email),
        phone: nullableText(payload.phone),
        admissionDate: payload.admissionDate ?? new Date(),
        category: nullableText(payload.category),
        height: payload.height === undefined ? null : payload.height,
        weight: payload.weight === undefined ? null : payload.weight,
        photoUrl: payload.photoUrl ?? null,
        fatherName: payload.fatherName ?? null,
        fatherOccupation: nullableText(payload.fatherOccupation),
        fatherPhone: nullableText(payload.fatherPhone),
        fatherPhotoUrl: nullableText(payload.fatherPhotoUrl),
        motherName: payload.motherName ?? null,
        motherOccupation: nullableText(payload.motherOccupation),
        motherPhone: nullableText(payload.motherPhone),
        motherPhotoUrl: nullableText(payload.motherPhotoUrl),
        guardianName: payload.guardianName ?? null,
        guardianRelationship: payload.guardianRelationship ?? null,
        guardianPhotoUrl: nullableText(payload.guardianPhotoUrl),
        parentPhone: payload.parentPhone ?? null,
        parentEmail: payload.parentEmail ?? null,
        presentAddress: nullableText(payload.presentAddress),
        permanentAddress: nullableText(payload.permanentAddress),
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

    if (payload.academicSessionId && payload.classId && payload.sectionId) {
      await tx.studentEnrollment.create({
        data: {
          schoolId,
          studentId: createdStudent.id,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          rollNo: normalizeText(payload.rollNo) ?? null,
          status: 'ENROLLED',
          enrolledAt: payload.admissionDate ?? new Date(),
        },
      });
    }

    const guardians = [
      {
        type: 'FATHER',
        name: normalizeText(payload.fatherName),
        occupation: normalizeText(payload.fatherOccupation),
        phone: normalizeText(payload.fatherPhone ?? payload.parentPhone),
        email: normalizeText(payload.parentEmail),
        photoUrl: normalizeText(payload.fatherPhotoUrl),
        relation: 'Father',
        isPrimary: payload.guardianRelationship?.toLowerCase() === 'father',
      },
      {
        type: 'MOTHER',
        name: normalizeText(payload.motherName),
        occupation: normalizeText(payload.motherOccupation),
        phone: normalizeText(payload.motherPhone),
        photoUrl: normalizeText(payload.motherPhotoUrl),
        relation: 'Mother',
        isPrimary: payload.guardianRelationship?.toLowerCase() === 'mother',
      },
      {
        type: 'GUARDIAN',
        name: normalizeText(payload.guardianName),
        phone: normalizeText(payload.parentPhone),
        email: normalizeText(payload.parentEmail),
        photoUrl: normalizeText(payload.guardianPhotoUrl),
        relation: normalizeText(payload.guardianRelationship),
        isPrimary: true,
      },
    ].filter((guardian) => guardian.name);

    if (guardians.length) {
      await tx.parentGuardian.createMany({
        data: guardians.map((guardian) => ({
          schoolId,
          studentId: createdStudent.id,
          type: guardian.type,
          name: guardian.name!,
          occupation: guardian.occupation ?? null,
          phone: guardian.phone ?? null,
          email: guardian.email ?? null,
          photoUrl: guardian.photoUrl ?? null,
          relation: guardian.relation ?? null,
          isPrimary: guardian.isPrimary,
        })),
      });
    }

    if (payload.siblingIds?.length) {
      const siblings = await tx.student.findMany({
        where: { schoolId, id: { in: payload.siblingIds.filter((item) => item !== createdStudent.id) } },
        select: { id: true },
      });
      await tx.studentSibling.createMany({
        data: siblings.map((sibling) => ({
          schoolId,
          studentId: createdStudent.id,
          siblingStudentId: sibling.id,
          relation: 'Sibling',
        })),
        skipDuplicates: true,
      });
    }

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
      rollNo: student.rollNo,
      fullName: student.fullName,
      academicSessionId: student.academicSessionId,
      classId: student.classId,
      sectionId: student.sectionId,
      status: student.status,
    },
  });

  await invalidateStudentCache(schoolId, student.id);

  res.status(201).json(student);
};

export const listStudents = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const status = req.query.status as string | undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const academicSessionId = typeof req.query.academicSessionId === 'string' ? req.query.academicSessionId : undefined;
  const queryFingerprint = buildQueryFingerprint({ status: status ?? null, search, classId, sectionId, academicSessionId });
  const { value: students, status: cacheStatus } = await rememberCache(
    cacheKeys.studentsList(schoolId, queryFingerprint),
    cacheTTL.STUDENTS,
    () =>
      prisma.student.findMany({
        where: {
          schoolId,
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(academicSessionId ? { academicSessionId } : {}),
          ...(status ? { status: status as 'ENROLLED' | 'TRANSFERRED' | 'EXITED' | 'DISABLED' } : { status: { not: 'DISABLED' as const } }),
          ...(search
            ? {
                OR: [
                  { admissionNo: { contains: search, mode: 'insensitive' } },
                  { rollNo: { contains: search, mode: 'insensitive' } },
                  { fullName: { contains: search, mode: 'insensitive' } },
                  { fatherName: { contains: search, mode: 'insensitive' } },
                  { parentPhone: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          studentGroup: { select: { id: true, name: true } },
          studentCategory: { select: { id: true, name: true } },
          enrollments: {
            include: {
              academicSession: { select: { id: true, name: true, isActive: true } },
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
            orderBy: { enrolledAt: 'desc' },
            take: 1,
          },
          parentLinks: {
            include: {
              parent: {
                select: { id: true, firstName: true, lastName: true, phone: true, email: true },
              },
            },
          },
        },
      }),
  );
  setCacheHeader(res, cacheStatus);
  res.status(200).json(students);
};

export const getStudent = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const { value: student, status: cacheStatus } = await rememberCache(
    cacheKeys.studentDetail(schoolId, id),
    cacheTTL.STUDENTS,
    () =>
      prisma.student.findFirst({
        where: { id, schoolId },
        include: {
          academicSession: { select: { id: true, name: true, isActive: true } },
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          studentGroup: { select: { id: true, name: true } },
          studentCategory: { select: { id: true, name: true } },
          guardians: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
          enrollments: {
            include: {
              academicSession: { select: { id: true, name: true, isActive: true } },
              class: { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
            orderBy: { enrolledAt: 'desc' },
          },
          documents: { orderBy: { createdAt: 'desc' } },
          timelines: { orderBy: { timelineDate: 'desc' } },
          marks: {
            include: {
              examPaper: {
                include: {
                  subject: { select: { id: true, name: true, code: true } },
                  exam: { select: { id: true, name: true, type: true, status: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          siblings: {
            include: {
              sibling: {
                select: {
                  id: true,
                  admissionNo: true,
                  rollNo: true,
                  fullName: true,
                  class: { select: { id: true, name: true } },
                  section: { select: { id: true, name: true } },
                },
              },
            },
          },
          parentLinks: { include: { parent: true } },
          photos: { orderBy: { createdAt: 'desc' } },
          statusEvents: { orderBy: { changedAt: 'desc' } },
        },
      }),
  );

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  setCacheHeader(res, cacheStatus);
  res.status(200).json(student);
};

export const updateStudent = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.student.findFirst({
    where: { id, schoolId },
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      academicSessionId: true,
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

  const nextAcademic = {
    academicSessionId: payload.academicSessionId === undefined ? existing.academicSessionId : payload.academicSessionId,
    classId: payload.classId === undefined ? existing.classId : payload.classId,
    sectionId: payload.sectionId === undefined ? existing.sectionId : payload.sectionId,
    rollNo: payload.rollNo === undefined ? existing.rollNo : payload.rollNo,
  };
  await ensureAcademicScope(schoolId, nextAcademic);
  await ensureRollIsUnique(schoolId, nextAcademic, id);

  const fullName = payload.fullName ? normalizeText(payload.fullName) : undefined;
  const student = await prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({
      where: { id },
      data: {
        admissionNo: payload.admissionNo === undefined ? undefined : normalizeText(payload.admissionNo),
        rollNo: payload.rollNo === undefined ? undefined : nullableText(payload.rollNo),
        academicSessionId: payload.academicSessionId === undefined ? undefined : payload.academicSessionId,
        fullName,
        firstName: fullName ? fullName.split(/\s+/)[0] : undefined,
        lastName: fullName ? fullName.split(/\s+/).slice(1).join(' ') || 'Student' : undefined,
        dob: payload.dob === undefined ? undefined : payload.dob,
        gender: payload.gender === undefined ? undefined : payload.gender,
        bloodGroup: payload.bloodGroup === undefined ? undefined : payload.bloodGroup,
        religion: payload.religion === undefined ? undefined : payload.religion,
        caste: payload.caste === undefined ? undefined : payload.caste,
        email: payload.email === undefined ? undefined : payload.email,
        phone: payload.phone === undefined ? undefined : payload.phone,
        admissionDate: payload.admissionDate === undefined ? undefined : payload.admissionDate,
        category: payload.category === undefined ? undefined : payload.category,
        height: payload.height === undefined ? undefined : payload.height,
        weight: payload.weight === undefined ? undefined : payload.weight,
        photoUrl: payload.photoUrl === undefined ? undefined : payload.photoUrl,
        fatherName: payload.fatherName === undefined ? undefined : payload.fatherName,
        fatherOccupation: payload.fatherOccupation === undefined ? undefined : payload.fatherOccupation,
        fatherPhone: payload.fatherPhone === undefined ? undefined : payload.fatherPhone,
        fatherPhotoUrl: payload.fatherPhotoUrl === undefined ? undefined : payload.fatherPhotoUrl,
        motherName: payload.motherName === undefined ? undefined : payload.motherName,
        motherOccupation: payload.motherOccupation === undefined ? undefined : payload.motherOccupation,
        motherPhone: payload.motherPhone === undefined ? undefined : payload.motherPhone,
        motherPhotoUrl: payload.motherPhotoUrl === undefined ? undefined : payload.motherPhotoUrl,
        guardianName: payload.guardianName === undefined ? undefined : payload.guardianName,
        guardianRelationship: payload.guardianRelationship === undefined ? undefined : payload.guardianRelationship,
        guardianPhotoUrl: payload.guardianPhotoUrl === undefined ? undefined : payload.guardianPhotoUrl,
        parentPhone: payload.parentPhone === undefined ? undefined : payload.parentPhone,
        parentEmail: payload.parentEmail === undefined ? undefined : payload.parentEmail,
        presentAddress: payload.presentAddress === undefined ? undefined : payload.presentAddress,
        permanentAddress: payload.permanentAddress === undefined ? undefined : payload.permanentAddress,
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

    if (nextAcademic.academicSessionId && nextAcademic.classId && nextAcademic.sectionId) {
      await tx.studentEnrollment.upsert({
        where: { studentId_academicSessionId: { studentId: id, academicSessionId: nextAcademic.academicSessionId } },
        update: {
          schoolId,
          classId: nextAcademic.classId,
          sectionId: nextAcademic.sectionId,
          rollNo: normalizeText(nextAcademic.rollNo) ?? null,
          status: updated.status,
        },
        create: {
          schoolId,
          studentId: id,
          academicSessionId: nextAcademic.academicSessionId,
          classId: nextAcademic.classId,
          sectionId: nextAcademic.sectionId,
          rollNo: normalizeText(nextAcademic.rollNo) ?? null,
          status: updated.status,
          enrolledAt: updated.admissionDate ?? new Date(),
        },
      });
    }

    if (payload.siblingIds) {
      await tx.studentSibling.deleteMany({ where: { schoolId, studentId: id } });
      const siblings = await tx.student.findMany({
        where: { schoolId, id: { in: payload.siblingIds.filter((item) => item !== id) } },
        select: { id: true },
      });
      if (siblings.length) {
        await tx.studentSibling.createMany({
          data: siblings.map((sibling) => ({ schoolId, studentId: id, siblingStudentId: sibling.id, relation: 'Sibling' })),
          skipDuplicates: true,
        });
      }
    }

    return updated;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: student.id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: {
      admissionNo: student.admissionNo,
      rollNo: student.rollNo,
      fullName: student.fullName,
      dob: student.dob,
      academicSessionId: student.academicSessionId,
      classId: student.classId,
      sectionId: student.sectionId,
      status: student.status,
    },
  });

  await invalidateStudentCache(schoolId, student.id);

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

  await invalidateStudentCache(schoolId, id);

  res.status(200).json({ success: true });
};

export const downloadStudentImportSample = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const csv = buildStudentSampleCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-sample.csv"');
  res.status(200).send(csv);
};

export const importStudents = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  if (!req.file) throw new HttpError(400, 'Student import file is required');
  const payload = importSchema.parse(req.body);
  await ensureAcademicScope(schoolId, payload);

  const rows = await loadStudentImportRows(req.file);
  const errors: Array<{ rowNumber: number; field?: string; message: string; rawData?: Record<string, string> }> = [];
  const validRows: Array<Record<string, string>> = [];
  const seenAdmission = new Set<string>();
  const seenRoll = new Set<string>();
  const seenGuardianEmail = new Set<string>();
  const seenGuardianPhone = new Set<string>();

  const admissionNos = rows.map((row) => row.admission_no).filter(Boolean);
  const rollNos = rows.map((row) => row.roll_no).filter(Boolean);
  const guardianEmails = rows.map((row) => row.email).filter(Boolean);
  const guardianPhones = rows.map((row) => row.father_phone || row.mother_phone || row.phone).filter(Boolean);

  const [existingStudents, existingRolls, existingGuardiansByEmail, existingGuardiansByPhone] = await Promise.all([
    prisma.student.findMany({ where: { schoolId, admissionNo: { in: admissionNos } }, select: { admissionNo: true } }),
    prisma.studentEnrollment.findMany({
      where: {
        schoolId,
        academicSessionId: payload.academicSessionId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        rollNo: { in: rollNos },
      },
      select: { rollNo: true },
    }),
    prisma.parentGuardian.findMany({ where: { schoolId, email: { in: guardianEmails } }, select: { email: true } }),
    prisma.parentGuardian.findMany({ where: { schoolId, phone: { in: guardianPhones } }, select: { phone: true } }),
  ]);
  const existingAdmissionSet = new Set(existingStudents.map((item) => item.admissionNo));
  const existingRollSet = new Set(existingRolls.map((item) => item.rollNo).filter(Boolean));
  const existingGuardianEmailSet = new Set(existingGuardiansByEmail.map((item) => item.email).filter(Boolean));
  const existingGuardianPhoneSet = new Set(existingGuardiansByPhone.map((item) => item.phone).filter(Boolean));

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowErrors: typeof errors = [];
    for (const field of requiredImportFields) {
      if (!row[field]) rowErrors.push({ rowNumber, field, message: 'Required', rawData: row });
    }
    if (row.date_of_birth && !dateOnlyPattern.test(row.date_of_birth)) {
      rowErrors.push({ rowNumber, field: 'date_of_birth', message: 'Use YYYY-MM-DD date format', rawData: row });
    }
    if (row.admission_date && !dateOnlyPattern.test(row.admission_date)) {
      rowErrors.push({ rowNumber, field: 'admission_date', message: 'Use YYYY-MM-DD date format', rawData: row });
    }
    if (row.admission_no && (seenAdmission.has(row.admission_no) || existingAdmissionSet.has(row.admission_no))) {
      rowErrors.push({ rowNumber, field: 'admission_no', message: seenAdmission.has(row.admission_no) ? 'Duplicate in file' : 'Admission number already exists', rawData: row });
    }
    if (row.roll_no && (seenRoll.has(row.roll_no) || existingRollSet.has(row.roll_no))) {
      rowErrors.push({ rowNumber, field: 'roll_no', message: seenRoll.has(row.roll_no) ? 'Duplicate in file' : 'Roll number already exists in selected class-section-session', rawData: row });
    }
    if (row.email && (seenGuardianEmail.has(row.email) || existingGuardianEmailSet.has(row.email))) {
      rowErrors.push({ rowNumber, field: 'email', message: seenGuardianEmail.has(row.email) ? 'Duplicate guardian email in file' : 'Guardian email already exists', rawData: row });
    }
    const guardianPhone = row.father_phone || row.mother_phone || row.phone;
    if (guardianPhone && (seenGuardianPhone.has(guardianPhone) || existingGuardianPhoneSet.has(guardianPhone))) {
      rowErrors.push({ rowNumber, field: 'phone', message: seenGuardianPhone.has(guardianPhone) ? 'Duplicate guardian phone in file' : 'Guardian phone already exists', rawData: row });
    }
    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }
    seenAdmission.add(row.admission_no);
    seenRoll.add(row.roll_no);
    if (row.email) seenGuardianEmail.add(row.email);
    if (guardianPhone) seenGuardianPhone.add(guardianPhone);
    validRows.push(row);
  });

  await enforceLimits(schoolId, 'students');
  let successCount = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      const firstName = normalizeText(row.first_name)!;
      const lastName = normalizeText(row.last_name) ?? 'Student';
      const fullName = `${firstName} ${lastName}`.trim();
      const student = await tx.student.create({
        data: {
          schoolId,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          admissionNo: row.admission_no,
          rollNo: row.roll_no,
          firstName,
          lastName,
          fullName,
          dob: safeDate(row.date_of_birth),
          gender: nullableText(row.gender),
          bloodGroup: nullableText(row.blood_group),
          religion: nullableText(row.religion),
          caste: nullableText(row.caste),
          email: nullableText(row.email),
          phone: nullableText(row.phone),
          admissionDate: safeDate(row.admission_date) ?? new Date(),
          category: nullableText(row.category),
          height: row.height ? Number(row.height) : null,
          weight: row.weight ? Number(row.weight) : null,
          fatherName: nullableText(row.father_name),
          fatherOccupation: nullableText(row.father_occupation),
          fatherPhone: nullableText(row.father_phone),
          motherName: nullableText(row.mother_name),
          motherOccupation: nullableText(row.mother_occupation),
          motherPhone: nullableText(row.mother_phone),
          guardianName: nullableText(row.father_name || row.mother_name),
          guardianRelationship: nullableText(row.guardian_relation),
          parentPhone: nullableText(row.father_phone || row.mother_phone || row.phone),
          parentEmail: nullableText(row.email),
          presentAddress: nullableText(row.present_address),
          permanentAddress: nullableText(row.permanent_address),
          addressLine1: nullableText(row.present_address),
          status: 'ENROLLED',
        },
      });
      await tx.studentEnrollment.create({
        data: {
          schoolId,
          studentId: student.id,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          rollNo: row.roll_no,
          status: 'ENROLLED',
          enrolledAt: safeDate(row.admission_date) ?? new Date(),
        },
      });
      const guardians = [
        { type: 'FATHER', name: nullableText(row.father_name), occupation: nullableText(row.father_occupation), phone: nullableText(row.father_phone), email: nullableText(row.email), relation: 'Father', isPrimary: row.guardian_relation?.toLowerCase() === 'father' },
        { type: 'MOTHER', name: nullableText(row.mother_name), occupation: nullableText(row.mother_occupation), phone: nullableText(row.mother_phone), relation: 'Mother', isPrimary: row.guardian_relation?.toLowerCase() === 'mother' },
      ].filter((guardian) => guardian.name);
      if (guardians.length) {
        await tx.parentGuardian.createMany({
          data: guardians.map((guardian) => ({
            schoolId,
            studentId: student.id,
            type: guardian.type,
            name: guardian.name!,
            occupation: guardian.occupation ?? null,
            phone: guardian.phone ?? null,
            email: guardian.email ?? null,
            relation: guardian.relation,
            isPrimary: guardian.isPrimary,
          })),
        });
      }
      await tx.studentStatusHistory.create({ data: { studentId: student.id, status: 'ENROLLED', reason: 'Bulk import' } });
      successCount += 1;
    }
    if (successCount > 0) {
      await tx.usageCounter.upsert({
        where: { schoolId },
        update: { students: { increment: successCount } },
        create: { schoolId, students: successCount, teachers: 0 },
      });
    }
    await tx.studentImportLog.create({
      data: {
        schoolId,
        academicSessionId: payload.academicSessionId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        createdById: userId,
        fileName: req.file!.originalname,
        status: 'COMPLETED',
        totalRows: rows.length,
        successCount,
        failedCount: errors.length,
        report: { errors } as Prisma.InputJsonValue,
      },
    });
  });

  await invalidateStudentCache(schoolId);
  res.status(200).json({
    success: true,
    totalRows: rows.length,
    successCount,
    failedCount: errors.length,
    errors,
  });
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

  await invalidateStudentCache(schoolId, id);

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

  await invalidateStudentCache(schoolId, id);

  res.status(204).send();
};

export const addStudentDocument = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = documentSchema.parse(req.body);
  const { id } = req.params;
  const student = await prisma.student.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!student) throw new HttpError(404, 'Student not found');
  const document = await prisma.studentDocument.create({
    data: {
      schoolId,
      studentId: id,
      title: normalizeText(payload.title)!,
      url: payload.url,
      fileName: payload.fileName ?? null,
      mimeType: payload.mimeType ?? null,
      sizeBytes: payload.sizeBytes ?? null,
      uploadedById: userId,
    },
  });
  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_DOCUMENT',
    entityId: document.id,
    action: 'CREATE',
    afterState: { studentId: id, title: document.title },
  });
  await invalidateStudentCache(schoolId, id);
  res.status(201).json(document);
};

export const deleteStudentDocument = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id, documentId } = req.params;
  const document = await prisma.studentDocument.findFirst({ where: { id: documentId, studentId: id, schoolId } });
  if (!document) throw new HttpError(404, 'Document not found');
  await prisma.studentDocument.delete({ where: { id: documentId } });
  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_DOCUMENT',
    entityId: documentId,
    action: 'DELETE',
    beforeState: { studentId: id, title: document.title },
  });
  await invalidateStudentCache(schoolId, id);
  res.status(204).send();
};

export const addStudentTimeline = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = timelineSchema.parse(req.body);
  const { id } = req.params;
  const student = await prisma.student.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!student) throw new HttpError(404, 'Student not found');
  const item = await prisma.studentTimeline.create({
    data: {
      schoolId,
      studentId: id,
      title: normalizeText(payload.title)!,
      description: payload.description ?? null,
      timelineDate: payload.timelineDate,
      createdById: userId,
    },
  });
  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_TIMELINE',
    entityId: item.id,
    action: 'CREATE',
    afterState: { studentId: id, title: item.title },
  });
  await invalidateStudentCache(schoolId, id);
  res.status(201).json(item);
};

export const deleteStudentTimeline = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id, timelineId } = req.params;
  const item = await prisma.studentTimeline.findFirst({ where: { id: timelineId, studentId: id, schoolId } });
  if (!item) throw new HttpError(404, 'Timeline item not found');
  await prisma.studentTimeline.delete({ where: { id: timelineId } });
  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_TIMELINE',
    entityId: timelineId,
    action: 'DELETE',
    beforeState: { studentId: id, title: item.title },
  });
  await invalidateStudentCache(schoolId, id);
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

  await invalidateStudentCache(schoolId, id);

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

  await invalidateStudentCache(schoolId, id);

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

  await invalidateStudentCache(schoolId, updated.id);

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

  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const fromSchoolId = request.fromSchoolId;
  const toSchoolId = request.toSchoolId;
  const studentId = request.studentId;

  const oldBase = `/uploads/schools/${fromSchoolId}`;
  const newBase = `/uploads/schools/${toSchoolId}`;

  const rewriteUrl = (value: string | null) => {
    if (!value) return value;
    if (!value.startsWith(oldBase)) return value;
    return value.replace(oldBase, newBase);
  };

  const moveDir = async (fromDir: string, toDir: string) => {
    try {
      await fs.access(fromDir, fsConstants.F_OK);
    } catch {
      return;
    }
    await fs.mkdir(path.dirname(toDir), { recursive: true });
    try {
      await fs.rename(fromDir, toDir);
    } catch (err: any) {
      if (err?.code === 'EXDEV') {
        await fs.cp(fromDir, toDir, { recursive: true });
        await fs.rm(fromDir, { recursive: true, force: true });
        return;
      }
      throw err;
    }
  };

  await moveDir(
    path.join(uploadsRoot, 'schools', fromSchoolId, 'students', studentId),
    path.join(uploadsRoot, 'schools', toSchoolId, 'students', studentId),
  );
  await moveDir(
    path.join(uploadsRoot, 'schools', fromSchoolId, 'documents', studentId),
    path.join(uploadsRoot, 'schools', toSchoolId, 'documents', studentId),
  );

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId },
      select: { photoUrl: true, docBirthCert: true, docTransferCert: true, docAadhaar: true, docReportCard: true },
    });

    const photos = await tx.studentPhoto.findMany({
      where: { studentId },
      select: { id: true, url: true },
    });

    await tx.student.update({
      where: { id: studentId },
      data: {
        schoolId: toSchoolId,
        classId: null,
        sectionId: null,
        status: 'ENROLLED',
        photoUrl: student?.photoUrl ? rewriteUrl(student.photoUrl) : null,
        docBirthCert: student?.docBirthCert ? rewriteUrl(student.docBirthCert) : null,
        docTransferCert: student?.docTransferCert ? rewriteUrl(student.docTransferCert) : null,
        docAadhaar: student?.docAadhaar ? rewriteUrl(student.docAadhaar) : null,
        docReportCard: student?.docReportCard ? rewriteUrl(student.docReportCard) : null,
      },
    });

    for (const photo of photos) {
      const nextUrl = rewriteUrl(photo.url);
      if (nextUrl !== photo.url) {
        await tx.studentPhoto.update({
          where: { id: photo.id },
          data: { url: nextUrl },
        });
      }
    }

    await tx.studentStatusHistory.create({
      data: {
        studentId,
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

  await invalidateStudentCache(fromSchoolId, request.studentId);
  await invalidateStudentCache(schoolId, request.studentId);
  await invalidateAttendanceCache(fromSchoolId);
  await invalidateAttendanceCache(schoolId);

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

  await invalidateStudentCache(schoolId);

  res.status(200).json(request);
};
