import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import {
  createAttendancePeriod,
  listAttendancePeriods,
  getAttendancePeriod,
  updateAttendancePeriod,
  deleteAttendancePeriod,
} from '../controllers/attendance-period.controller';
import {
  startSession,
  markAttendance,
  closeSession,
  overrideAttendance,
  listSessionRecords,
  listSessions,
} from '../controllers/attendance.controller';
import {
  attendanceSummaryApi,
  createAttendanceSessionApi,
  listTeacherSelfAttendanceApi,
  lockAttendanceSessionApi,
  markTeacherSelfAttendanceApi,
  updateAttendanceSessionApi,
} from '../controllers/attendanceP1.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

export const attendanceRouter = Router();

attendanceRouter.use(authMiddleware);

// Attendance P1 endpoints
attendanceRouter.post('/sessions', requireRole('SCHOOL_ADMIN', 'TEACHER'), createAttendanceSessionApi);
attendanceRouter.patch('/sessions/:id', requireRole('SCHOOL_ADMIN', 'TEACHER'), updateAttendanceSessionApi);
attendanceRouter.post('/sessions/:id/lock', requireRole('SCHOOL_ADMIN'), lockAttendanceSessionApi);
attendanceRouter.get('/summary', requireRole('SCHOOL_ADMIN', 'TEACHER'), attendanceSummaryApi);
attendanceRouter.post('/teacher/self', requireRole('SCHOOL_ADMIN', 'TEACHER'), markTeacherSelfAttendanceApi);
attendanceRouter.get('/teacher/self', requireRole('SCHOOL_ADMIN', 'TEACHER'), listTeacherSelfAttendanceApi);

// Legacy attendance endpoints retained for backward compatibility
attendanceRouter.post('/periods', createAttendancePeriod);
attendanceRouter.get('/periods', listAttendancePeriods);
attendanceRouter.get('/periods/:id', getAttendancePeriod);
attendanceRouter.patch('/periods/:id', updateAttendancePeriod);
attendanceRouter.delete('/periods/:id', deleteAttendancePeriod);

attendanceRouter.post('/legacy/sessions', startSession);
attendanceRouter.get('/legacy/sessions', listSessions);
attendanceRouter.post('/legacy/sessions/:id/close', closeSession);
attendanceRouter.post('/legacy/records', idempotencyMiddleware, markAttendance);
attendanceRouter.patch('/legacy/records/:id/override', overrideAttendance);
attendanceRouter.get('/legacy/sessions/:sessionId/records', listSessionRecords);
