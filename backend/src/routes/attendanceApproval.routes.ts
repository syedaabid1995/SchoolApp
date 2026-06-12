import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { validateBody, validateParams } from '../middlewares/validation.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  approveAttendanceSessionSchema,
  attendanceSessionParamsSchema,
  rejectAttendanceSessionSchema,
} from '../validations/attendance.validation';
import { approveSession, rejectSession } from '../controllers/attendanceApproval.controller';

export const attendanceApprovalRouter = Router();

attendanceApprovalRouter.use(authMiddleware);

attendanceApprovalRouter.post('/sessions/:sessionId/approve', requirePermission(P.attendanceEdit), validateParams(attendanceSessionParamsSchema), validateBody(approveAttendanceSessionSchema), approveSession);
attendanceApprovalRouter.post('/sessions/:sessionId/reject', requirePermission(P.attendanceEdit), validateParams(attendanceSessionParamsSchema), validateBody(rejectAttendanceSessionSchema), rejectSession);
