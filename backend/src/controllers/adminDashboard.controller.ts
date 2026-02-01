import type { Request, Response } from 'express';
import { resolveSchoolId } from '../utils/tenant';
import { getAdminDashboardMetrics } from '../services/adminDashboard.service';
import { getWeeklyAnalytics, getPerformanceMetrics } from '../services/analytics.service';
import { prisma } from '../config/db';

export const getAdminDashboardApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
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
  const metrics = await getAdminDashboardMetrics(schoolId);
  res.status(200).json(metrics);
};

export const getWeeklyAnalyticsApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    res.status(200).json([]);
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const data = await getWeeklyAnalytics(schoolId);
  res.status(200).json(data);
};

export const getPerformanceMetricsApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    res.status(200).json({ exams: 0, marks: 0, students: 0 });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const metrics = await getPerformanceMetrics(schoolId);
  res.status(200).json(metrics);
};

export const getRecentActivitiesApi = async (req: Request, res: Response) => {
  if (req.auth?.role === 'SUPER_ADMIN' && !req.query.schoolId) {
    res.status(200).json([]);
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const activities = await prisma.auditLog.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  res.status(200).json(activities);
};

export const getSystemStatusApi = async (_req: Request, res: Response) => {
  res.status(200).json({
    api: 'ok',
    db: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
  });
};
