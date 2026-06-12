import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations, requirePermission, requireRole } from '../middlewares/rbac.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  attendancePeriodCreateSchema,
  attendancePeriodUpdateSchema,
  attendanceSessionParamsSchema,
  attendanceSummaryQuerySchema,
  createAttendanceSessionSchema,
  listLegacyAttendanceSessionsQuerySchema,
  lockAttendanceSessionSchema,
  markLegacyAttendanceSchema,
  overrideLegacyAttendanceSchema,
  startLegacyAttendanceSessionSchema,
  teacherSelfAttendanceListQuerySchema,
  teacherSelfAttendanceSchema,
  updateAttendanceSessionSchema,
  uuidParamsSchema,
} from '../validations/attendance.validation';
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
import {
  cancelAttendanceSubstitutionApi,
  createAttendanceSubstitutionApi,
  listAttendanceSubstitutionsApi,
} from '../controllers/attendanceSubstitution.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

export const attendanceRouter = Router();

attendanceRouter.use(authMiddleware);
attendanceRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'));

// Attendance P1 endpoints
attendanceRouter.post('/sessions', requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(createAttendanceSessionSchema), createAttendanceSessionApi);
attendanceRouter.patch('/sessions/:id', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(updateAttendanceSessionSchema), updateAttendanceSessionApi);
attendanceRouter.post('/sessions/:id/lock', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(lockAttendanceSessionSchema), lockAttendanceSessionApi);
attendanceRouter.get('/summary', requirePermission(P.attendanceView, P.attendanceReport), validateQuery(attendanceSummaryQuerySchema), attendanceSummaryApi);
attendanceRouter.post('/teacher/self', requireRole('SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'), validateBody(teacherSelfAttendanceSchema), markTeacherSelfAttendanceApi);
attendanceRouter.get('/teacher/self', requireRole('SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'), validateQuery(teacherSelfAttendanceListQuerySchema), listTeacherSelfAttendanceApi);
attendanceRouter.post('/substitutions', requirePermission(P.attendanceSubstituteManage), createAttendanceSubstitutionApi);
attendanceRouter.get('/substitutions', requirePermission(P.attendanceSubstituteManage), listAttendanceSubstitutionsApi);
attendanceRouter.patch('/substitutions/:id/cancel', requirePermission(P.attendanceSubstituteManage), cancelAttendanceSubstitutionApi);

// Legacy attendance endpoints retained for backward compatibility
attendanceRouter.post('/periods', requirePermission(P.attendanceEdit), validateBody(attendancePeriodCreateSchema), createAttendancePeriod);
attendanceRouter.get('/periods', requirePermission(P.attendanceView), listAttendancePeriods);
attendanceRouter.get('/periods/:id', requirePermission(P.attendanceView), validateParams(uuidParamsSchema), getAttendancePeriod);
attendanceRouter.patch('/periods/:id', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendancePeriodUpdateSchema), updateAttendancePeriod);
attendanceRouter.delete('/periods/:id', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), deleteAttendancePeriod);

attendanceRouter.post('/legacy/sessions', requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(startLegacyAttendanceSessionSchema), startSession);
attendanceRouter.get('/legacy/sessions', requirePermission(P.attendanceView), validateQuery(listLegacyAttendanceSessionsQuerySchema), listSessions);
attendanceRouter.post('/legacy/sessions/:id/close', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), closeSession);
attendanceRouter.post('/legacy/records', requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(markLegacyAttendanceSchema), idempotencyMiddleware, markAttendance);
attendanceRouter.patch('/legacy/records/:id/override', requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(overrideLegacyAttendanceSchema), overrideAttendance);
attendanceRouter.get('/legacy/sessions/:sessionId/records', requirePermission(P.attendanceView), validateParams(attendanceSessionParamsSchema), listSessionRecords);
