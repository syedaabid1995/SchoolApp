import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middlewares/error.middleware';
import { prisma } from '../config/db';
import {
  getExamGradingSettings,
  saveExamGradingSettings,
  type ExamGradingSettings,
} from '../services/grade.service';
import { logAudit } from '../utils/audit';
import { invalidateAdminDashboardCache } from '../services/cache/cache.invalidation';

const gradeRowSchema = z.object({
  grade: z.string().trim().min(1).max(20),
  minPercentage: z.number().min(0).max(100),
  maxPercentage: z.number().min(0).max(100),
  status: z.enum(['PASS', 'FAIL']),
}).refine((row) => row.maxPercentage >= row.minPercentage, {
  message: '% Upto must be greater than or equal to % From',
});

const failCriteriaSchema = z.object({
  overallPercentage: z.number().min(0).max(100),
  subjectPercentage: z.number().min(0).max(100),
  minimumFailedSubjects: z.number().int().min(1).max(20),
});

const settingsSchema = z.object({
  gradeScale: z.array(gradeRowSchema).min(1).max(20),
  failCriteria: failCriteriaSchema,
});

const requireSchoolAdminSchoolId = (req: Request) => {
  if (req.auth?.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    throw new HttpError(403, 'Only School Admin can manage marks grading settings');
  }
  return req.auth.schoolId;
};

const validateNoRangeOverlap = (gradeScale: ExamGradingSettings['gradeScale']) => {
  const sorted = [...gradeScale].sort((a, b) => a.minPercentage - b.minPercentage);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.minPercentage <= previous.maxPercentage) {
      throw new HttpError(400, `Grade ranges overlap: ${previous.grade} and ${current.grade}`);
    }
  }
};

const recalculateExistingMarks = async (schoolId: string, gradeScale: ExamGradingSettings['gradeScale']) => {
  const marks = await prisma.mark.findMany({
    where: { examPaper: { exam: { schoolId } } },
    select: {
      id: true,
      marks: true,
      examPaper: { select: { maxMarks: true } },
    },
  });

  let updatedCount = 0;
  for (const mark of marks) {
    if (mark.examPaper.maxMarks <= 0) continue;
    const percentage = (mark.marks / mark.examPaper.maxMarks) * 100;
    const grade = gradeScale.find((row) => percentage >= row.minPercentage && percentage <= row.maxPercentage)?.grade ?? 'F';
    await prisma.mark.update({
      where: { id: mark.id },
      data: { grade },
    });
    updatedCount += 1;
  }

  return updatedCount;
};

export const getExamGradingSettingsApi = async (req: Request, res: Response) => {
  const schoolId = requireSchoolAdminSchoolId(req);
  const settings = await getExamGradingSettings(schoolId);
  res.status(200).json(settings);
};

export const updateExamGradingSettingsApi = async (req: Request, res: Response) => {
  const schoolId = requireSchoolAdminSchoolId(req);
  const settings = settingsSchema.parse(req.body) as ExamGradingSettings;
  validateNoRangeOverlap(settings.gradeScale);

  const saved = await saveExamGradingSettings(schoolId, settings);
  const recalculatedMarks = await recalculateExistingMarks(schoolId, saved.gradeScale);

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_GRADING_SETTING',
    entityId: schoolId,
    action: 'UPDATE',
    afterState: {
      gradeCount: saved.gradeScale.length,
      failCriteria: saved.failCriteria,
      recalculatedMarks,
    },
  });
  await invalidateAdminDashboardCache(schoolId);

  res.status(200).json({ ...saved, recalculatedMarks });
};
