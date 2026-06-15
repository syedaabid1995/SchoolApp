import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { createEvidence, listEvidence } from '../controllers/evidence.controller';

export const evidenceRouter = Router();

evidenceRouter.use(authMiddleware);

evidenceRouter.post('/', requirePermission(P.attendanceCreate, P.attendanceEdit), createEvidence);

evidenceRouter.get('/:recordId', requirePermission(P.attendanceView), listEvidence);
