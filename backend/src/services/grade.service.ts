import { HttpError } from '../middlewares/error.middleware';
import { prisma } from '../config/db';

export type GradeScale = {
  minPercentage: number;
  maxPercentage: number;
  grade: string;
  status: 'PASS' | 'FAIL';
};

export type FailCriteria = {
  overallPercentage: number;
  subjectPercentage: number;
  minimumFailedSubjects: number;
};

export type ExamGradingSettings = {
  gradeScale: GradeScale[];
  failCriteria: FailCriteria;
};

export const defaultGradeScale: GradeScale[] = [
  { grade: 'A+', minPercentage: 80, maxPercentage: 100, status: 'PASS' },
  { grade: 'A', minPercentage: 70, maxPercentage: 79, status: 'PASS' },
  { grade: 'B+', minPercentage: 60, maxPercentage: 69, status: 'PASS' },
  { grade: 'B', minPercentage: 50, maxPercentage: 59, status: 'PASS' },
  { grade: 'C', minPercentage: 40, maxPercentage: 49, status: 'PASS' },
  { grade: 'D', minPercentage: 33, maxPercentage: 39, status: 'PASS' },
  { grade: 'F', minPercentage: 0, maxPercentage: 32, status: 'FAIL' },
];

export const defaultFailCriteria: FailCriteria = {
  overallPercentage: 40,
  subjectPercentage: 33,
  minimumFailedSubjects: 1,
};

export const defaultExamGradingSettings: ExamGradingSettings = {
  gradeScale: defaultGradeScale,
  failCriteria: defaultFailCriteria,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const normalizeGradeScale = (value: unknown): GradeScale[] => {
  if (!Array.isArray(value)) return defaultGradeScale;
  const rows = value
    .filter(isRecord)
    .map((row) => ({
      grade: typeof row.grade === 'string' && row.grade.trim() ? row.grade.trim().slice(0, 20) : '',
      minPercentage: normalizeNumber(row.minPercentage ?? row.min ?? row.from, -1),
      maxPercentage: normalizeNumber(row.maxPercentage ?? row.max ?? row.upto, -1),
      status: row.status === 'FAIL' ? 'FAIL' as const : 'PASS' as const,
    }))
    .filter((row) => row.grade && row.minPercentage >= 0 && row.maxPercentage >= row.minPercentage && row.maxPercentage <= 100)
    .slice(0, 20);
  return rows.length ? rows : defaultGradeScale;
};

export const normalizeFailCriteria = (value: unknown): FailCriteria => {
  const source = isRecord(value) ? value : {};
  return {
    overallPercentage: normalizeNumber(source.overallPercentage, defaultFailCriteria.overallPercentage),
    subjectPercentage: normalizeNumber(source.subjectPercentage, defaultFailCriteria.subjectPercentage),
    minimumFailedSubjects: Math.max(1, Math.floor(normalizeNumber(source.minimumFailedSubjects, defaultFailCriteria.minimumFailedSubjects))),
  };
};

export const getExamGradingSettings = async (schoolId: string): Promise<ExamGradingSettings> => {
  const setting = await prisma.examGradingSetting.findUnique({
    where: { schoolId },
    select: { gradeScale: true, failCriteria: true },
  });

  if (!setting) return defaultExamGradingSettings;
  return {
    gradeScale: normalizeGradeScale(setting.gradeScale),
    failCriteria: normalizeFailCriteria(setting.failCriteria),
  };
};

export const saveExamGradingSettings = async (schoolId: string, settings: ExamGradingSettings) => {
  await prisma.examGradingSetting.upsert({
    where: { schoolId },
    update: {
      gradeScale: settings.gradeScale,
      failCriteria: settings.failCriteria,
    },
    create: {
      schoolId,
      gradeScale: settings.gradeScale,
      failCriteria: settings.failCriteria,
    },
  });
  return getExamGradingSettings(schoolId);
};

export const calculateGrade = (score: number, maxMarks: number, scale: GradeScale[] = defaultGradeScale) => {
  if (maxMarks <= 0) {
    throw new HttpError(400, 'Invalid max marks');
  }

  const percentage = (score / maxMarks) * 100;
  const grade = scale.find((item) => percentage >= item.minPercentage && percentage <= item.maxPercentage);
  return grade ? grade.grade : 'F';
};

export const evaluateFailCriteria = (
  marks: Array<{ marks: number; maxMarks: number }>,
  criteria: FailCriteria,
) => {
  const totalMarks = marks.reduce((sum, mark) => sum + mark.marks, 0);
  const totalMaxMarks = marks.reduce((sum, mark) => sum + mark.maxMarks, 0);
  const overallPercentage = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
  const failedSubjects = marks.filter((mark) => {
    if (mark.maxMarks <= 0) return false;
    return (mark.marks / mark.maxMarks) * 100 <= criteria.subjectPercentage;
  }).length;

  const failed =
    overallPercentage <= criteria.overallPercentage ||
    failedSubjects >= criteria.minimumFailedSubjects;

  return {
    status: failed ? 'FAIL' as const : 'PASS' as const,
    overallPercentage,
    failedSubjects,
  };
};
