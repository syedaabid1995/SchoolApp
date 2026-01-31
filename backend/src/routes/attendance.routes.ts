import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
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
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware';

export const attendanceRouter = Router();

attendanceRouter.use(authMiddleware);

attendanceRouter.post('/periods', createAttendancePeriod);
attendanceRouter.get('/periods', listAttendancePeriods);
attendanceRouter.get('/periods/:id', getAttendancePeriod);
attendanceRouter.patch('/periods/:id', updateAttendancePeriod);
attendanceRouter.delete('/periods/:id', deleteAttendancePeriod);

attendanceRouter.post('/sessions', startSession);
attendanceRouter.get('/sessions', listSessions);
attendanceRouter.post('/sessions/:id/close', closeSession);
attendanceRouter.post('/records', idempotencyMiddleware, markAttendance);
attendanceRouter.patch('/records/:id/override', overrideAttendance);
attendanceRouter.get('/sessions/:sessionId/records', listSessionRecords);
