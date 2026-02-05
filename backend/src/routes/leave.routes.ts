import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import {
  approveLeaveRequestApi,
  createLeaveRequestApi,
  listLeaveRequestsApi,
  rejectLeaveRequestApi,
} from '../controllers/leaveP1.controller';

export const leaveRouter = Router();

leaveRouter.use(authMiddleware);

leaveRouter.post('/requests', requireRole('TEACHER', 'SCHOOL_ADMIN'), createLeaveRequestApi);
leaveRouter.get('/requests', requireRole('TEACHER', 'SCHOOL_ADMIN'), listLeaveRequestsApi);
leaveRouter.patch('/requests/:id/approve', requireRole('SCHOOL_ADMIN'), approveLeaveRequestApi);
leaveRouter.patch('/requests/:id/reject', requireRole('SCHOOL_ADMIN'), rejectLeaveRequestApi);
