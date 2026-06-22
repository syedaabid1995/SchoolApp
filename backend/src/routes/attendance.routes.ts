import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations, requirePermission } from '../middlewares/rbac.middleware';
import { validateBody, validateParams, validateQuery } from '../middlewares/validation.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  attendancePeriodCreateSchema,
  attendancePeriodUpdateSchema,
  attendanceConfigurationBulkApplySchema,
  attendanceConfigurationCreateSchema,
  attendanceConfigurationDeactivateSchema,
  attendanceConfigurationListQuerySchema,
  attendanceConfigurationUpdateSchema,
  attendanceSheetLockSchema,
  attendanceSheetQuerySchema,
  attendanceSessionParamsSchema,
  attendanceSummaryQuerySchema,
  attendanceUnitsQuerySchema,
  createAttendanceSessionSchema,
  listLegacyAttendanceSessionsQuerySchema,
  lockAttendanceSessionSchema,
  markLegacyAttendanceSchema,
  overrideLegacyAttendanceSchema,
  resolveAttendanceConfigQuerySchema,
  saveAttendanceSheetSchema,
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
  getTeacherSelfAttendanceOptionsApi,
  listTeacherSelfAttendanceApi,
  lockAttendanceSessionApi,
  markTeacherSelfAttendanceApi,
  updateAttendanceSessionApi,
} from '../controllers/attendanceP1.controller';
import {
  bulkApplyAttendanceConfigurationApi,
  createAttendanceConfigurationApi,
  deactivateAttendanceConfigurationApi,
  listAttendanceConfigurationsApi,
  updateAttendanceConfigurationApi,
} from '../controllers/attendanceConfiguration.controller';
import {
  getAttendanceSheetApi,
  listAttendanceUnitsApi,
  lockAttendanceSheetApi,
  reopenAttendanceSheetApi,
  resolveAttendanceConfigApi,
  saveAttendanceSheetApi,
} from '../controllers/attendanceSheet.controller';
import {
  cancelAttendanceSubstitutionApi,
  createAttendanceSubstitutionApi,
  listAttendanceSubstitutionsApi,
} from '../controllers/attendanceSubstitution.controller';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

export const attendanceRouter = Router();

attendanceRouter.use(authMiddleware);

// Attendance P1 endpoints
attendanceRouter.post('/sessions', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(createAttendanceSessionSchema), createAttendanceSessionApi);
attendanceRouter.patch('/sessions/:id', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(updateAttendanceSessionSchema), updateAttendanceSessionApi);
attendanceRouter.post('/sessions/:id/lock', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(lockAttendanceSessionSchema), lockAttendanceSessionApi);
attendanceRouter.get('/summary', requirePermission(P.attendanceView, P.attendanceReport, P.staffAttendanceView, P.staffAttendanceReport), validateQuery(attendanceSummaryQuerySchema), attendanceSummaryApi);
attendanceRouter.get('/teacher/self/options', requirePermission(P.attendanceView, P.staffAttendanceView), validateQuery(teacherSelfAttendanceListQuerySchema), getTeacherSelfAttendanceOptionsApi);
attendanceRouter.post('/teacher/self', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceCreate, P.staffAttendanceCreate), validateBody(teacherSelfAttendanceSchema), markTeacherSelfAttendanceApi);
attendanceRouter.get('/teacher/self', requirePermission(P.attendanceView, P.staffAttendanceView), validateQuery(teacherSelfAttendanceListQuerySchema), listTeacherSelfAttendanceApi);
attendanceRouter.post('/substitutions', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceSubstituteManage), createAttendanceSubstitutionApi);
attendanceRouter.get('/substitutions', requirePermission(P.attendanceSubstituteManage), listAttendanceSubstitutionsApi);
attendanceRouter.patch('/substitutions/:id/cancel', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceSubstituteManage), cancelAttendanceSubstitutionApi);

// Canonical attendance sheet endpoints
attendanceRouter.get('/configurations', requirePermission(P.attendanceView, P.attendanceEdit), validateQuery(attendanceConfigurationListQuerySchema), listAttendanceConfigurationsApi);
attendanceRouter.post('/configurations', blockSuperAdminSchoolOperations('Super Admin cannot manage attendance configuration'), requirePermission(P.attendanceEdit), validateBody(attendanceConfigurationCreateSchema), createAttendanceConfigurationApi);
attendanceRouter.post('/configurations/bulk-apply', blockSuperAdminSchoolOperations('Super Admin cannot manage attendance configuration'), requirePermission(P.attendanceEdit), validateBody(attendanceConfigurationBulkApplySchema), bulkApplyAttendanceConfigurationApi);
attendanceRouter.patch('/configurations/:id', blockSuperAdminSchoolOperations('Super Admin cannot manage attendance configuration'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendanceConfigurationUpdateSchema), updateAttendanceConfigurationApi);
attendanceRouter.post('/configurations/:id/deactivate', blockSuperAdminSchoolOperations('Super Admin cannot manage attendance configuration'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendanceConfigurationDeactivateSchema), deactivateAttendanceConfigurationApi);
attendanceRouter.patch('/configurations/:id/deactivate', blockSuperAdminSchoolOperations('Super Admin cannot manage attendance configuration'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendanceConfigurationDeactivateSchema), deactivateAttendanceConfigurationApi);
attendanceRouter.get('/config/resolve', requirePermission(P.attendanceView, P.attendanceEdit, P.attendanceCreate), validateQuery(resolveAttendanceConfigQuerySchema), resolveAttendanceConfigApi);
attendanceRouter.get('/units', requirePermission(P.attendanceView, P.attendanceEdit, P.attendanceCreate), validateQuery(attendanceUnitsQuerySchema), listAttendanceUnitsApi);
attendanceRouter.get('/sheet', requirePermission(P.attendanceView, P.attendanceEdit, P.attendanceCreate), validateQuery(attendanceSheetQuerySchema), getAttendanceSheetApi);
attendanceRouter.put('/sheet', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(saveAttendanceSheetSchema), saveAttendanceSheetApi);
attendanceRouter.post('/sheet/:id/lock', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendanceSheetLockSchema), lockAttendanceSheetApi);
attendanceRouter.post('/sheet/:id/reopen', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendanceSheetLockSchema), reopenAttendanceSheetApi);

// Legacy attendance endpoints retained for backward compatibility
attendanceRouter.post('/periods', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateBody(attendancePeriodCreateSchema), createAttendancePeriod);
attendanceRouter.get('/periods', requirePermission(P.attendanceView), listAttendancePeriods);
attendanceRouter.get('/periods/:id', requirePermission(P.attendanceView), validateParams(uuidParamsSchema), getAttendancePeriod);
attendanceRouter.patch('/periods/:id', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(attendancePeriodUpdateSchema), updateAttendancePeriod);
attendanceRouter.delete('/periods/:id', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), deleteAttendancePeriod);

attendanceRouter.post('/legacy/sessions', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(startLegacyAttendanceSessionSchema), startSession);
attendanceRouter.get('/legacy/sessions', requirePermission(P.attendanceView), validateQuery(listLegacyAttendanceSessionsQuerySchema), listSessions);
attendanceRouter.post('/legacy/sessions/:id/close', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), closeSession);
attendanceRouter.post('/legacy/records', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceCreate, P.attendanceEdit), validateBody(markLegacyAttendanceSchema), idempotencyMiddleware, markAttendance);
attendanceRouter.patch('/legacy/records/:id/override', blockSuperAdminSchoolOperations('Super Admin cannot manage student attendance'), requirePermission(P.attendanceEdit), validateParams(uuidParamsSchema), validateBody(overrideLegacyAttendanceSchema), overrideAttendance);
attendanceRouter.get('/legacy/sessions/:sessionId/records', requirePermission(P.attendanceView), validateParams(attendanceSessionParamsSchema), listSessionRecords);
