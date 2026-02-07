import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { logAudit } from '../utils/audit';
import { invalidateAdminDashboardCache, invalidateAttendanceCache } from '../services/cache/cache.invalidation';

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

const subjectMappingSchema = z.object({
  subjectId: z.string().uuid(),
  maxMarks: z.number().positive(),
  passMarks: z.number().min(0),
  scheduledAt: z.coerce.date(),
});

const createSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).optional(),
  subjectIds: z.array(z.string().uuid()).min(1).optional(),
  subjectMappings: z.array(subjectMappingSchema).min(1).optional(),
  type: z.string().min(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  scheduledAt: z.coerce.date().optional(),
  resultPublishAt: z.coerce.date().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  termId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  sectionId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  resultPublishAt: z.coerce.date().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});

export const createExam = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  await ensureDefaultExamTypes(schoolId);

  const examTypeCode = payload.type.trim().toUpperCase();
  const examType = await prisma.examTypeConfig.findFirst({
    where: { schoolId, code: examTypeCode, isActive: true },
  });
  if (!examType) {
    throw new HttpError(400, 'Exam type is not active or not configured');
  }

  const subjectIds = payload.subjectMappings?.map((item) => item.subjectId) ?? payload.subjectIds ?? [];
  if (!subjectIds.length) {
    throw new HttpError(400, 'At least one subject is required');
  }
  if (!payload.subjectMappings?.length) {
    if (!payload.scheduledAt) {
      throw new HttpError(400, 'Subject exam date is required for each subject');
    }
  } else if (payload.subjectMappings.length !== subjectIds.length) {
    throw new HttpError(400, 'Subject exam date is required for every selected subject');
  }

  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds }, schoolId },
    select: { id: true, name: true, classId: true, academicYearId: true },
  });
  if (subjects.length !== subjectIds.length) {
    throw new HttpError(404, 'One or more subjects not found');
  }

  let academicYearId = payload.academicYearId;
  if (!academicYearId) {
    const classIds = Array.from(new Set(subjects.map((s) => s.classId).filter(Boolean))) as string[];
    if (classIds.length === 1) {
      const classRow = await prisma.class.findFirst({
        where: { id: classIds[0], schoolId },
        select: { academicYearId: true },
      });
      if (classRow?.academicYearId) {
        academicYearId = classRow.academicYearId;
      }
    }
  }
  if (!academicYearId) {
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!activeYear) {
      throw new HttpError(404, 'Active academic year not found');
    }
    academicYearId = activeYear.id;
  }

  if (payload.termId) {
    const term = await prisma.term.findFirst({
      where: { id: payload.termId, academicYearId },
      select: { id: true },
    });
    if (!term) {
      throw new HttpError(404, 'Term not found');
    }
  }

  const subjectClassIds = Array.from(new Set(subjects.map((s) => s.classId).filter(Boolean)));
  if (subjectClassIds.length !== 1) {
    throw new HttpError(400, 'Subjects must belong to the same class');
  }
  const classId = subjectClassIds[0] as string;

  const mismatchedYear = subjects.find(
    (s) => s.academicYearId && s.academicYearId !== academicYearId,
  );
  if (mismatchedYear) {
    throw new HttpError(400, 'Subject academic year mismatch');
  }

  const examName = payload.name?.trim() || subjects.map((s) => s.name).join(', ');

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        schoolId,
        academicYearId,
        termId: payload.termId ?? null,
        classId,
        sectionId: payload.sectionId ?? null,
        name: examName,
        type: examTypeCode,
        status: payload.status ?? 'DRAFT',
        scheduledAt: payload.scheduledAt ?? null,
        resultPublishAt: payload.resultPublishAt ?? null,
      },
    });

    const mappingBySubject = new Map(
      (payload.subjectMappings ?? subjectIds.map((subjectId) => ({
        subjectId,
        maxMarks: 100,
        passMarks: 35,
        scheduledAt: payload.scheduledAt as Date,
      }))).map((mapping) => [mapping.subjectId, mapping]),
    );

    await tx.examPaper.createMany({
      data: subjects.map((subject) => {
        const mapping = mappingBySubject.get(subject.id);
        return {
          examId: created.id,
          subjectId: subject.id,
          classId,
          maxMarks: mapping?.maxMarks ?? 100,
          passMarks: mapping?.passMarks ?? 35,
          weightage: 1,
          scheduledAt: mapping?.scheduledAt ?? null,
        };
      }),
    });

    return created;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM',
    entityId: exam.id,
    action: 'CREATE',
    afterState: {
      name: exam.name,
      type: exam.type,
      status: exam.status,
      academicYearId: exam.academicYearId,
      classId: exam.classId,
      sectionId: exam.sectionId,
      scheduledAt: exam.scheduledAt,
      resultPublishAt: exam.resultPublishAt,
      subjects: subjectIds.length,
    },
  });

  await invalidateAdminDashboardCache(schoolId);
  await invalidateAttendanceCache(schoolId);

  res.status(201).json(exam);
};

export const listExams = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const academicYearId = req.query.academicYearId as string | undefined;
  const termId = req.query.termId as string | undefined;
  const classId = req.query.classId as string | undefined;
  const sectionId = req.query.sectionId as string | undefined;

  const exams = await prisma.exam.findMany({
    where: {
      schoolId,
      ...(academicYearId ? { academicYearId } : {}),
      ...(termId ? { termId } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(exams);
};

export const getExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const exam = await prisma.exam.findFirst({
    where: { id, schoolId },
    include: { papers: true },
  });

  if (!exam) {
    throw new HttpError(404, 'Exam not found');
  }

  res.status(200).json(exam);
};

export const updateExam = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const { id } = req.params;

  const existing = await prisma.exam.findFirst({
    where: { id, schoolId },
  });

  if (!existing) {
    throw new HttpError(404, 'Exam not found');
  }

  let nextType = payload.type;
  if (payload.type) {
    await ensureDefaultExamTypes(schoolId);
    const examTypeCode = payload.type.trim().toUpperCase();
    const examType = await prisma.examTypeConfig.findFirst({
      where: { schoolId, code: examTypeCode, isActive: true },
    });
    if (!examType) {
      throw new HttpError(400, 'Exam type is not active or not configured');
    }
    nextType = examTypeCode;
  }

  const exam = await prisma.exam.update({
    where: { id },
    data: {
      termId: payload.termId === undefined ? undefined : payload.termId,
      classId: payload.classId === undefined ? undefined : payload.classId,
      sectionId: payload.sectionId === undefined ? undefined : payload.sectionId,
      name: payload.name ?? undefined,
      type: nextType ?? undefined,
      status: payload.status ?? undefined,
      scheduledAt: payload.scheduledAt === undefined ? undefined : payload.scheduledAt,
      resultPublishAt: payload.resultPublishAt === undefined ? undefined : payload.resultPublishAt,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM',
    entityId: exam.id,
    action: 'UPDATE',
    beforeState: existing ? {
      name: existing.name,
      type: existing.type,
      status: existing.status,
      academicYearId: existing.academicYearId,
      classId: existing.classId,
      sectionId: existing.sectionId,
      scheduledAt: existing.scheduledAt,
      resultPublishAt: existing.resultPublishAt,
    } : null,
    afterState: {
      name: exam.name,
      type: exam.type,
      status: exam.status,
      academicYearId: exam.academicYearId,
      classId: exam.classId,
      sectionId: exam.sectionId,
      scheduledAt: exam.scheduledAt,
      resultPublishAt: exam.resultPublishAt,
    },
  });

  await invalidateAdminDashboardCache(schoolId);
  await invalidateAttendanceCache(schoolId);

  res.status(200).json(exam);
};

export const deleteExam = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const existing = await prisma.exam.findFirst({
    where: { id, schoolId },
  });

  if (!existing) {
    throw new HttpError(404, 'Exam not found');
  }

  await prisma.exam.delete({ where: { id } });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM',
    entityId: id,
    action: 'DELETE',
    beforeState: existing ? {
      name: existing.name,
      type: existing.type,
      status: existing.status,
      academicYearId: existing.academicYearId,
      classId: existing.classId,
      sectionId: existing.sectionId,
      scheduledAt: existing.scheduledAt,
      resultPublishAt: existing.resultPublishAt,
    } : null,
  });

  await invalidateAdminDashboardCache(schoolId);
  await invalidateAttendanceCache(schoolId);

  res.status(204).send();
};
