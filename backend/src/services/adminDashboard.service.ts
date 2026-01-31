import { prisma } from '../config/db';

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

const getCached = <T>(key: string): T | null => {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
};

const setCached = (key: string, value: unknown) => {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
};

export const getAdminDashboardMetrics = async (schoolId: string) => {
  const cacheKey = `dashboard:${schoolId}`;
  const cached = getCached<{
    totalStudents: number;
    totalTeachers: number;
    attendanceRateToday: number;
    pendingApprovals: number;
    activeClasses: number;
  }>(cacheKey);
  if (cached) return cached;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [studentCount, teacherCount, classCount, pendingApprovals, statusCounts] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.teacherProfile.count({ where: { schoolId } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.attendanceSession.count({
      where: { schoolId, approvalStatus: 'PENDING', date: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { session: { schoolId, date: { gte: todayStart, lte: todayEnd } } },
      _count: { _all: true },
    }),
  ]);

  const statusMap = statusCounts.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const total = Object.values(statusMap).reduce((sum, val) => sum + val, 0);
  const present = (statusMap.PRESENT ?? 0) + (statusMap.LATE ?? 0) + (statusMap.EXCUSED ?? 0);
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

  const result = {
    totalStudents: studentCount,
    totalTeachers: teacherCount,
    attendanceRateToday: attendanceRate,
    pendingApprovals,
    activeClasses: classCount,
  };

  setCached(cacheKey, result);
  return result;
};
