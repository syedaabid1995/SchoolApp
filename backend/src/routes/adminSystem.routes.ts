import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/rbac.middleware';
import { getSystemHealthApi } from '../controllers/adminSystem.controller';

export const adminSystemRouter = Router();

adminSystemRouter.use(authMiddleware);
adminSystemRouter.use(requireSuperAdmin);

adminSystemRouter.get('/system-health', getSystemHealthApi);
