import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { listAuditLogs } from '../controllers/auditLog.controller';

export const auditLogRouter = Router();

auditLogRouter.use(authMiddleware);

auditLogRouter.get('/', listAuditLogs);
