import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';
import { uploadBuffer } from '../services/s3.service';

const uuidSchema = z.string().uuid();

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireHomeworkManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'School scope is required to manage homework');
};

const dateSchema = z.coerce.date();

const homeworkSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  subjectId: uuidSchema,
  homeworkDate: dateSchema,
  submissionDate: dateSchema,
  marks: z.coerce.number().min(0).max(1000000),
  description: z.string().min(1).max(5000),
  attachmentUrl: z.string().max(1000).optional().nullable(),
  attachmentName: z.string().max(255).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const evaluationRowSchema = z.object({
  studentId: uuidSchema,
  marks: z.coerce.number().min(0).max(1000000).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
  qualityStatus: z.enum(['GOOD', 'NOT_GOOD']).default('GOOD'),
  completionStatus: z.enum(['COMPLETED', 'NOT_COMPLETED']).default('COMPLETED'),
});

const evaluationSchema = z.object({
  evaluationDate: dateSchema,
  evaluations: z.array(evaluationRowSchema).min(1),
  schoolId: uuidSchema.optional(),
});

const includeHomework = {
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, email: true } },
  evaluatedBy: { select: { id: true, email: true } },
  _count: { select: { evaluations: true } },
} satisfies Prisma.HomeworkInclude;

const assertAcademicScope = async (schoolId: string, classId: string, sectionId: string, subjectId: string) => {
  const [schoolClass, section, subject] = await Promise.all([
    prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } }),
    prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true, classId: true } }),
    prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, classId: true } }),
  ]);

  if (!schoolClass) throw new HttpError(404, 'Class not found');
  if (!section) throw new HttpError(404, 'Section not found');
  if (section.classId && section.classId !== classId) throw new HttpError(400, 'Section does not belong to selected class');
  if (!subject) throw new HttpError(404, 'Subject not found');
  if (subject.classId && subject.classId !== classId) throw new HttpError(400, 'Subject does not belong to selected class');
};

const getHomeworkOrThrow = async (schoolId: string, id: string) => {
  const homework = await prisma.homework.findFirst({
    where: { id, schoolId },
    include: includeHomework,
  });
  if (!homework) throw new HttpError(404, 'Homework not found');
  return homework;
};

export const listHomeworks = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.homework.findMany({
    where: {
      schoolId,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { class: { name: { contains: search, mode: 'insensitive' } } },
              { section: { name: { contains: search, mode: 'insensitive' } } },
              { subject: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: includeHomework,
    orderBy: [{ homeworkDate: 'desc' }, { createdAt: 'desc' }],
  });

  res.status(200).json(items);
};

export const createHomework = async (req: Request, res: Response) => {
  const payload = homeworkSchema.parse(req.body);
  const { schoolId, userId } = requireHomeworkManager(req, payload.schoolId);

  await assertAcademicScope(schoolId, payload.classId, payload.sectionId, payload.subjectId);

  const item = await prisma.homework.create({
    data: {
      schoolId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      subjectId: payload.subjectId,
      homeworkDate: payload.homeworkDate,
      submissionDate: payload.submissionDate,
      marks: new Prisma.Decimal(payload.marks),
      description: normalizeText(payload.description),
      attachmentUrl: nullableText(payload.attachmentUrl),
      attachmentName: nullableText(payload.attachmentName),
      createdById: userId,
    },
    include: includeHomework,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK',
    entityId: item.id,
    action: 'CREATE',
    afterState: item,
  });

  res.status(201).json(item);
};

export const updateHomework = async (req: Request, res: Response) => {
  const payload = homeworkSchema.partial().parse(req.body);
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;
  const existing = await getHomeworkOrThrow(schoolId, id);

  const classId = payload.classId ?? existing.classId;
  const sectionId = payload.sectionId ?? existing.sectionId;
  const subjectId = payload.subjectId ?? existing.subjectId;
  await assertAcademicScope(schoolId, classId, sectionId, subjectId);

  const item = await prisma.homework.update({
    where: { id },
    data: {
      classId: payload.classId ?? undefined,
      sectionId: payload.sectionId ?? undefined,
      subjectId: payload.subjectId ?? undefined,
      homeworkDate: payload.homeworkDate ?? undefined,
      submissionDate: payload.submissionDate ?? undefined,
      marks: payload.marks === undefined ? undefined : new Prisma.Decimal(payload.marks),
      description: payload.description === undefined ? undefined : normalizeText(payload.description),
      attachmentUrl: payload.attachmentUrl === undefined ? undefined : nullableText(payload.attachmentUrl),
      attachmentName: payload.attachmentName === undefined ? undefined : nullableText(payload.attachmentName),
    },
    include: includeHomework,
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK',
    entityId: id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: item,
  });

  res.status(200).json(item);
};

export const deleteHomework = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const id = req.params.id;
  const existing = await getHomeworkOrThrow(schoolId, id);

  await prisma.homework.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'HOMEWORK', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

export const getHomeworkEvaluation = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const id = req.params.id;
  const homework = await getHomeworkOrThrow(schoolId, id);

  const [students, evaluations] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        classId: homework.classId,
        sectionId: homework.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true },
      orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.homeworkEvaluation.findMany({ where: { schoolId, homeworkId: id } }),
  ]);

  const evaluationByStudent = new Map(evaluations.map((item) => [item.studentId, item]));
  res.status(200).json({
    homework,
    rows: students.map((student) => ({
      student,
      evaluation: evaluationByStudent.get(student.id) ?? null,
    })),
  });
};

export const saveHomeworkEvaluation = async (req: Request, res: Response) => {
  const payload = evaluationSchema.parse(req.body);
  const { schoolId, userId } = requireHomeworkManager(req, getRequestedSchoolId(req, payload.schoolId));
  const homeworkId = req.params.id;
  const homework = await getHomeworkOrThrow(schoolId, homeworkId);
  const studentIds = Array.from(new Set(payload.evaluations.map((item) => item.studentId)));

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId,
      classId: homework.classId,
      sectionId: homework.sectionId,
      status: { not: 'DISABLED' },
    },
    select: { id: true },
  });
  if (students.length !== studentIds.length) throw new HttpError(404, 'One or more students were not found for this homework class and section');

  await prisma.$transaction(async (tx) => {
    for (const item of payload.evaluations) {
      await tx.homeworkEvaluation.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId: item.studentId } },
        update: {
          marks: item.marks === undefined || item.marks === null ? null : new Prisma.Decimal(item.marks),
          comments: nullableText(item.comments),
          qualityStatus: item.qualityStatus,
          completionStatus: item.completionStatus,
          evaluationDate: payload.evaluationDate,
          evaluatedById: userId,
        },
        create: {
          schoolId,
          homeworkId,
          studentId: item.studentId,
          marks: item.marks === undefined || item.marks === null ? null : new Prisma.Decimal(item.marks),
          comments: nullableText(item.comments),
          qualityStatus: item.qualityStatus,
          completionStatus: item.completionStatus,
          evaluationDate: payload.evaluationDate,
          evaluatedById: userId,
        },
      });
    }

    await tx.homework.update({
      where: { id: homeworkId },
      data: { evaluationDate: payload.evaluationDate, evaluatedById: userId },
    });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'HOMEWORK_EVALUATION',
    entityId: homeworkId,
    action: 'UPSERT',
    afterState: { evaluationDate: payload.evaluationDate, studentCount: payload.evaluations.length },
  });

  const [updatedHomework, studentsAfter, evaluationsAfter] = await Promise.all([
    getHomeworkOrThrow(schoolId, homeworkId),
    prisma.student.findMany({
      where: {
        schoolId,
        classId: homework.classId,
        sectionId: homework.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true },
      orderBy: [{ admissionNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.homeworkEvaluation.findMany({ where: { schoolId, homeworkId } }),
  ]);

  const evaluationByStudent = new Map(evaluationsAfter.map((item) => [item.studentId, item]));
  res.status(200).json({
    homework: updatedHomework,
    rows: studentsAfter.map((student) => ({
      student,
      evaluation: evaluationByStudent.get(student.id) ?? null,
    })),
  });
};

export const getHomeworkEvaluationReport = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;

  const homeworks = await prisma.homework.findMany({
    where: {
      schoolId,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
    },
    include: includeHomework,
    orderBy: [{ homeworkDate: 'desc' }, { createdAt: 'desc' }],
  });

  const rows = await Promise.all(
    homeworks.map(async (homework) => {
      const [totalStudents, completedCount] = await Promise.all([
        prisma.student.count({
          where: {
            schoolId,
            classId: homework.classId,
            sectionId: homework.sectionId,
            status: { not: 'DISABLED' },
          },
        }),
        prisma.homeworkEvaluation.count({
          where: { schoolId, homeworkId: homework.id, completionStatus: 'COMPLETED' },
        }),
      ]);
      const percent = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 10000) / 100 : 0;
      return { homework, totalStudents, completedCount, percent };
    }),
  );

  res.status(200).json(rows);
};

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported document type'));
  }
};

export const homeworkAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadHomeworkAttachment = async (req: Request, res: Response) => {
  const { schoolId } = requireHomeworkManager(req, getRequestedSchoolId(req));
  if (!req.file) throw new HttpError(400, 'No file uploaded');

  const ext = path.extname(req.file.originalname).toLowerCase();
  const filename = `${crypto.randomUUID()}${ext || ''}`;
  const key = `schools/${schoolId}/homework/${filename}`;
  const uploaded = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });

  res.status(201).json({
    url: uploaded.url,
    filename: req.file.originalname,
    storedFilename: filename,
    contentType: req.file.mimetype,
    size: req.file.size,
  });
};
