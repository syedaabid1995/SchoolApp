import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { generateTermReport, generateAnnualReport } from '../services/report.service';

const termSchema = z.object({
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const annualSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

export const downloadTermReport = async (req: Request, res: Response) => {
  const payload = termSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const buffer = await generateTermReport({
    schoolId,
    studentId: payload.studentId,
    termId: payload.termId,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="term-report.pdf"');
  res.status(200).send(buffer);
};

export const downloadAnnualReport = async (req: Request, res: Response) => {
  const payload = annualSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const buffer = await generateAnnualReport({
    schoolId,
    studentId: payload.studentId,
    academicYearId: payload.academicYearId,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="annual-report.pdf"');
  res.status(200).send(buffer);
};

export const downloadRankCard = async (_req: Request, _res: Response) => {
  throw new HttpError(501, 'Rank card generation not implemented');
};
