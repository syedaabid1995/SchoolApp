import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { approveSession, rejectSession } from '../controllers/attendanceApproval.controller';

export const attendanceApprovalRouter = Router();

attendanceApprovalRouter.use(authMiddleware);

attendanceApprovalRouter.post('/sessions/:sessionId/approve', approveSession);
attendanceApprovalRouter.post('/sessions/:sessionId/reject', rejectSession);
