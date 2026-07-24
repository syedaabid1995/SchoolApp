import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import type { Prisma } from '@prisma/client';
import { StudentEnrollmentRepository } from '../../repositories/enrollment.repository';
import { HttpError } from '../../../../middlewares/error.middleware';
import { resolveSchoolId } from '../../../../utils/tenant';
import { enforceLimits } from '../../../../services/subscription.service';
import { StudentRepository } from '../../repositories/student.repository';
import { AuditLogService } from '../student-audit.service';
import path from 'path';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { buildQueryFingerprint, cacheKeys } from '../../../../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../../../../services/cache/cache.service';
import { cacheTTL } from '../../../../services/cache/cache.ttl';
import { invalidateStudentCache, invalidateAttendanceCache } from '../../../../services/cache/cache.invalidation';
import { logger } from '../../../../config/logger';
import { feeGenerationQueue } from '../../../../queues';
import { clearStudentFaceRegistration, registerStudentFaceImageRefs } from '../../../../services/face.service';

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId) {
    throw new HttpError(403, 'School scope is required to manage students');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const nullableText = (value?: string | null) => normalizeText(value) ?? null;

const uniqueTextList = (values: string[] = []) =>
  Array.from(new Set(values.map((value) => normalizeText(value)).filter((value): value is string => Boolean(value))));

const faceRegistrationImageRefs = (payload: { photoUrl?: string | null; facePhotoUrls?: string[] }) => {
  const explicitFacePhotos = uniqueTextList(payload.facePhotoUrls);
  if (explicitFacePhotos.length) return explicitFacePhotos;
  const studentPhoto = normalizeText(payload.photoUrl);
  return studentPhoto ? [studentPhoto] : [];
};

const autoRegisterAdmissionFaces = async (params: {
  schoolId: string;
  studentId: string;
  createdById: string;
  imageRefs: string[];
}) => {
  if (!params.imageRefs.length) return null;

  try {
    const profile = await registerStudentFaceImageRefs({
      schoolId: params.schoolId,
      studentId: params.studentId,
      createdById: params.createdById,
      imageRefs: params.imageRefs,
      replace: true,
    });
    return {
      success: true,
      sampleCount: profile.samples.length,
    };
  } catch (error) {
    const message = error instanceof HttpError ? error.message : 'Face registration failed';
    logger.warn(
      {
        err: error,
        schoolId: params.schoolId,
        studentId: params.studentId,
        imageCount: params.imageRefs.length,
      },
      'Student admission face registration failed',
    );
    return {
      success: false,
      sampleCount: 0,
      error: message,
    };
  }
};

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const safeDate = (value?: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const ensureAcademicScope = async (schoolId: string, payload: { academicSessionId?: string | null; classId?: string | null; sectionId?: string | null }) => {
  if (payload.academicSessionId) {
    const year = await StudentEnrollmentRepository.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } });
    if (!year) throw new HttpError(404, 'Academic session not found');
  }
  if (payload.classId) {
    const cls = await StudentEnrollmentRepository.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } });
    if (!cls) throw new HttpError(404, 'Class not found');
  }
  if (payload.sectionId) {
    const section = await StudentEnrollmentRepository.section.findFirst({ where: { id: payload.sectionId, schoolId }, select: { id: true } });
    if (!section) throw new HttpError(404, 'Section not found');
  }
  if (payload.classId && payload.sectionId) {
    const link = await StudentEnrollmentRepository.classSection.findFirst({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId }, select: { id: true } });
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
  const existing = await StudentEnrollmentRepository.studentEnrollment.findFirst({
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

const ensureAdmissionFeeReferences = async (
  schoolId: string,
  academicSessionId: string | null | undefined,
  payload: { feeGroupIds?: string[]; discountIds?: string[] },
) => {
  const requestedFeeGroupIds = payload.feeGroupIds ?? [];
  const requestedDiscountIds = payload.discountIds ?? [];
  const feeGroupIds = Array.from(new Set(requestedFeeGroupIds));
  const discountIds = Array.from(new Set(requestedDiscountIds));
  if (!feeGroupIds.length && !discountIds.length) return;
  if (!academicSessionId) throw new HttpError(400, 'academicSessionId is required to assign fees during admission');
  if (requestedFeeGroupIds.length !== feeGroupIds.length) throw new HttpError(400, 'Duplicate fee groups are not allowed');
  if (requestedDiscountIds.length !== discountIds.length) throw new HttpError(400, 'Duplicate fee discounts are not allowed');
  if (discountIds.length && !feeGroupIds.length) throw new HttpError(400, 'Discounts cannot be selected without a fee group');

  const [feeGroups, discounts] = await Promise.all([
    feeGroupIds.length
      ? StudentEnrollmentRepository.feeGroup.findMany({
          where: { schoolId, academicSessionId, id: { in: feeGroupIds }, deletedAt: null, status: 'ACTIVE' },
          select: { id: true },
        })
      : Promise.resolve([]),
    discountIds.length
      ? StudentEnrollmentRepository.feeDiscount.findMany({
          where: {
            schoolId,
            academicSessionId,
            id: { in: discountIds },
            deletedAt: null,
            approvalStatus: { in: ['APPROVED', 'ACTIVE'] },
          },
          select: { id: true, validTo: true, expiryDate: true },
        })
      : Promise.resolve([]),
  ]);

  if (feeGroups.length !== feeGroupIds.length) throw new HttpError(404, 'One or more fee groups were not found');
  if (discounts.length !== discountIds.length) throw new HttpError(404, 'One or more approved fee discounts were not found');
  const now = new Date();
  if (discounts.some((discount) => (discount.expiryDate && discount.expiryDate < now) || (discount.validTo && discount.validTo < now))) {
    throw new HttpError(400, 'Expired discounts cannot be selected');
  }
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
  facePhotoUrls: z.array(z.string().trim().min(1)).max(4).optional(),
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
  feeGroupIds: z.array(z.string().uuid()).optional(),
  discountIds: z.array(z.string().uuid()).optional(),
  generateInvoices: z.boolean().optional().default(true),
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
  facePhotoUrls: z.array(z.string().trim().min(1)).max(4).optional(),
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
  feeGroupIds: z.array(z.string().uuid()).optional(),
  discountIds: z.array(z.string().uuid()).optional(),
  generateInvoices: z.boolean().optional(),
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
  await ensureAdmissionFeeReferences(schoolId, payload.academicSessionId, payload);

  const existing = await StudentEnrollmentRepository.student.findFirst({
    where: { schoolId, admissionNo: payload.admissionNo },
    select: { id: true, admissionNo: true, firstName: true, lastName: true },
  });
  if (existing) {
    throw new HttpError(409, 'Admission number already exists');
  }

  const fullName = normalizeText(payload.fullName)!;
  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || 'Student';

  const result = await StudentEnrollmentRepository.$transaction(async (tx) => {
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

    const feeGroupIds = Array.from(new Set(payload.feeGroupIds ?? []));
    const discountIds = Array.from(new Set(payload.discountIds ?? []));
    let feeInvoiceGenerationJob = null;
    if (payload.academicSessionId && (feeGroupIds.length || discountIds.length)) {
      if (feeGroupIds.length) {
        await tx.studentFeeGroupAssignment.createMany({
          data: feeGroupIds.map((feeGroupId) => ({
            schoolId,
            academicSessionId: payload.academicSessionId!,
            studentId: createdStudent.id,
            feeGroupId,
            source: 'ADMISSION',
            createdById: auth.userId,
          })),
          skipDuplicates: true,
        });
      }

      if (payload.generateInvoices) {
        feeInvoiceGenerationJob = await tx.feeInvoiceGenerationJob.create({
          data: {
            schoolId,
            academicSessionId: payload.academicSessionId,
            studentId: createdStudent.id,
            source: 'ADMISSION',
            payload: { feeGroupIds, discountIds },
            createdById: auth.userId,
          },
        });
      }
    }

    return { student: createdStudent, feeInvoiceGenerationJob };
  });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: result.student.id,
    action: 'CREATE',
      afterState: {
      admissionNo: result.student.admissionNo,
      rollNo: result.student.rollNo,
      fullName: result.student.fullName,
      academicSessionId: result.student.academicSessionId,
      classId: result.student.classId,
      sectionId: result.student.sectionId,
      status: result.student.status,
      feeInvoiceGenerationJobId: result.feeInvoiceGenerationJob?.id ?? null,
    },
  });

  const faceRegistration = await autoRegisterAdmissionFaces({
    schoolId,
    studentId: result.student.id,
    createdById: auth.userId,
    imageRefs: faceRegistrationImageRefs(payload),
  });

  await invalidateStudentCache(schoolId, result.student.id);

  if (result.feeInvoiceGenerationJob) {
    await feeGenerationQueue
      .add(
        'admission-fee-generation',
        { jobId: result.feeInvoiceGenerationJob.id },
        { jobId: result.feeInvoiceGenerationJob.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      )
      .catch(async (err) => {
        logger.warn({ err, feeInvoiceGenerationJobId: result.feeInvoiceGenerationJob?.id }, 'failed to enqueue admission fee generation job');
        await StudentEnrollmentRepository.feeInvoiceGenerationJob.update({
          where: { id: result.feeInvoiceGenerationJob!.id },
          data: { status: 'FAILED', error: 'Unable to enqueue fee generation job' },
        }).catch((updateErr) => logger.warn({ err: updateErr }, 'failed to mark admission fee generation job failed'));
      });
  }

  res.status(201).json({
    ...result.student,
    feeInvoiceGenerationJob: result.feeInvoiceGenerationJob,
    faceRegistration,
  });
};

export const updateStudent = async (req: Request, res: Response) => {
  const auth = requireSchoolAdmin(req);
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await StudentEnrollmentRepository.student.findFirst({
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
  if (payload.feeGroupIds !== undefined || payload.discountIds !== undefined) {
    await ensureAdmissionFeeReferences(schoolId, nextAcademic.academicSessionId, {
      feeGroupIds: payload.feeGroupIds ?? [],
      discountIds: payload.discountIds ?? [],
    });
  }

  const fullName = payload.fullName ? normalizeText(payload.fullName) : undefined;
  const result = await StudentEnrollmentRepository.$transaction(async (tx) => {
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

    let feeInvoiceGenerationJob = null;
    if (payload.feeGroupIds !== undefined || payload.discountIds !== undefined) {
      if (!nextAcademic.academicSessionId) {
        throw new HttpError(400, 'academicSessionId is required to update fee details');
      }
      const feeGroupIds = Array.from(new Set(payload.feeGroupIds ?? []));
      const discountIds = Array.from(new Set(payload.discountIds ?? []));

      await tx.studentFeeGroupAssignment.updateMany({
        where: {
          schoolId,
          academicSessionId: nextAcademic.academicSessionId,
          studentId: id,
          deletedAt: null,
        },
        data: {
          status: 'INACTIVE',
          deletedAt: new Date(),
          deletedById: auth.userId,
        },
      });

      if (feeGroupIds.length) {
        await tx.studentFeeGroupAssignment.createMany({
          data: feeGroupIds.map((feeGroupId) => ({
            schoolId,
            academicSessionId: nextAcademic.academicSessionId!,
            studentId: id,
            feeGroupId,
            source: 'MANUAL',
            createdById: auth.userId,
          })),
          skipDuplicates: true,
        });
      }

      if (payload.generateInvoices && (feeGroupIds.length || discountIds.length)) {
        feeInvoiceGenerationJob = await tx.feeInvoiceGenerationJob.create({
          data: {
            schoolId,
            academicSessionId: nextAcademic.academicSessionId,
            studentId: id,
            source: 'MANUAL',
            payload: { feeGroupIds, discountIds },
            createdById: auth.userId,
          },
        });
      }
    }

    return { student: updated, feeInvoiceGenerationJob };
  });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: result.student.id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: {
      admissionNo: result.student.admissionNo,
      rollNo: result.student.rollNo,
      fullName: result.student.fullName,
      dob: result.student.dob,
      academicSessionId: result.student.academicSessionId,
      classId: result.student.classId,
      sectionId: result.student.sectionId,
      status: result.student.status,
      feeInvoiceGenerationJobId: result.feeInvoiceGenerationJob?.id ?? null,
    },
  });

  let faceRegistration: Awaited<ReturnType<typeof autoRegisterAdmissionFaces>> | null = null;
  if (payload.facePhotoUrls !== undefined) {
    const imageRefs = faceRegistrationImageRefs({ facePhotoUrls: payload.facePhotoUrls });
    if (imageRefs.length) {
      faceRegistration = await autoRegisterAdmissionFaces({
        schoolId,
        studentId: result.student.id,
        createdById: auth.userId,
        imageRefs,
      });
    } else {
      try {
        await clearStudentFaceRegistration({
          schoolId,
          studentId: result.student.id,
          clearedById: auth.userId,
        });
        faceRegistration = { success: true, sampleCount: 0 };
      } catch (error) {
        const message = error instanceof HttpError ? error.message : 'Face registration failed';
        logger.warn({ err: error, schoolId, studentId: result.student.id }, 'Student face registration clear failed');
        faceRegistration = { success: false, sampleCount: 0, error: message };
      }
    }
  }

  await invalidateStudentCache(schoolId, result.student.id);

  if (result.feeInvoiceGenerationJob) {
    await feeGenerationQueue
      .add(
        'student-fee-generation',
        { jobId: result.feeInvoiceGenerationJob.id },
        { jobId: result.feeInvoiceGenerationJob.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
      )
      .catch(async (err) => {
        logger.warn({ err, feeInvoiceGenerationJobId: result.feeInvoiceGenerationJob?.id }, 'failed to enqueue student fee generation job');
        await StudentEnrollmentRepository.feeInvoiceGenerationJob.update({
          where: { id: result.feeInvoiceGenerationJob!.id },
          data: { status: 'FAILED', error: 'Unable to enqueue fee generation job' },
        }).catch((updateErr) => logger.warn({ err: updateErr }, 'failed to mark student fee generation job failed'));
      });
  }

  res.status(200).json({
    ...result.student,
    feeInvoiceGenerationJob: result.feeInvoiceGenerationJob,
    faceRegistration,
  });
};

export const deleteStudent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await StudentEnrollmentRepository.student.findFirst({
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

  await StudentEnrollmentRepository.student.delete({ where: { id } });

  await AuditLogService.record(req, {
    schoolId,
    entityType: 'STUDENT',
    entityId: id,
    action: 'DELETE',
    beforeState: existing,
  });

  await invalidateStudentCache(schoolId, id);

  res.status(200).json({ success: true });
};

export const changeStudentStatus = async (req: Request, res: Response) => {
  const payload = statusSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const student = await StudentEnrollmentRepository.student.findFirst({
    where: { id, schoolId },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const updated = await StudentEnrollmentRepository.$transaction(async (tx) => {
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

  await AuditLogService.record(req, {
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

export const StudentEnrollmentService = {
  changeStudentStatus,
  createStudent,
  deleteStudent,
  updateStudent,
};
