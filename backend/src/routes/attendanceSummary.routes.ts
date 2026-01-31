import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { getAttendanceSummaryApi } from '../controllers/attendanceSummary.controller';

export const attendanceSummaryRouter = Router();

attendanceSummaryRouter.use(authMiddleware);
attendanceSummaryRouter.use(requireRole('SCHOOL_ADMIN'));

attendanceSummaryRouter.get('/', getAttendanceSummaryApi);
