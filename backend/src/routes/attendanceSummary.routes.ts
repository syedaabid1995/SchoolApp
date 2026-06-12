import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { getAttendanceSummaryApi } from '../controllers/attendanceSummary.controller';
import { PermissionCodes as P } from '../permissions/permission-manifest';

export const attendanceSummaryRouter = Router();

attendanceSummaryRouter.use(authMiddleware);
attendanceSummaryRouter.use(requirePermission(P.attendanceView, P.attendanceReport));

attendanceSummaryRouter.get('/', getAttendanceSummaryApi);
