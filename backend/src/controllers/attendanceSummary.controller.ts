import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { getAttendanceSummary } from '../services/attendanceSummary.service';

const querySchema = z.object({
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const getAttendanceSummaryApi = async (req: Request, res: Response) => {
  const payload = querySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const to = payload.dateTo ?? new Date();
  const from = payload.dateFrom ?? new Date(to.getTime() - 6 * 24 * 60 * 60 * 1000);

  const summary = await getAttendanceSummary({
    schoolId,
    classId: payload.classId,
    dateFrom: from,
    dateTo: to,
  });

  res.status(200).json(summary);
};
