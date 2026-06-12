import type { Request, Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import {
  attendanceSummaryQuerySchema,
  createAttendanceSessionSchema,
  lockAttendanceSessionSchema,
  teacherSelfAttendanceListQuerySchema,
  teacherSelfAttendanceSchema,
  updateAttendanceSessionSchema,
} from '../validations/attendance.validation';
import {
  createStudentAttendanceSession,
  ensureTeacherAssignedToClassSection,
  getAttendanceSummary,
  isAdminRole,
  listTeacherSelfAttendance,
  lockStudentAttendanceSession,
  markTeacherSelfAttendance,
  updateStudentAttendanceSession,
} from '../services/attendanceP1.service';

const requireAuth = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const ensureAttendanceEnabled = () => {
  if (!env.ATTENDANCE_ENABLED) throw new HttpError(503, 'Attendance module is disabled');
};

export const createAttendanceSessionApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = createAttendanceSessionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const sectionCount = await prisma.section.count({
    where: { classId: payload.classId, class: { schoolId } },
  });
  if (sectionCount > 0 && !payload.sectionId) {
    throw new HttpError(400, 'sectionId is required for classes with sections');
  }

  if (!isAdminRole(auth.role)) {
    await ensureTeacherAssignedToClassSection({
      schoolId,
      userId: auth.userId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      date: payload.date,
    });
  }

  const session = await createStudentAttendanceSession({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    classId: payload.classId,
    sectionId: payload.sectionId,
    date: payload.date,
  });

  res.status(201).json(session);
};

export const updateAttendanceSessionApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = updateAttendanceSessionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const updated = await updateStudentAttendanceSession({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    sessionId: req.params.id,
    records: payload.records.map((record) => ({
      studentId: record.studentId,
      status: record.status,
      remarks: record.remarks,
    })),
    submit: payload.submit,
    unlock: payload.unlock,
    reason: payload.reason,
  });

  res.status(200).json(updated);
};

export const lockAttendanceSessionApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = lockAttendanceSessionSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const locked = await lockStudentAttendanceSession({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    sessionId: req.params.id,
    reason: payload.reason,
  });

  res.status(200).json(locked);
};

export const attendanceSummaryApi = async (req: Request, res: Response) => {
  ensureAttendanceEnabled();
  const auth = requireAuth(req);
  const payload = attendanceSummaryQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const summary = await getAttendanceSummary({
    schoolId,
    date: payload.date,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
  });
  res.status(200).json(summary);
};

export const markTeacherSelfAttendanceApi = async (req: Request, res: Response) => {
  if (!env.ATTENDANCE_ENABLED || !env.TEACHER_SELF_ATTENDANCE_ENABLED) {
    throw new HttpError(503, 'Teacher self attendance is disabled');
  }
  const auth = requireAuth(req);
  const payload = teacherSelfAttendanceSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const attendance = await markTeacherSelfAttendance({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    status: payload.status,
    date: payload.date,
    teacherId: payload.teacherId,
    overrideReason: payload.overrideReason,
    leaveRequestId: payload.leaveRequestId,
  });

  res.status(201).json(attendance);
};

export const listTeacherSelfAttendanceApi = async (req: Request, res: Response) => {
  if (!env.ATTENDANCE_ENABLED || !env.TEACHER_SELF_ATTENDANCE_ENABLED) {
    throw new HttpError(503, 'Teacher self attendance is disabled');
  }
  const auth = requireAuth(req);
  const payload = teacherSelfAttendanceListQuerySchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const records = await listTeacherSelfAttendance({
    schoolId,
    actorId: auth.userId,
    actorRole: auth.role ?? 'UNKNOWN',
    teacherId: payload.teacherId,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  });

  res.status(200).json(records);
};
