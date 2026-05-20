'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../Button';
import {
  DashboardRange,
  PlatformStatusValue,
  TopSchoolsSort,
  getPlatformActivity,
  getRevenueSummary,
  getSchoolGrowth,
  getSuperAdminDashboardSummary,
  getSuperAdminSystemStatus,
  getSupportSummary,
  getTopSchools,
} from '../../services/adminDashboard.service';

const rangeOptions: Array<{ label: string; value: DashboardRange }> = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '6m', value: '6m' },
  { label: '12m', value: '12m' },
];

const sortOptions: Array<{ label: string; value: TopSchoolsSort }> = [
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Storage', value: 'storage' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Tickets', value: 'tickets' },
];

const safeNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatNumber = (value: unknown) => new Intl.NumberFormat('en-IN').format(safeNumber(value));

const formatCurrency = (value: unknown, currency = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(safeNumber(value));
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPeriodLabel = (period: string) => {
  const parts = period.split('-');
  const date = parts.length === 2 ? new Date(`${period}-01T00:00:00Z`) : new Date(`${period}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return period;
  if (parts.length === 2) {
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  }
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const formatStatusLabel = (status?: string | null) =>
  (status ?? 'unknown')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const statusBadgeClass = (status?: string | null) => {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'OPEN') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (normalized === 'TRIAL' || normalized === 'IN_PROGRESS') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (normalized === 'SUSPENDED' || normalized === 'URGENT' || normalized === 'HIGH') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (normalized === 'RESOLVED' || normalized === 'CLOSED') return 'bg-slate-100 text-slate-700 ring-slate-200';
  if (normalized === 'MEDIUM') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (normalized === 'LOW') return 'bg-lime-50 text-lime-700 ring-lime-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const healthBadgeClass = (status?: PlatformStatusValue | string | null) => {
  const normalized = (status ?? 'unknown').toLowerCase();
  if (normalized === 'healthy') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (normalized === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (normalized === 'down' || normalized === 'error' || normalized === 'unavailable') {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const cardToneClass = (tone: string) => {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (tone === 'blue') return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (tone === 'amber') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (tone === 'red') return 'bg-rose-50 text-rose-700 ring-rose-100';
  if (tone === 'violet') return 'bg-violet-50 text-violet-700 ring-violet-100';
  return 'bg-slate-100 text-slate-700 ring-slate-200';
};

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

function SectionError({ message = 'Unable to load this section.' }: { message?: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function SmallBadge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>
      {children}
    </span>
  );
}

type KpiCardProps = {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone: string;
  isLoading: boolean;
};

function KpiCard({ label, value, helper, icon, tone, isLoading }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {isLoading ? (
            <SkeletonBlock className="mt-3 h-8 w-24" />
          ) : (
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${cardToneClass(tone)}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

type ProgressRowProps = {
  label: string;
  value: number;
  total: number;
  tone: string;
};

function ProgressRow({ label, value, total, tone }: ProgressRowProps) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fillClass =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'red'
          ? 'bg-rose-500'
          : 'bg-slate-500';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{formatNumber(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SchoolGrowthChart({
  data,
  isLoading,
  isError,
}: {
  data?: Array<{ period: string; newSchools: number; activeSchools: number; suspendedSchools: number }>;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex h-56 items-end gap-2">
        {Array.from({ length: 12 }, (_, index) => (
          <SkeletonBlock key={index} className="h-24 flex-1" />
        ))}
      </div>
    );
  }

  if (isError) return <SectionError message="Unable to load school growth." />;
  if (!data?.length) return <EmptyState message="No school growth data found." />;

  const maxValue = Math.max(1, ...data.map((item) => Math.max(item.newSchools, item.activeSchools, item.suspendedSchools)));
  const showEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div className="space-y-4">
      <div className="flex h-60 items-end gap-2">
        {data.map((item, index) => {
          const height = Math.max(8, Math.round((safeNumber(item.newSchools) / maxValue) * 100));
          const labelVisible = index % showEvery === 0 || index === data.length - 1;

          return (
            <div key={item.period} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-48 w-full items-end rounded-lg bg-slate-50 px-1">
                <div
                  className="w-full rounded-md bg-sky-500 transition-all"
                  style={{ height: `${height}%` }}
                  title={`${formatPeriodLabel(item.period)}: ${formatNumber(item.newSchools)} new schools`}
                />
              </div>
              <span className="h-8 text-center text-[10px] leading-3 text-slate-500">
                {labelVisible ? formatPeriodLabel(item.period) : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 text-xs text-slate-500 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <span className="font-semibold text-slate-700">New schools</span> by selected period.
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Active schools use the backend school status field.
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          Suspended schools use the backend school status field.
        </div>
      </div>
    </div>
  );
}

function RevenueChart({
  data,
  isLoading,
  isError,
  currency,
}: {
  data?: Array<{ period: string; revenue: number; pending: number; overdue: number }>;
  isLoading: boolean;
  isError: boolean;
  currency?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex h-36 items-end gap-2">
        {Array.from({ length: 8 }, (_, index) => (
          <SkeletonBlock key={index} className="h-16 flex-1" />
        ))}
      </div>
    );
  }

  if (isError) return <SectionError message="Unable to load revenue trend." />;
  if (!data?.length) return <EmptyState message="No subscription revenue data found." />;

  const maxValue = Math.max(1, ...data.map((item) => safeNumber(item.revenue)));
  const showEvery = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((item, index) => {
        const height = Math.max(8, Math.round((safeNumber(item.revenue) / maxValue) * 100));
        const labelVisible = index % showEvery === 0 || index === data.length - 1;

        return (
          <div key={item.period} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-lg bg-slate-50 px-1">
              <div
                className="w-full rounded-md bg-violet-500"
                style={{ height: `${height}%` }}
                title={`${formatPeriodLabel(item.period)}: ${formatCurrency(item.revenue, currency)}`}
              />
            </div>
            <span className="h-8 text-center text-[10px] leading-3 text-slate-500">
              {labelVisible ? formatPeriodLabel(item.period) : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function SuperAdminDashboardClient() {
  const [range, setRange] = useState<DashboardRange>('12m');
  const [sortBy, setSortBy] = useState<TopSchoolsSort>('students');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [manualRefresh, setManualRefresh] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ['super-admin-dashboard-summary'],
    queryFn: getSuperAdminDashboardSummary,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const schoolGrowthQuery = useQuery({
    queryKey: ['super-admin-school-growth', range],
    queryFn: () => getSchoolGrowth(range),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const revenueQuery = useQuery({
    queryKey: ['super-admin-revenue', range],
    queryFn: () => getRevenueSummary(range),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const activityQuery = useQuery({
    queryKey: ['super-admin-platform-activity'],
    queryFn: () => getPlatformActivity(20),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const supportQuery = useQuery({
    queryKey: ['super-admin-support-summary'],
    queryFn: getSupportSummary,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const topSchoolsQuery = useQuery({
    queryKey: ['super-admin-top-schools', sortBy],
    queryFn: () => getTopSchools(sortBy, 10),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const systemStatusQuery = useQuery({
    queryKey: ['super-admin-system-status'],
    queryFn: getSuperAdminSystemStatus,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const isRefreshing =
    manualRefresh ||
    summaryQuery.isFetching ||
    schoolGrowthQuery.isFetching ||
    revenueQuery.isFetching ||
    activityQuery.isFetching ||
    supportQuery.isFetching ||
    topSchoolsQuery.isFetching ||
    systemStatusQuery.isFetching;

  const rawSummary = summaryQuery.data;
  const summary = useMemo(
    () => ({
      schools: {
        total: safeNumber(rawSummary?.schools?.total),
        active: safeNumber(rawSummary?.schools?.active),
        trial: safeNumber(rawSummary?.schools?.trial),
        suspended: safeNumber(rawSummary?.schools?.suspended),
        archived: safeNumber(rawSummary?.schools?.archived),
      },
      users: {
        total: safeNumber(rawSummary?.users?.total),
        superAdmins: safeNumber(rawSummary?.users?.superAdmins),
        schoolAdmins: safeNumber(rawSummary?.users?.schoolAdmins),
        teachers: safeNumber(rawSummary?.users?.teachers),
        parents: safeNumber(rawSummary?.users?.parents),
        students: safeNumber(rawSummary?.users?.students),
      },
      subscriptions: {
        totalPlans: safeNumber(rawSummary?.subscriptions?.totalPlans),
        activeSubscriptions: safeNumber(rawSummary?.subscriptions?.activeSubscriptions),
        trialSubscriptions: safeNumber(rawSummary?.subscriptions?.trialSubscriptions),
        expiredSubscriptions: safeNumber(rawSummary?.subscriptions?.expiredSubscriptions),
        cancelledSubscriptions: safeNumber(rawSummary?.subscriptions?.cancelledSubscriptions),
      },
      support: {
        openTickets: safeNumber(rawSummary?.support?.openTickets),
        inProgressTickets: safeNumber(rawSummary?.support?.inProgressTickets),
        resolvedTickets: safeNumber(rawSummary?.support?.resolvedTickets),
        criticalTickets: safeNumber(rawSummary?.support?.criticalTickets),
      },
      security: {
        failedLoginsToday: safeNumber(rawSummary?.security?.failedLoginsToday),
        successfulLoginsToday: safeNumber(rawSummary?.security?.successfulLoginsToday),
        activeSessions: safeNumber(rawSummary?.security?.activeSessions),
        mfaEnabledAdmins: safeNumber(rawSummary?.security?.mfaEnabledAdmins),
      },
      system: {
        backupJobsToday: safeNumber(rawSummary?.system?.backupJobsToday),
        failedBackupJobs: safeNumber(rawSummary?.system?.failedBackupJobs),
        pendingComplianceRequests: safeNumber(rawSummary?.system?.pendingComplianceRequests),
      },
    }),
    [rawSummary],
  );
  const rawRevenue = revenueQuery.data;
  const revenue = useMemo(
    () => ({
      range: rawRevenue?.range ?? range,
      currency: rawRevenue?.currency ?? 'INR',
      isEstimated: Boolean(rawRevenue?.isEstimated),
      revenueSource: rawRevenue?.revenueSource,
      summary: {
        monthlyRecurringRevenue: safeNumber(rawRevenue?.summary?.monthlyRecurringRevenue),
        totalRevenue: safeNumber(rawRevenue?.summary?.totalRevenue),
        pendingAmount: safeNumber(rawRevenue?.summary?.pendingAmount),
        overdueAmount: safeNumber(rawRevenue?.summary?.overdueAmount),
      },
      data: Array.isArray(rawRevenue?.data) ? rawRevenue.data : [],
    }),
    [range, rawRevenue],
  );
  const rawSupport = supportQuery.data;
  const support = useMemo(
    () => ({
      total: safeNumber(rawSupport?.total),
      open: safeNumber(rawSupport?.open),
      inProgress: safeNumber(rawSupport?.inProgress),
      waiting: safeNumber(rawSupport?.waiting),
      resolved: safeNumber(rawSupport?.resolved),
      closed: safeNumber(rawSupport?.closed),
      critical: safeNumber(rawSupport?.critical),
      high: safeNumber(rawSupport?.high),
      medium: safeNumber(rawSupport?.medium),
      low: safeNumber(rawSupport?.low),
      recentTickets: Array.isArray(rawSupport?.recentTickets) ? rawSupport.recentTickets : [],
    }),
    [rawSupport],
  );
  const topSchools = topSchoolsQuery.data?.items ?? [];
  const activity = activityQuery.data?.items ?? [];
  const rawSystemStatus = systemStatusQuery.data;
  const systemStatus = useMemo(
    () => ({
      database: {
        status: rawSystemStatus?.database?.status ?? 'unknown',
        latencyMs: safeNumber(rawSystemStatus?.database?.latencyMs),
      },
      redis: {
        status: rawSystemStatus?.redis?.status ?? 'unknown',
        latencyMs: safeNumber(rawSystemStatus?.redis?.latencyMs),
      },
      queues: {
        status: rawSystemStatus?.queues?.status ?? 'unknown',
        pendingJobs: safeNumber(rawSystemStatus?.queues?.pendingJobs),
        failedJobs: safeNumber(rawSystemStatus?.queues?.failedJobs),
      },
      storage: {
        status: rawSystemStatus?.storage?.status ?? 'unknown',
      },
      email: {
        status: rawSystemStatus?.email?.status ?? 'unknown',
      },
      generatedAt: rawSystemStatus?.generatedAt,
      api: rawSystemStatus?.api,
      db: rawSystemStatus?.db,
      uptimeSeconds: rawSystemStatus?.uptimeSeconds,
    }),
    [rawSystemStatus],
  );

  const kpiCards = useMemo(
    () => [
      {
        label: 'Total Schools',
        value: formatNumber(summary?.schools.total),
        helper: 'All schools registered on the platform.',
        icon: 'SC',
        tone: 'blue',
      },
      {
        label: 'Active Schools',
        value: formatNumber(summary?.schools.active),
        helper: 'Schools currently marked active.',
        icon: 'AC',
        tone: 'green',
      },
      {
        label: 'Trial Schools',
        value: formatNumber(summary?.schools.trial),
        helper: 'Trial lifecycle is reported when available.',
        icon: 'TR',
        tone: 'amber',
      },
      {
        label: 'Suspended Schools',
        value: formatNumber(summary?.schools.suspended),
        helper: 'Schools blocked from normal access.',
        icon: 'SU',
        tone: 'red',
      },
      {
        label: 'Total Users',
        value: formatNumber(summary?.users.total),
        helper: 'All user accounts across tenants.',
        icon: 'US',
        tone: 'violet',
      },
      {
        label: 'Active Subscriptions',
        value: formatNumber(summary?.subscriptions.activeSubscriptions),
        helper: 'Subscriptions with active status.',
        icon: 'PL',
        tone: 'green',
      },
      {
        label: 'Open Support Tickets',
        value: formatNumber(summary?.support.openTickets),
        helper: 'Open platform support requests.',
        icon: 'SP',
        tone: 'amber',
      },
      {
        label: 'Failed Logins Today',
        value: formatNumber(summary?.security.failedLoginsToday),
        helper: 'Failed login audit events since midnight.',
        icon: 'FL',
        tone: summary?.security.failedLoginsToday ? 'red' : 'slate',
      },
      {
        label: 'Active Sessions',
        value: formatNumber(summary?.security.activeSessions),
        helper: 'Refresh sessions that are not revoked.',
        icon: 'SE',
        tone: 'blue',
      },
      {
        label: 'Pending Compliance',
        value: formatNumber(summary?.system.pendingComplianceRequests),
        helper: 'Pending data export or deletion requests.',
        icon: 'CP',
        tone: 'red',
      },
    ],
    [summary],
  );

  const userDistribution = [
    { label: 'Super Admins', value: safeNumber(summary?.users.superAdmins), tone: 'bg-slate-700' },
    { label: 'School Admins', value: safeNumber(summary?.users.schoolAdmins), tone: 'bg-sky-500' },
    { label: 'Teachers', value: safeNumber(summary?.users.teachers), tone: 'bg-emerald-500' },
    { label: 'Parents', value: safeNumber(summary?.users.parents), tone: 'bg-amber-500' },
    { label: 'Students', value: safeNumber(summary?.users.students), tone: 'bg-violet-500' },
  ];
  const maxUserCount = Math.max(1, ...userDistribution.map((item) => item.value));

  const refreshAll = async () => {
    setManualRefresh(true);
    await Promise.allSettled([
      summaryQuery.refetch(),
      schoolGrowthQuery.refetch(),
      revenueQuery.refetch(),
      activityQuery.refetch(),
      supportQuery.refetch(),
      topSchoolsQuery.refetch(),
      systemStatusQuery.refetch(),
    ]);
    setLastUpdated(new Date());
    setManualRefresh(false);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Platform Overview</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              Super Admin Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Platform-wide overview of schools, subscriptions, security, and system health.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    range === option.value
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={refreshAll} loading={manualRefresh}>
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Last updated: {lastUpdated ? formatDateTime(lastUpdated) : 'Using latest loaded data'}</span>
          {isRefreshing ? <span>Refreshing data...</span> : null}
        </div>
      </section>

      {summaryQuery.isError ? (
        <SectionError message="Unable to load platform summary. Other dashboard sections may still be available." />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} isLoading={summaryQuery.isLoading} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">School Status</h2>
            <span className="text-xs text-slate-500">{formatNumber(summary?.schools.total)} total</span>
          </div>
          {summaryQuery.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-10" />
              <SkeletonBlock className="h-10" />
              <SkeletonBlock className="h-10" />
              <SkeletonBlock className="h-10" />
            </div>
          ) : (
            <div className="space-y-5">
              <ProgressRow label="Active" value={safeNumber(summary?.schools.active)} total={safeNumber(summary?.schools.total)} tone="green" />
              <ProgressRow label="Trial" value={safeNumber(summary?.schools.trial)} total={safeNumber(summary?.schools.total)} tone="amber" />
              <ProgressRow label="Suspended" value={safeNumber(summary?.schools.suspended)} total={safeNumber(summary?.schools.total)} tone="red" />
              <ProgressRow label="Archived" value={safeNumber(summary?.schools.archived)} total={safeNumber(summary?.schools.total)} tone="slate" />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">User Distribution</h2>
            <span className="text-xs text-slate-500">{formatNumber(summary?.users.total)} users</span>
          </div>
          {summaryQuery.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-9" />
              <SkeletonBlock className="h-9" />
              <SkeletonBlock className="h-9" />
              <SkeletonBlock className="h-9" />
              <SkeletonBlock className="h-9" />
            </div>
          ) : (
            <div className="space-y-4">
              {userDistribution.map((item) => {
                const percent = Math.max(3, Math.round((item.value / maxUserCount) * 100));
                return (
                  <div key={item.label} className="grid gap-2 sm:grid-cols-[140px_1fr_80px] sm:items-center">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${item.tone}`} style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-950 sm:text-right">{formatNumber(item.value)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">School Growth</h2>
              <p className="text-sm text-slate-500">New schools created in the selected range.</p>
            </div>
            <SmallBadge className="bg-sky-50 text-sky-700 ring-sky-200">{range}</SmallBadge>
          </div>
          <SchoolGrowthChart
            data={schoolGrowthQuery.data?.data}
            isLoading={schoolGrowthQuery.isLoading}
            isError={schoolGrowthQuery.isError}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {revenue?.isEstimated ? 'Estimated Revenue' : 'Revenue'}
              </h2>
              <p className="text-sm text-slate-500">
                {revenue?.isEstimated ? 'Estimated from active subscription plan prices.' : 'Payment and subscription summary.'}
              </p>
            </div>
            <SmallBadge className="bg-violet-50 text-violet-700 ring-violet-200">
              {revenue?.currency ?? 'INR'}
            </SmallBadge>
          </div>
          {revenueQuery.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-32" />
            </div>
          ) : revenueQuery.isError ? (
            <SectionError message="Unable to load revenue summary." />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">MRR</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {formatCurrency(revenue?.summary.monthlyRecurringRevenue, revenue?.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Total</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {formatCurrency(revenue?.summary.totalRevenue, revenue?.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pending</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {formatCurrency(revenue?.summary.pendingAmount, revenue?.currency)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Overdue</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {formatCurrency(revenue?.summary.overdueAmount, revenue?.currency)}
                  </p>
                </div>
              </div>
              <RevenueChart
                data={revenue?.data}
                isLoading={revenueQuery.isLoading}
                isError={revenueQuery.isError}
                currency={revenue?.currency}
              />
              {revenue?.isEstimated ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                  Payment data is not available yet. Pending and overdue amounts require invoice/payment records.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Support Summary</h2>
              <p className="text-sm text-slate-500">Ticket status and recent support requests.</p>
            </div>
            <Link href="/dashboard/support" prefetch={false} className="text-sm font-semibold text-sky-700 hover:underline">
              View all
            </Link>
          </div>
          {supportQuery.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-24" />
              <SkeletonBlock className="h-24" />
              <SkeletonBlock className="h-24" />
            </div>
          ) : supportQuery.isError ? (
            <SectionError message="Unable to load support summary." />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Open</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(support?.open)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">In progress</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(support?.inProgress)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Waiting</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(support?.waiting)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Critical</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{formatNumber(support?.critical)}</p>
                </div>
              </div>
              <div className="space-y-3">
                {(support?.recentTickets ?? []).length ? (
                  support?.recentTickets.slice(0, 5).map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/dashboard/support/${ticket.id}`}
                      prefetch={false}
                      className="block rounded-xl border border-slate-200 p-3 transition hover:border-sky-200 hover:bg-sky-50/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{ticket.subject}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{ticket.schoolName || 'Unknown school'}</p>
                        </div>
                        <SmallBadge className={statusBadgeClass(ticket.priority)}>{formatStatusLabel(ticket.priority)}</SmallBadge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <SmallBadge className={statusBadgeClass(ticket.status)}>{formatStatusLabel(ticket.status)}</SmallBadge>
                        <span className="text-xs text-slate-500">{formatDateTime(ticket.createdAt)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <EmptyState message="No recent support tickets." />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Top Schools</h2>
              <p className="text-sm text-slate-500">Ranked by the selected platform metric.</p>
            </div>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as TopSchoolsSort)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {topSchoolsQuery.isLoading ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
              <SkeletonBlock className="h-12" />
            </div>
          ) : topSchoolsQuery.isError ? (
            <SectionError message="Unable to load top schools." />
          ) : topSchools.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="whitespace-nowrap px-3 py-3">School</th>
                    <th className="whitespace-nowrap px-3 py-3">Status</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Students</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Teachers</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Parents</th>
                    <th className="whitespace-nowrap px-3 py-3">Plan</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Tickets</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topSchools.map((school) => (
                    <tr key={school.schoolId} className="hover:bg-slate-50">
                      <td className="max-w-[220px] truncate px-3 py-3 font-semibold text-slate-950">{school.schoolName}</td>
                      <td className="px-3 py-3">
                        <SmallBadge className={statusBadgeClass(school.status)}>{formatStatusLabel(school.status)}</SmallBadge>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(school.students)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(school.teachers)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(school.parents)}</td>
                      <td className="px-3 py-3 text-slate-700">{school.subscriptionPlan || 'N/A'}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(school.openTickets)}</td>
                      <td className="px-3 py-3 text-right">
                        <Link href="/dashboard/schools" prefetch={false} className="font-semibold text-sky-700 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No top schools data found." />
          )}
          {(sortBy === 'storage' || sortBy === 'revenue') && !topSchoolsQuery.isLoading ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Storage and payment revenue depend on backend accounting models. Missing values are shown as 0 or N/A.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Platform Activity</h2>
              <p className="text-sm text-slate-500">Latest safe audit activity across the platform.</p>
            </div>
            <Link href="/dashboard/audit" prefetch={false} className="text-sm font-semibold text-sky-700 hover:underline">
              Audit logs
            </Link>
          </div>
          {activityQuery.isLoading ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
              <SkeletonBlock className="h-16" />
            </div>
          ) : activityQuery.isError ? (
            <SectionError message="Unable to load platform activity." />
          ) : activity.length ? (
            <div className="space-y-3">
              {activity.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>
                    </div>
                    <SmallBadge className="bg-slate-100 text-slate-700 ring-slate-200">{item.type}</SmallBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>School: {item.schoolName || 'N/A'}</span>
                    <span>Actor: {item.actorName || 'System'}</span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No recent platform activity." />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-950">System Status</h2>
            <p className="text-sm text-slate-500">Lightweight health checks for platform services.</p>
          </div>
          {systemStatusQuery.isLoading ? (
            <div className="space-y-3">
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
              <SkeletonBlock className="h-14" />
            </div>
          ) : systemStatusQuery.isError ? (
            <SectionError message="System status is unavailable." />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Database</p>
                  <p className="text-xs text-slate-500">{formatNumber(systemStatus?.database.latencyMs)} ms</p>
                </div>
                <SmallBadge className={healthBadgeClass(systemStatus?.database.status)}>
                  {formatStatusLabel(systemStatus?.database.status)}
                </SmallBadge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Redis</p>
                  <p className="text-xs text-slate-500">{formatNumber(systemStatus?.redis.latencyMs)} ms</p>
                </div>
                <SmallBadge className={healthBadgeClass(systemStatus?.redis.status)}>
                  {formatStatusLabel(systemStatus?.redis.status)}
                </SmallBadge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Queues</p>
                  <p className="text-xs text-slate-500">
                    {formatNumber(systemStatus?.queues.pendingJobs)} pending, {formatNumber(systemStatus?.queues.failedJobs)} failed
                  </p>
                </div>
                <SmallBadge className={healthBadgeClass(systemStatus?.queues.status)}>
                  {formatStatusLabel(systemStatus?.queues.status)}
                </SmallBadge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Storage</p>
                <SmallBadge className={healthBadgeClass(systemStatus?.storage.status)}>
                  {formatStatusLabel(systemStatus?.storage.status)}
                </SmallBadge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-950">Email</p>
                <SmallBadge className={healthBadgeClass(systemStatus?.email.status)}>
                  {formatStatusLabel(systemStatus?.email.status)}
                </SmallBadge>
              </div>
              <p className="pt-2 text-xs text-slate-500">Generated at {formatDateTime(systemStatus?.generatedAt)}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
