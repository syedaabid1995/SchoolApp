import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  getAdminDashboardApi,
  getWeeklyAnalyticsApi,
  getPerformanceMetricsApi,
  getRecentActivitiesApi,
  getSystemStatusApi,
} from '../controllers/adminDashboard.controller';

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authMiddleware);

adminDashboardRouter.get('/', getAdminDashboardApi);
adminDashboardRouter.get('/analytics/weekly', getWeeklyAnalyticsApi);
adminDashboardRouter.get('/performance', getPerformanceMetricsApi);
adminDashboardRouter.get('/activities', getRecentActivitiesApi);
adminDashboardRouter.get('/system-status', getSystemStatusApi);
