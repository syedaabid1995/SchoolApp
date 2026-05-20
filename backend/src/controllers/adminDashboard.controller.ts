import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import {
  getAdminDashboardMetrics,
  getPlatformActivity,
  getRevenueSummary,
  getSchoolGrowth,
  getSuperAdminDashboardSummary,
  getSupportSummary,
  getSystemStatus,
  getTopSchools,
} from '../services/adminDashboard.service';
import { getWeeklyAnalytics, getPerformanceMetrics } from '../services/analytics.service';
import { prisma } from '../config/db';
import { cacheKeys, buildQueryFingerprint } from '../services/cache/cache.keys';
import { rememberCache, setCacheHeader } from '../services/cache/cache.service';
import { cacheTTL } from '../services/cache/cache.ttl';
import { HttpError } from '../middlewares/error.middleware';

const rangeQuerySchema = z.object({
  range: z.enum(['7d', '30d', '6m', '12m']).default('12m'),
});

const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const topSchoolsQuerySchema = z.object({
  sortBy: z.enum(['students', 'teachers', 'storage', 'revenue', 'tickets']).default('students'),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const parseQuery = <T>(schema: z.ZodType<T>, query: unknown) => {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new HttpError(400, 'Invalid dashboard query.', result.error.flatten());
  }
  return result.data;
};

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

export const getDashboardSummaryApi = async (_req: Request, res: Response) => {
  const summary = await getSuperAdminDashboardSummary();
  res.status(200).json(summary);
};

export const getSchoolGrowthApi = async (req: Request, res: Response) => {
  const { range } = parseQuery(rangeQuerySchema, req.query);
  const growth = await getSchoolGrowth(range);
  res.status(200).json(growth);
};

export const getRevenueSummaryApi = async (req: Request, res: Response) => {
  const { range } = parseQuery(rangeQuerySchema, req.query);
  const revenue = await getRevenueSummary(range);
  res.status(200).json(revenue);
};

export const getPlatformActivityApi = async (req: Request, res: Response) => {
  const { limit } = parseQuery(limitQuerySchema, req.query);
  const activity = await getPlatformActivity(limit);
  res.status(200).json(activity);
};

export const getSupportSummaryApi = async (_req: Request, res: Response) => {
  const support = await getSupportSummary();
  res.status(200).json(support);
};

export const getTopSchoolsApi = async (req: Request, res: Response) => {
  const { sortBy, limit } = parseQuery(topSchoolsQuerySchema, req.query);
  const topSchools = await getTopSchools(sortBy, limit);
  res.status(200).json(topSchools);
};

export const getSystemStatusApi = async (_req: Request, res: Response) => {
  const status = await getSystemStatus();
  res.status(200).json(status);
};
