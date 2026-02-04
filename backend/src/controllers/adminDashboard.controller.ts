import type { Request, Response } from 'express';
import { resolveSchoolId } from '../utils/tenant';
import { getAdminDashboardMetrics } from '../services/adminDashboard.service';
import { getWeeklyAnalytics, getPerformanceMetrics } from '../services/analytics.service';
import { prisma } from '../config/db';
import { cacheKeys, buildQueryFingerprint } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';

export const getAdminDashboardApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    setCacheHeader(res, 'BYPASS');
    res.status(200).json({
      totalStudents: 0,
      totalTeachers: 0,
      attendanceRateToday: 0,
      pendingApprovals: 0,
      activeClasses: 0,
    });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { value: metrics, status } = await rememberCache(
    cacheKeys.adminDashboard(schoolId),
    cacheTTL.DASHBOARD,
    () => getAdminDashboardMetrics(schoolId),
  );
  setCacheHeader(res, status);
  res.status(200).json(metrics);
};

export const getWeeklyAnalyticsApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    setCacheHeader(res, 'BYPASS');
    res.status(200).json([]);
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { value: data, status } = await rememberCache(
    cacheKeys.weeklyAnalytics(schoolId),
    cacheTTL.ANALYTICS,
    () => getWeeklyAnalytics(schoolId),
  );
  setCacheHeader(res, status);
  res.status(200).json(data);
};

export const getPerformanceMetricsApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    setCacheHeader(res, 'BYPASS');
    res.status(200).json({ exams: 0, marks: 0, students: 0 });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { value: metrics, status } = await rememberCache(
    cacheKeys.performanceMetrics(schoolId),
    cacheTTL.ANALYTICS,
    () => getPerformanceMetrics(schoolId),
  );
  setCacheHeader(res, status);
  res.status(200).json(metrics);
};

export const getRecentActivitiesApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    setCacheHeader(res, 'BYPASS');
    res.status(200).json([]);
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const queryFingerprint = buildQueryFingerprint({ schoolId, take: 10 });
  const { value: activities, status } = await rememberCache(
    cacheKeys.auditLogs(queryFingerprint),
    cacheTTL.DASHBOARD,
    () =>
      prisma.auditLog.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
  );
  setCacheHeader(res, status);
  res.status(200).json(activities);
};

export const getSystemStatusApi = async (_req: Request, res: Response) => {
  res.status(200).json({
    api: 'ok',
    db: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
  });
};
