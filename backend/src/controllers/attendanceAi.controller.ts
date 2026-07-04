import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  type AttendanceAiPhotoInput,
  loadAttendancePhotosFromKeys,
  recognizeAttendancePhotos,
  storeAttendancePhotos,
} from '../services/attendanceAi.service';
import { ensureTeacherAssignedToClassSection, isAdminRole } from '../services/attendanceP1.service';
import { getAttendanceSheet } from '../services/attendanceSheet.service';

const optionalUuid = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}, z.string().uuid().optional());

const parsePhotoKeys = (value: unknown) => {
  if (Array.isArray(value)) return value.flatMap(parsePhotoKeys);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    // Comma separated form values are supported for simple clients.
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

const attendanceAiScopeSchema = z
  .object({
    schoolId: optionalUuid,
    academicYearId: z.string().uuid(),
    classId: z.string().uuid(),
    sectionId: optionalUuid,
    date: z.coerce.date(),
    unitType: z.enum(['DAY', 'SLOT', 'PERIOD', 'TIMETABLE_ENTRY']),
    slotId: optionalUuid,
    slotType: z.enum(['MORNING', 'AFTERNOON']).optional(),
    periodId: optionalUuid,
    timetableEntryId: optionalUuid,
    photoKeys: z.preprocess(parsePhotoKeys, z.array(z.string()).optional()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.unitType === 'SLOT' && !value.slotId && !value.slotType) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slotId'], message: 'slotId or slotType is required for SLOT attendance' });
    }
    if (value.unitType === 'PERIOD' && !value.periodId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periodId'], message: 'periodId is required for PERIOD attendance' });
    }
    if (value.unitType === 'TIMETABLE_ENTRY' && !value.timetableEntryId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timetableEntryId'],
        message: 'timetableEntryId is required for TIMETABLE_ENTRY attendance',
      });
    }
  });

const filesFromRequest = (req: Request): AttendanceAiPhotoInput[] => {
  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
  return files.map((file) => ({
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalname: file.originalname,
  }));
};

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const ensureAttendanceEnabled = () => {
  if (!env.ATTENDANCE_ENABLED) throw new HttpError(503, 'Attendance module is disabled');
};

const ensureAiAttendanceAccess = async (params: {
  schoolId: string;
  actorId: string;
  actorRole: string;
  classId: string;
  sectionId?: string | null;
  date: Date;
}) => {
  if (isAdminRole(params.actorRole)) return;
  await ensureTeacherAssignedToClassSection({
    schoolId: params.schoolId,
    userId: params.actorId,
    classId: params.classId,
    sectionId: params.sectionId ?? undefined,
    date: params.date,
  });
};

export const uploadAttendanceAiPhotosApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = attendanceAiScopeSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const photos = filesFromRequest(req);
  if (!photos.length) throw new HttpError(400, 'At least one attendance photo is required');

  await ensureAiAttendanceAccess({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    classId: payload.classId,
    sectionId: payload.sectionId,
    date: payload.date,
  });
  await getAttendanceSheet({
    schoolId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    date: payload.date,
    unitType: payload.unitType,
    slotId: payload.slotId,
    slotType: payload.slotType,
    periodId: payload.periodId,
    timetableEntryId: payload.timetableEntryId,
  });

  const stored = await storeAttendancePhotos({ schoolId, photos });
  res.status(201).json({ photos: stored });
};

export const recognizeAttendanceAiApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = attendanceAiScopeSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const uploadedPhotos = filesFromRequest(req);
  const storedPhotos = await loadAttendancePhotosFromKeys(payload.photoKeys ?? []);
  const photos = [...uploadedPhotos, ...storedPhotos];
  if (!photos.length) throw new HttpError(400, 'At least one attendance photo is required');
  if (photos.length > 5) throw new HttpError(400, 'A maximum of five attendance photos can be processed at once');

  const result = await recognizeAttendancePhotos({
    schoolId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    date: payload.date,
    unitType: payload.unitType,
    slotId: payload.slotId,
    slotType: payload.slotType,
    periodId: payload.periodId,
    timetableEntryId: payload.timetableEntryId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    photos,
  });

  res.status(200).json(result);
};
