import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { getAnalytics } from '../controllers/analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

analyticsRouter.get('/', requirePermission(P.dashboardOverview, P.reportsView), getAnalytics);
