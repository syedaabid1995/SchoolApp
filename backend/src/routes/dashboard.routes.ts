import { Router } from 'express';
import {
  getAdminDashboardApi,
  getPerformanceMetricsApi,
  getRecentActivitiesApi,
  getWeeklyAnalyticsApi,
} from '../controllers/adminDashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware);
dashboardRouter.use(requirePermission(P.dashboardOverview, P.reportsView));

dashboardRouter.get('/', getAdminDashboardApi);
dashboardRouter.get('/analytics/weekly', getWeeklyAnalyticsApi);
dashboardRouter.get('/performance', getPerformanceMetricsApi);
dashboardRouter.get('/activities', getRecentActivitiesApi);
