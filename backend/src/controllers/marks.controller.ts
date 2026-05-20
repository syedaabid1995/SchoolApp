import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { calculateGrade, getExamGradingSettings } from '../services/grade.service';
import { logAudit } from '../utils/audit';
import { invalidateAdminDashboardCache, invalidateAttendanceCache } from '../services/cache/cache.invalidation';
import { buildQueryFingerprint, cacheKeys } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';

const createPaperSchema = z.object({
  examId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  maxMarks: z.number().positive(),
  passMarks: z.number().min(0).optional(),
  weightage: z.number().positive().optional(),
  schoolId: z.string().uuid().optional(),
});

const uploadMarksSchema = z.object({
  examPaperId: z.string().uuid(),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        marks: z.number().min(0),
      }),
    ),
  status: z.enum(['DRAFT', 'SUBMITTED', 'LOCKED']).optional(),
  schoolId: z.string().uuid().optional(),
});

const moderationSchema = z.object({
  adjustedMarks: z.number().min(0),
  reason: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

const revaluationSchema = z.object({
  remarks: z.string().min(1).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createExamPaper = async (req: Request, res: Response) => {
  const payload = createPaperSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const exam = await prisma.exam.findFirst({
    where: { id: payload.examId, schoolId },
    select: { id: true },
  });

  if (!exam) {
    throw new HttpError(404, 'Exam not found');
  }

  const subject = await prisma.subject.findFirst({
    where: { id: payload.subjectId, schoolId },
    select: { id: true },
  });

  if (!subject) {
    throw new HttpError(404, 'Subject not found');
  }

  const cls = await prisma.class.findFirst({
    where: { id: payload.classId, schoolId },
    select: { id: true },
  });

  if (!cls) {
    throw new HttpError(404, 'Class not found');
  }

  const paper = await prisma.examPaper.create({
    data: {
      examId: payload.examId,
      subjectId: payload.subjectId,
      classId: payload.classId,
      maxMarks: payload.maxMarks,
      passMarks: payload.passMarks ?? 0,
      weightage: payload.weightage ?? 1,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_PAPER',
    entityId: paper.id,
    action: 'CREATE',
    afterState: {
      examId: paper.examId,
      subjectId: paper.subjectId,
      classId: paper.classId,
      maxMarks: paper.maxMarks,
      passMarks: paper.passMarks,
      weightage: paper.weightage,
    },
  });
  await invalidateAdminDashboardCache(schoolId);

  res.status(201).json(paper);
};

export const uploadMarks = async (req: Request, res: Response) => {
  const payload = uploadMarksSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const status = payload.status ?? 'SUBMITTED';

  const paper = await prisma.examPaper.findFirst({
    where: { id: payload.examPaperId, exam: { schoolId } },
  });

  if (!paper) {
    throw new HttpError(404, 'Exam paper not found');
  }
  if (payload.entries.length === 0) {
    await logAudit(req, {
      schoolId,
      entityType: 'MARKS',
      entityId: payload.examPaperId,
      action: 'UPLOAD',
      afterState: {
        examPaperId: payload.examPaperId,
        status,
        entries: 0,
      },
    });
    res.status(200).json({ results: [] });
    return;
  }

  const gradingSettings = await getExamGradingSettings(schoolId);

  const results = await prisma.$transaction(async (tx) => {
    const created = [] as Array<{ studentId: string; grade: string }>; 
    for (const entry of payload.entries) {
      const student = await tx.student.findFirst({
        where: { id: entry.studentId, schoolId },
        select: { id: true },
      });

      if (!student) {
        throw new HttpError(404, `Student not found: ${entry.studentId}`);
      }

      if (entry.marks > paper.maxMarks) {
        throw new HttpError(422, 'Marks exceed max marks');
      }

      const grade = calculateGrade(entry.marks, paper.maxMarks, gradingSettings.gradeScale);

      const mark = await tx.mark.upsert({
        where: { examPaperId_studentId: { examPaperId: paper.id, studentId: entry.studentId } },
        update: { marks: entry.marks, grade, status },
        create: {
          examPaperId: paper.id,
          studentId: entry.studentId,
          marks: entry.marks,
          grade,
          status,
        },
      });

      created.push({ studentId: mark.studentId, grade: mark.grade ?? '' });
    }

    return created;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'MARKS',
    entityId: payload.examPaperId,
    action: 'UPLOAD',
    afterState: {
      examPaperId: payload.examPaperId,
      status,
      entries: payload.entries.length,
    },
  });
  await invalidateAdminDashboardCache(schoolId);
  await invalidateAttendanceCache(schoolId);

  res.status(200).json({ results });
};

export const listMarks = async (req: Request, res: Response) => {
  const examPaperId = req.query.examPaperId as string | undefined;
  if (!examPaperId) {
    throw new HttpError(400, 'examPaperId is required');
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const queryFingerprint = buildQueryFingerprint({ schoolId, examPaperId });
  const { value: marks, status } = await rememberCache(
    cacheKeys.marksList(schoolId, queryFingerprint),
    cacheTTL.ATTENDANCE,
    () =>
      prisma.mark.findMany({
        where: { examPaperId, examPaper: { exam: { schoolId } } },
        select: {
          id: true,
          studentId: true,
          marks: true,
          grade: true,
          status: true,
          moderated: true,
        },
      }),
  );
  setCacheHeader(res, status);

  res.status(200).json(marks);
};

export const moderateMark = async (req: Request, res: Response) => {
  const payload = moderationSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const { id } = req.params;

  const mark = await prisma.mark.findFirst({
    where: { id, examPaper: { exam: { schoolId } } },
    include: { examPaper: true },
  });

  if (!mark) {
    throw new HttpError(404, 'Mark not found');
  }

  if (payload.adjustedMarks > mark.examPaper.maxMarks) {
    throw new HttpError(422, 'Adjusted marks exceed max marks');
  }

  const gradingSettings = await getExamGradingSettings(schoolId);
  const grade = calculateGrade(payload.adjustedMarks, mark.examPaper.maxMarks, gradingSettings.gradeScale);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMark = await tx.mark.update({
      where: { id },
      data: {
        marks: payload.adjustedMarks,
        grade,
        moderated: true,
      },
    });

    await tx.markModeration.create({
      data: {
        markId: id,
        adjustedMarks: payload.adjustedMarks,
        reason: payload.reason ?? null,
        approvedById: auth.userId,
      },
    });

    return updatedMark;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'MARK',
    entityId: id,
    action: 'MODERATE',
    beforeState: { marks: mark.marks, grade: mark.grade },
    afterState: { marks: updated.marks, grade: updated.grade, moderated: true },
  });
  await invalidateAdminDashboardCache(schoolId);

  res.status(200).json(updated);
};

export const requestRevaluation = async (req: Request, res: Response) => {
  const payload = revaluationSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const { id } = req.params;

  const mark = await prisma.mark.findFirst({
    where: { id, examPaper: { exam: { schoolId } } },
    select: { id: true },
  });

  if (!mark) {
    throw new HttpError(404, 'Mark not found');
  }

  const revaluation = await prisma.markRevaluation.create({
    data: {
      markId: id,
      requestedById: auth.userId,
      remarks: payload.remarks ?? null,
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'MARK',
    entityId: id,
    action: 'REVALUATION_REQUEST',
    afterState: { remarks: payload.remarks ?? null },
  });
  await invalidateAdminDashboardCache(schoolId);

  res.status(201).json(revaluation);
};
