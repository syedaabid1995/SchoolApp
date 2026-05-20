import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  getAdminDashboardApi,
  getDashboardSummaryApi,
  getPlatformActivityApi,
  getWeeklyAnalyticsApi,
  getPerformanceMetricsApi,
  getRecentActivitiesApi,
  getRevenueSummaryApi,
  getSchoolGrowthApi,
  getSupportSummaryApi,
  getSystemStatusApi,
  getTopSchoolsApi,
} from '../controllers/adminDashboard.controller';

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authMiddleware);
adminDashboardRouter.use(requireSuperAdmin);

adminDashboardRouter.get('/', getAdminDashboardApi);
adminDashboardRouter.get('/summary', getDashboardSummaryApi);
adminDashboardRouter.get('/school-growth', getSchoolGrowthApi);
adminDashboardRouter.get('/revenue', getRevenueSummaryApi);
adminDashboardRouter.get('/activity', getPlatformActivityApi);
adminDashboardRouter.get('/support-summary', getSupportSummaryApi);
adminDashboardRouter.get('/top-schools', getTopSchoolsApi);
adminDashboardRouter.get('/analytics/weekly', getWeeklyAnalyticsApi);
adminDashboardRouter.get('/performance', getPerformanceMetricsApi);
adminDashboardRouter.get('/activities', getRecentActivitiesApi);
adminDashboardRouter.get('/system-status', getSystemStatusApi);
