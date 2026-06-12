import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiRateLimit } from '../middlewares/rate-limit.middleware';
import { aiProtection } from '../middlewares/ai-protection.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { recognize } from '../controllers/recognition.controller';

export const recognitionRouter = Router();

recognitionRouter.use(authMiddleware);

recognitionRouter.post('/match', requirePermission(P.attendanceCreate, P.attendanceEdit), aiRateLimit(), aiProtection, recognize);
