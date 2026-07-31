import type { Request, Response } from 'express';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  attendanceSheetLockSchema,
  attendanceSheetQuerySchema,
  attendanceUnitsQuerySchema,
  resolveAttendanceConfigQuerySchema,
  saveAttendanceSheetSchema,
  studentAttendanceReportQuerySchema,
} from '../validations/attendance.validation';
import {
  getAttendanceSheet,
  lockAttendanceSheet,
  reopenAttendanceSheet,
  resolveAttendanceConfiguration,
  resolveAttendanceUnits,
  saveAttendanceSheet,
} from '../services/attendanceSheet.service';
import { buildStudentAttendanceReport } from '../services/attendanceStudentReport.service';

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const ensureAttendanceEnabled = () => {
  if (!env.ATTENDANCE_ENABLED) throw new HttpError(503, 'Attendance module is disabled');
};

export const resolveAttendanceConfigApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  requireAuth(req);
  const payload = resolveAttendanceConfigQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const scope = {
    schoolId,
    academicYearId: payload.academicYearId!,
    classId: payload.classId!,
    sectionId: payload.sectionId,
    date: payload.date!,
  };

  const [resolved, unitResolution] = await Promise.all([
    resolveAttendanceConfiguration(scope),
    resolveAttendanceUnits(scope),
  ]);

  res.status(200).json({
    ...resolved,
    units: unitResolution.units,
  });
};

export const listAttendanceUnitsApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  requireAuth(req);
  const payload = attendanceUnitsQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const units = await resolveAttendanceUnits({
    schoolId,
    academicYearId: payload.academicYearId!,
    classId: payload.classId!,
    sectionId: payload.sectionId,
    date: payload.date!,
  });
  res.status(200).json(units);
};

export const getAttendanceSheetApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  requireAuth(req);
  const payload = attendanceSheetQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const sheet = await getAttendanceSheet({
    schoolId,
    academicYearId: payload.academicYearId!,
    classId: payload.classId!,
    sectionId: payload.sectionId,
    date: payload.date!,
    unitType: payload.unitType!,
    slotId: payload.slotId,
    slotType: payload.slotType,
    periodId: payload.periodId,
    timetableEntryId: payload.timetableEntryId,
  });
  res.status(200).json(sheet);
};

export const getStudentAttendanceReportApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  requireAuth(req);
  const payload = studentAttendanceReportQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const report = await buildStudentAttendanceReport({
    schoolId,
    academicYearId: payload.academicYearId,
    classId: payload.classId,
    sectionId: payload.sectionId,
    studentId: payload.studentId,
  });
  res.status(200).json(report);
};

export const saveAttendanceSheetApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = saveAttendanceSheetSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const sheet = await saveAttendanceSheet({
    schoolId,
    academicYearId: payload.academicYearId!,
    classId: payload.classId!,
    sectionId: payload.sectionId,
    date: payload.date!,
    unitType: payload.unitType!,
    slotId: payload.slotId,
    slotType: payload.slotType,
    periodId: payload.periodId,
    timetableEntryId: payload.timetableEntryId,
    records: payload.records!.map((record) => ({
      studentId: record.studentId!,
      status: record.status!,
      confidence: record.confidence,
      manualOverrideReason: record.manualOverrideReason,
    })),
    deviceId: payload.deviceId,
    gpsLat: payload.gpsLat,
    gpsLng: payload.gpsLng,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(200).json(sheet);
};

export const lockAttendanceSheetApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = attendanceSheetLockSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const locked = await lockAttendanceSheet({
    schoolId,
    sessionId: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    reason: payload.reason,
  });
  res.status(200).json(locked);
};

export const reopenAttendanceSheetApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = attendanceSheetLockSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const reopened = await reopenAttendanceSheet({
    schoolId,
    sessionId: req.params.id,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    reason: payload.reason,
  });
  res.status(200).json(reopened);
};
