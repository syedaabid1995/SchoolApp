import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  getAdminDashboardApi,
  getWeeklyAnalyticsApi,
  getPerformanceMetricsApi,
  getRecentActivitiesApi,
  getSystemStatusApi,
} from '../controllers/adminDashboard.controller';

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authMiddleware);
//adminDashboardRouter.use(superAdminGuard);

adminDashboardRouter.get('/', getAdminDashboardApi);
adminDashboardRouter.get('/analytics/weekly', getWeeklyAnalyticsApi);
adminDashboardRouter.get('/performance', getPerformanceMetricsApi);
adminDashboardRouter.get('/activities', getRecentActivitiesApi);
adminDashboardRouter.get('/system-status', getSystemStatusApi);
