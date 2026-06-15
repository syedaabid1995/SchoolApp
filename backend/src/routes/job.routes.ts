import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { getJobStatus } from '../controllers/job.controller';

export const jobRouter = Router();

jobRouter.use(authMiddleware);

jobRouter.get('/:queue/:id', requirePermission(P.jobsView), getJobStatus);
