import type { Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  bulkUpsertTimetableEntries,
  createTimetableVersion,
  getTeacherTimetableByDate,
  listTimetableEntries,
  listTimetableTeachers,
  listTimetableVersions,
  publishTimetableVersion,
} from '../services/timetable.service';

const createVersionSchema = z.object({
  schoolId: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1),
  effectiveFrom: z.string().min(1),
  effectiveTo: z.string().optional().nullable(),
});

const bulkEntriesSchema = z.object({
  schoolId: z.string().uuid().optional(),
  timetableVersionId: z.string().uuid(),
  replace: z.boolean().optional(),
  entries: z
    .array(
      z.object({
        classId: z.string().uuid(),
        sectionId: z.string().uuid().optional().nullable(),
        attendancePeriodId: z.string().uuid(),
        dayOfWeek: z.number().int().min(1).max(6),
        subjectId: z.string().uuid(),
        teacherId: z.string().uuid(),
        room: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      }),
    )
    .min(1),
});

const publishSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

const teacherViewSchema = z.object({
  schoolId: z.string().uuid().optional(),
  date: z.string().optional(),
  academicYearId: z.string().uuid().optional(),
});

const listEntriesSchema = z.object({
  schoolId: z.string().uuid().optional(),
  timetableVersionId: z.string().uuid(),
  dayOfWeek: z.coerce.number().int().min(1).max(6).optional(),
});

const listTeachersSchema = z.object({
  schoolId: z.string().uuid().optional(),
  query: z.string().optional(),
});

const requireAuth = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

export const createTimetableVersionApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = createVersionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const version = await createTimetableVersion({
    schoolId,
    academicYearId: payload.academicYearId,
    name: payload.name,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo ?? null,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });

  res.status(201).json(version);
};

export const listTimetableVersionsApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const academicYearId = typeof req.query.academicYearId === 'string' ? req.query.academicYearId : undefined;
  const versions = await listTimetableVersions({ schoolId, academicYearId });
  res.status(200).json(versions);
};

export const bulkUpsertTimetableEntriesApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = bulkEntriesSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const items = await bulkUpsertTimetableEntries({
    schoolId,
    timetableVersionId: payload.timetableVersionId,
    replace: payload.replace ?? false,
    entries: payload.entries.map((entry) => ({
      classId: entry.classId,
      sectionId: entry.sectionId ?? null,
      attendancePeriodId: entry.attendancePeriodId,
      dayOfWeek: entry.dayOfWeek,
      subjectId: entry.subjectId,
      teacherId: entry.teacherId,
      room: entry.room ?? null,
      isActive: entry.isActive ?? true,
    })),
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });

  res.status(200).json(items);
};

export const publishTimetableVersionApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = publishSchema.parse(req.body ?? {});
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const published = await publishTimetableVersion({
    schoolId,
    timetableVersionId: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(200).json(published);
};

export const getTeacherTimetableApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = teacherViewSchema.parse({
    schoolId: req.query.schoolId,
    date: req.query.date,
    academicYearId: req.query.academicYearId,
  });
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const result = await getTeacherTimetableByDate({
    schoolId,
    userId: auth.userId,
    date: payload.date,
    academicYearId: payload.academicYearId,
  });
  res.status(200).json(result);
};

export const listTimetableEntriesApi = async (req: Request, res: Response) => {
  const payload = listEntriesSchema.parse({
    schoolId: req.query.schoolId,
    timetableVersionId: req.query.timetableVersionId,
    dayOfWeek: req.query.dayOfWeek,
  });
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const items = await listTimetableEntries({
    schoolId,
    timetableVersionId: payload.timetableVersionId,
    dayOfWeek: payload.dayOfWeek,
  });
  res.status(200).json(items);
};

export const listTimetableTeachersApi = async (req: Request, res: Response) => {
  const payload = listTeachersSchema.parse({
    schoolId: req.query.schoolId,
    query: req.query.query,
  });
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const items = await listTimetableTeachers({ schoolId, query: payload.query });
  res.status(200).json(items);
};
