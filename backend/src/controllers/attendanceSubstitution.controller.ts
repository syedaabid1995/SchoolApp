import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  cancelTeacherAttendanceSubstitution,
  createTeacherAttendanceSubstitution,
  listTeacherAttendanceSubstitutions,
} from '../services/attendanceP1.service';

const createSchema = z.object({
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  date: z.coerce.date(),
  originalTeacherId: z.string().uuid().optional(),
  substituteTeacherId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

const listSchema = z.object({
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  substituteTeacherId: z.string().uuid().optional(),
  originalTeacherId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

const cancelSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
});

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

export const createAttendanceSubstitutionApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const substitution = await createTeacherAttendanceSubstitution({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    classId: payload.classId,
    sectionId: payload.sectionId,
    date: payload.date,
    substituteTeacherId: payload.substituteTeacherId,
    originalTeacherId: payload.originalTeacherId,
    reason: payload.reason,
  });

  res.status(201).json(substitution);
};

export const listAttendanceSubstitutionsApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = listSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const substitutions = await listTeacherAttendanceSubstitutions({
    schoolId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    substituteTeacherId: payload.substituteTeacherId,
    originalTeacherId: payload.originalTeacherId,
    date: payload.date,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  });

  res.status(200).json(substitutions);
};

export const cancelAttendanceSubstitutionApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = cancelSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const canceled = await cancelTeacherAttendanceSubstitution({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    substitutionId: req.params.id,
    reason: payload.reason,
  });

  res.status(200).json(canceled);
};
