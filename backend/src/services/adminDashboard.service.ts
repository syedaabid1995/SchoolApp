import { prisma } from '../config/db';
import { redis } from '../config/redis';

type DashboardRange = '7d' | '30d' | '6m' | '12m';
type TopSchoolsSort = 'students' | 'teachers' | 'storage' | 'revenue' | 'tickets';
type PeriodBucket = 'day' | 'month';

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const startOfUtcMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const addUtcDays = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
const addUtcMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

const formatPeriod = (date: Date, bucket: PeriodBucket) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  if (bucket === 'month') return `${year}-${month}`;
  return `${year}-${month}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const getRangeConfig = (range: DashboardRange) => {
  const now = new Date();
  if (range === '7d') {
    return { bucket: 'day' as const, periods: 7, start: addUtcDays(startOfUtcDay(now), -6) };
  }
  if (range === '30d') {
    return { bucket: 'day' as const, periods: 30, start: addUtcDays(startOfUtcDay(now), -29) };
  }
  if (range === '6m') {
    return { bucket: 'month' as const, periods: 6, start: addUtcMonths(startOfUtcMonth(now), -5) };
  }
  return { bucket: 'month' as const, periods: 12, start: addUtcMonths(startOfUtcMonth(now), -11) };
};

const buildEmptyPeriods = <T extends Record<string, number>>(range: DashboardRange, zeroes: T) => {
  const config = getRangeConfig(range);
  return Array.from({ length: config.periods }, (_, index) => {
    const date = config.bucket === 'day' ? addUtcDays(config.start, index) : addUtcMonths(config.start, index);
    return { period: formatPeriod(date, config.bucket), ...zeroes };
  });
};

const countByRole = (role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT') =>
  prisma.user.count({
    where: {
      roles: {
        some: {
          role: { name: role },
        },
      },
    },
  });

const centsToAmount = (cents: number) => Math.round((cents / 100) * 100) / 100;

const estimateSubscriptionMonthlyCents = (subscription: {
  billingCycle: string;
  discountPercent: number;
  plan: { priceCents: number } | null;
}) => {
  if (!subscription.plan) return 0;
  const discounted = Math.round(subscription.plan.priceCents * ((100 - subscription.discountPercent) / 100));
  return subscription.billingCycle === 'ANNUAL' ? Math.round(discounted / 12) : discounted;
};

const estimateSubscriptionTotalCents = (subscription: {
  discountPercent: number;
  plan: { priceCents: number } | null;
}) => {
  if (!subscription.plan) return 0;
  return Math.round(subscription.plan.priceCents * ((100 - subscription.discountPercent) / 100));
};

const safeRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const safeString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

export const getAdminDashboardMetrics = async (schoolId: string) => {
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
  return result;
};

export const getSuperAdminDashboardSummary = async () => {
  const todayStart = startOfUtcDay(new Date());
  const now = new Date();

  const [
    totalSchools,
    activeSchools,
    suspendedSchools,
    archivedSchools,
    totalUsers,
    superAdmins,
    schoolAdmins,
    teachers,
    parents,
    students,
    totalPlans,
    activeSubscriptions,
    trialSubscriptions,
    expiredSubscriptions,
    cancelledSubscriptions,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    criticalTickets,
    failedLoginsToday,
    successfulLoginsToday,
    activeSessions,
    mfaEnabledAdmins,
    backupJobsToday,
    failedBackupJobs,
    pendingExportRequests,
    pendingDeletionRequests,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.school.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.school.count({ where: { deletedAt: null, status: 'SUSPENDED' } }),
    prisma.school.count({ where: { deletedAt: { not: null } } }),
    prisma.user.count(),
    countByRole('SUPER_ADMIN'),
    countByRole('SCHOOL_ADMIN'),
    countByRole('TEACHER'),
    countByRole('PARENT'),
    prisma.student.count(),
    prisma.subscriptionPlanDef.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { status: 'TRIAL' } }),
    prisma.subscription.count({ where: { status: 'EXPIRED' } }),
    prisma.subscription.count({ where: { status: { in: ['CANCELLED', 'CANCELED'] } } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
    prisma.supportTicket.count({ where: { priority: 'URGENT' } }),
    prisma.auditLog.count({ where: { action: 'LOGIN_FAILED', createdAt: { gte: todayStart } } }),
    prisma.auditLog.count({ where: { action: 'LOGIN_SUCCESS', createdAt: { gte: todayStart } } }),
    prisma.refreshSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    prisma.user.count({
      where: {
        mfaEnabled: true,
        roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] } } } },
      },
    }),
    prisma.backupJob.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.backupJob.count({ where: { status: 'FAILED' } }),
    prisma.dataExportJob.count({ where: { status: 'REQUESTED' } }),
    prisma.dataDeletionJob.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
  ]);

  return {
    schools: {
      total: totalSchools,
      active: activeSchools,
      // TODO: Add a trial lifecycle field/model before reporting trial schools.
      trial: 0,
      suspended: suspendedSchools,
      archived: archivedSchools,
    },
    users: {
      total: totalUsers,
      superAdmins,
      schoolAdmins,
      teachers,
      parents,
      students,
    },
    subscriptions: {
      totalPlans,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
    },
    support: {
      openTickets,
      inProgressTickets,
      resolvedTickets,
      criticalTickets,
    },
    security: {
      failedLoginsToday,
      successfulLoginsToday,
      activeSessions,
      mfaEnabledAdmins,
    },
    system: {
      backupJobsToday,
      failedBackupJobs,
      pendingComplianceRequests: pendingExportRequests + pendingDeletionRequests,
    },
  };
};

export const getSchoolGrowth = async (range: DashboardRange) => {
  const config = getRangeConfig(range);
  const rows = await prisma.$queryRaw<
    Array<{ period: Date | string; newSchools: number | bigint; activeSchools: number | bigint; suspendedSchools: number | bigint }>
  >`
    SELECT
      date_trunc(${config.bucket}, "created_at")::date AS "period",
      COUNT(*)::int AS "newSchools",
      COUNT(*) FILTER (WHERE "status" = 'ACTIVE' AND "deleted_at" IS NULL)::int AS "activeSchools",
      COUNT(*) FILTER (WHERE "status" = 'SUSPENDED' AND "deleted_at" IS NULL)::int AS "suspendedSchools"
    FROM "schools"
    WHERE "created_at" >= ${config.start}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const byPeriod = new Map(
    rows.map((row) => {
      const date = row.period instanceof Date ? row.period : new Date(row.period);
      return [
        formatPeriod(date, config.bucket),
        {
          period: formatPeriod(date, config.bucket),
          newSchools: toNumber(row.newSchools),
          activeSchools: toNumber(row.activeSchools),
          suspendedSchools: toNumber(row.suspendedSchools),
        },
      ];
    }),
  );

  const data = buildEmptyPeriods(range, { newSchools: 0, activeSchools: 0, suspendedSchools: 0 }).map(
    (period) => byPeriod.get(period.period) ?? period,
  );

  return { range, data };
};

export const getRevenueSummary = async (range: DashboardRange) => {
  const config = getRangeConfig(range);
  const [activeSubscriptions, rangeSubscriptions] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: {
        billingCycle: true,
        discountPercent: true,
        plan: { select: { priceCents: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { startsAt: { gte: config.start } },
      select: {
        startsAt: true,
        billingCycle: true,
        discountPercent: true,
        plan: { select: { priceCents: true } },
      },
    }),
  ]);

  const monthlyRecurringRevenue = centsToAmount(
    activeSubscriptions.reduce((sum, subscription) => sum + estimateSubscriptionMonthlyCents(subscription), 0),
  );
  const totalRevenue = centsToAmount(
    rangeSubscriptions.reduce((sum, subscription) => sum + estimateSubscriptionTotalCents(subscription), 0),
  );

  const data = buildEmptyPeriods(range, { revenue: 0, pending: 0, overdue: 0 });
  const dataByPeriod = new Map(data.map((row) => [row.period, row]));

  for (const subscription of rangeSubscriptions) {
    const period = formatPeriod(subscription.startsAt, config.bucket);
    const row = dataByPeriod.get(period);
    if (row) {
      row.revenue = centsToAmount(Math.round(row.revenue * 100) + estimateSubscriptionTotalCents(subscription));
    }
  }

  return {
    range,
    currency: 'INR',
    isEstimated: true,
    revenueSource: 'subscription_plan_price',
    summary: {
      monthlyRecurringRevenue,
      totalRevenue,
      // TODO: Add invoice/payment models before reporting real pending amounts.
      pendingAmount: 0,
      // TODO: Add invoice/payment models before reporting real overdue amounts.
      overdueAmount: 0,
    },
    data,
  };
};

export const getPlatformActivity = async (limit: number) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: {
        select: { id: true, email: true },
      },
    },
  });

  const schoolIds = Array.from(
    new Set(
      logs
        .map((log) => log.schoolId ?? (log.entityType === 'School' ? log.entityId : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const schools = schoolIds.length
    ? await prisma.school.findMany({ where: { id: { in: schoolIds } }, select: { id: true, name: true } })
    : [];
  const schoolMap = new Map(schools.map((school) => [school.id, school.name]));

  return {
    items: logs.map((log) => {
      const afterState = safeRecord(log.afterState);
      const schoolId = log.schoolId ?? (log.entityType === 'School' ? log.entityId : null);
      const schoolName = schoolId ? schoolMap.get(schoolId) ?? safeString(afterState.name) : null;
      const action = log.action.replace(/_/g, ' ').toLowerCase();
      const entity = log.entityType.replace(/([a-z])([A-Z])/g, '$1 $2');

      return {
        id: log.id,
        type: `${log.entityType}_${log.action}`.toUpperCase(),
        title: `${entity} ${action}`,
        description: schoolName ? `${schoolName}: ${entity} ${action}` : `${entity} ${action}`,
        schoolId,
        schoolName,
        actorId: log.actorId,
        actorName: log.actor?.email ?? null,
        createdAt: log.createdAt.toISOString(),
      };
    }),
  };
};

export const getSupportSummary = async () => {
  const [statusCounts, priorityCounts, recentTickets] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        schoolId: true,
        createdAt: true,
        school: { select: { name: true } },
      },
    }),
  ]);

  const statusMap = new Map(statusCounts.map((row) => [row.status, row._count._all]));
  const priorityMap = new Map(priorityCounts.map((row) => [row.priority, row._count._all]));

  return {
    total: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
    open: statusMap.get('OPEN') ?? 0,
    inProgress: statusMap.get('IN_PROGRESS') ?? 0,
    // TODO: Add WAITING to TicketStatus before reporting waiting tickets.
    waiting: 0,
    resolved: statusMap.get('RESOLVED') ?? 0,
    closed: statusMap.get('CLOSED') ?? 0,
    critical: priorityMap.get('URGENT') ?? 0,
    high: priorityMap.get('HIGH') ?? 0,
    medium: priorityMap.get('MEDIUM') ?? 0,
    low: priorityMap.get('LOW') ?? 0,
    recentTickets: recentTickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      schoolId: ticket.schoolId,
      schoolName: ticket.school.name,
      createdAt: ticket.createdAt.toISOString(),
    })),
  };
};

export const getTopSchools = async (sortBy: TopSchoolsSort, limit: number) => {
  const [schools, studentCounts, teacherCounts, ticketCounts, parentCounts] = await Promise.all([
    prisma.school.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        subscriptionPlan: true,
        subscription: {
          select: {
            planName: true,
            billingCycle: true,
            discountPercent: true,
            plan: { select: { priceCents: true } },
          },
        },
      },
    }),
    prisma.student.groupBy({ by: ['schoolId'], _count: { _all: true } }),
    prisma.teacherProfile.groupBy({ by: ['schoolId'], _count: { _all: true } }),
    prisma.supportTicket.groupBy({
      by: ['schoolId'],
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ schoolId: string; parents: number | bigint }>>`
      SELECT s."school_id" AS "schoolId", COUNT(DISTINCT sp."parent_id")::int AS "parents"
      FROM "student_parents" sp
      INNER JOIN "students" s ON s."id" = sp."student_id"
      GROUP BY s."school_id"
    `,
  ]);

  const studentMap = new Map(studentCounts.map((row) => [row.schoolId, row._count._all]));
  const teacherMap = new Map(teacherCounts.map((row) => [row.schoolId, row._count._all]));
  const ticketMap = new Map(ticketCounts.map((row) => [row.schoolId, row._count._all]));
  const parentMap = new Map(parentCounts.map((row) => [row.schoolId, toNumber(row.parents)]));

  const items = schools.map((school) => {
    const revenue = school.subscription ? centsToAmount(estimateSubscriptionMonthlyCents(school.subscription)) : 0;
    return {
      schoolId: school.id,
      schoolName: school.name,
      status: school.status,
      students: studentMap.get(school.id) ?? 0,
      teachers: teacherMap.get(school.id) ?? 0,
      parents: parentMap.get(school.id) ?? 0,
      subscriptionPlan: school.subscription?.planName ?? school.subscriptionPlan,
      // TODO: Add file/storage accounting before reporting real storage use.
      storageUsed: 0,
      openTickets: ticketMap.get(school.id) ?? 0,
      revenue,
    };
  });

  const sortValue = (item: (typeof items)[number]) => {
    if (sortBy === 'students') return item.students;
    if (sortBy === 'teachers') return item.teachers;
    if (sortBy === 'tickets') return item.openTickets;
    if (sortBy === 'revenue') return item.revenue;
    return item.storageUsed;
  };

  return {
    sortBy,
    items: items
      .sort((a, b) => sortValue(b) - sortValue(a) || a.schoolName.localeCompare(b.schoolName))
      .slice(0, limit)
      .map(({ revenue: _revenue, ...item }) => item),
  };
};

const checkDatabase = async () => {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - startedAt };
  } catch {
    return { status: 'error', latencyMs: Date.now() - startedAt };
  }
};

const checkRedis = async () => {
  const startedAt = Date.now();
  try {
    await Promise.race([
      redis.ping(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis health check timed out')), 1500);
      }),
    ]);
    return { status: 'healthy', latencyMs: Date.now() - startedAt };
  } catch {
    return { status: 'unavailable', latencyMs: Date.now() - startedAt };
  }
};

export const getSystemStatus = async () => {
  const [database, redisStatus] = await Promise.all([checkDatabase(), checkRedis()]);

  return {
    database,
    redis: redisStatus,
    queues: {
      // TODO: Wire BullMQ queue metrics when queue names are centralized.
      status: 'unknown',
      pendingJobs: 0,
      failedJobs: 0,
    },
    storage: {
      // TODO: Add a safe S3 HEAD/list health check after storage usage policy is finalized.
      status: 'unknown',
    },
    email: {
      // TODO: Add email provider health check when email delivery service is configured.
      status: 'unknown',
    },
    api: database.status === 'healthy' ? 'ok' : 'degraded',
    db: database.status === 'healthy' ? 'ok' : 'error',
    uptimeSeconds: Math.floor(process.uptime()),
    generatedAt: new Date().toISOString(),
  };
};
