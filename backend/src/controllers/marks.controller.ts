import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { calculateGrade } from '../services/grade.service';

const createPaperSchema = z.object({
  examId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  maxMarks: z.number().positive(),
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
    )
    .min(1),
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
      weightage: payload.weightage ?? 1,
    },
  });

  res.status(201).json(paper);
};

export const uploadMarks = async (req: Request, res: Response) => {
  const payload = uploadMarksSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const paper = await prisma.examPaper.findFirst({
    where: { id: payload.examPaperId, exam: { schoolId } },
  });

  if (!paper) {
    throw new HttpError(404, 'Exam paper not found');
  }

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

      const grade = calculateGrade(entry.marks, paper.maxMarks);

      const mark = await tx.mark.upsert({
        where: { examPaperId_studentId: { examPaperId: paper.id, studentId: entry.studentId } },
        update: { marks: entry.marks, grade },
        create: {
          examPaperId: paper.id,
          studentId: entry.studentId,
          marks: entry.marks,
          grade,
        },
      });

      created.push({ studentId: mark.studentId, grade: mark.grade ?? '' });
    }

    return created;
  });

  res.status(200).json({ results });
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

  const grade = calculateGrade(payload.adjustedMarks, mark.examPaper.maxMarks);

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

  res.status(201).json(revaluation);
};
