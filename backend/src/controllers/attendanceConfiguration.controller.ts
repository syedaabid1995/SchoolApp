import type { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  attendanceConfigurationBulkApplySchema,
  attendanceConfigurationCreateSchema,
  attendanceConfigurationDeactivateSchema,
  attendanceConfigurationListQuerySchema,
  attendanceConfigurationUpdateSchema,
} from '../validations/attendance.validation';
import {
  bulkApplyAttendanceConfiguration,
  createAttendanceConfiguration,
  deactivateAttendanceConfiguration,
  listAttendanceConfigurations,
  updateAttendanceConfiguration,
} from '../services/attendanceConfiguration.service';

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

export const listAttendanceConfigurationsApi = async (req: Request, res: Response) => {
  requireAuth(req);
  const payload = attendanceConfigurationListQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const rows = await listAttendanceConfigurations({
    schoolId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    active: payload.active,
  });
  res.status(200).json(rows);
};

export const createAttendanceConfigurationApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = attendanceConfigurationCreateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const created = await createAttendanceConfiguration({
    schoolId,
    scope: payload.scope,
    mode: payload.mode,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo,
    isActive: payload.isActive,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(201).json(created);
};

export const bulkApplyAttendanceConfigurationApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = attendanceConfigurationBulkApplySchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const created = await bulkApplyAttendanceConfiguration({
    schoolId,
    scope: payload.scope,
    mode: payload.mode,
    academicYearId: payload.academicYearId,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo,
    replaceExisting: payload.replaceExisting,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(201).json({ count: created.length, items: created });
};

export const updateAttendanceConfigurationApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = attendanceConfigurationUpdateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const updated = await updateAttendanceConfiguration(req.params.id, {
    schoolId,
    scope: payload.scope,
    mode: payload.mode,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    effectiveFrom: payload.effectiveFrom,
    effectiveTo: payload.effectiveTo,
    isActive: payload.isActive,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(200).json(updated);
};

export const deactivateAttendanceConfigurationApi = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = attendanceConfigurationDeactivateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const updated = await deactivateAttendanceConfiguration({
    id: req.params.id,
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(200).json(updated);
};
