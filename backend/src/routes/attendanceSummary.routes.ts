import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { getAttendanceSummaryApi } from '../controllers/attendanceSummary.controller';

export const attendanceSummaryRouter = Router();

attendanceSummaryRouter.use(authMiddleware);
attendanceSummaryRouter.use(requirePermission('attendance.view', 'attendance.report'));

attendanceSummaryRouter.get('/', getAttendanceSummaryApi);
