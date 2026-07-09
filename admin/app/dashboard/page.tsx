'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getAdminDashboardMetrics,
  getPerformanceMetrics,
} from '../../services/adminDashboard.service';
import { listTodayBirthdays } from '../../services/communication.service';
import { listAuditLogs } from '../../services/audit.service';
import FullPageLoader from '../../components/FullPageLoader';
import { getSession } from '../../services/auth.service';
import { getSubscription } from '../../services/subscription.service';
import { getTeacherTimetable } from '../../services/academic.service';
import AccessDeniedPanel from '../../components/AccessDeniedPanel';
import SuperAdminDashboardClient from '../../components/dashboard/SuperAdminDashboardClient';
import {
  DashboardHero,
  EmptyPanel,
  MetricCard,
  QuickActionTile,
  RingMetric,
  SectionPanel,
} from '../../components/dashboard/ModernDashboardPrimitives';

const formatNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numberValue) ? numberValue : 0);
};

const formatPercent = (value: unknown) => `${formatNumber(value)}%`;

function BirthdayBanner({
  items,
  loading,
}: {
  items: Array<{ id: string; name: string; type: string; subtitle?: string | null; photoUrl?: string | null }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-sm font-semibold text-[var(--shell-muted)]">
        Loading birthdays...
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-pink-100 bg-pink-50 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="shrink-0">
          <p className="text-xs font-bold uppercase tracking-wide text-pink-700">Today Birthdays</p>
          <p className="text-sm font-semibold text-pink-950">{items.length} celebration{items.length === 1 ? '' : 's'} today</p>
        </div>
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const initials = item.name
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join('') || 'B';
            return (
              <div key={`${item.type}-${item.id}`} className="flex min-w-[220px] items-center gap-3 rounded-lg border border-pink-100 bg-white px-3 py-2">
                {item.photoUrl ? (
                  <span className="h-10 w-10 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${item.photoUrl})` }} aria-hidden="true" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-sm font-bold text-pink-700">{initials}</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-950">{item.name}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{item.subtitle || item.type.replace(/_/g, ' ')}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isTeacher = session?.role === 'TEACHER';
  const permissionCodes = useMemo(() => session?.permissionCodes ?? [], [session?.permissionCodes]);
  const hasPermission = useCallback((code: string) => permissionCodes.includes(code), [permissionCodes]);
  const canViewDashboard = Boolean(isSuperAdmin || hasPermission('dashboard.overview'));
  const schoolId = session?.schoolId ?? undefined;
  const [loadHeavy, setLoadHeavy] = useState(false);

  const metricsQuery = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboardMetrics,
    enabled: canViewDashboard && !isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const performanceQuery = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: getPerformanceMetrics,
    enabled: canViewDashboard && !isSuperAdmin && loadHeavy,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const auditQuery = useQuery({
    queryKey: ['recent-audit-logs'],
    queryFn: () => listAuditLogs({ limit: 5 }),
    enabled: canViewDashboard && !isSuperAdmin && loadHeavy && hasPermission('audit.view'),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const subscriptionQuery = useQuery({
    queryKey: ['subscription', schoolId],
    queryFn: () => getSubscription(schoolId),
    enabled: Boolean(schoolId) && canViewDashboard && hasPermission('plans.view'),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const teacherScheduleQuery = useQuery({
    queryKey: ['teacher-timetable-home', schoolId],
    queryFn: () => getTeacherTimetable({ schoolId }),
    enabled: Boolean(schoolId && isTeacher && canViewDashboard && hasPermission('academics.setup')),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const birthdayQuery = useQuery({
    queryKey: ['today-birthdays', schoolId],
    queryFn: () => listTodayBirthdays(schoolId),
    enabled: Boolean(schoolId && canViewDashboard && !isSuperAdmin),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const idle = (window as any).requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(() => setLoadHeavy(true), { timeout: 2000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    }
    const timeout = window.setTimeout(() => setLoadHeavy(true), 600);
    return () => window.clearTimeout(timeout);
  }, []);

  const stats = useMemo(
    () => [
      {
        label: 'Students',
        value: metricsQuery.isError ? 'N/A' : formatNumber(metricsQuery.data?.totalStudents),
        helper: 'Total active student records.',
        icon: 'users' as const,
        tone: 'blue' as const,
      },
      {
        label: 'Teachers',
        value: metricsQuery.isError ? 'N/A' : formatNumber(metricsQuery.data?.totalTeachers),
        helper: 'Teaching staff in this school.',
        icon: 'graduationCap' as const,
        tone: 'emerald' as const,
      },
      {
        label: 'Attendance Today',
        value: metricsQuery.isError ? 'N/A' : formatPercent(metricsQuery.data?.attendanceRateToday),
        helper: 'Today attendance rate.',
        icon: 'checkCircle' as const,
        tone: 'violet' as const,
      },
      {
        label: 'Active Classes',
        value: metricsQuery.isError ? 'N/A' : formatNumber(metricsQuery.data?.activeClasses),
        helper: 'Classes available for academics.',
        icon: 'book' as const,
        tone: 'amber' as const,
      },
    ],
    [metricsQuery.data, metricsQuery.isError],
  );

  const quickActions = useMemo(() => {
    if (isTeacher) {
      return [
        { title: 'Timetable', href: '/dashboard/timetable', icon: 'calendar' as const, description: 'Open class schedule', tone: 'blue' as const },
        { title: 'Mark Attendance', href: '/dashboard/attendance/my', icon: 'check' as const, description: 'Mark your own attendance', tone: 'emerald' as const },
        { title: 'Upload Marks', href: '/dashboard/academics/marks', icon: 'chart' as const, description: 'Update assessment records', tone: 'violet' as const },
        { title: 'Reports', href: '/dashboard/reports', icon: 'fileText' as const, description: 'Review assigned reports', tone: 'slate' as const },
      ].filter((action) => {
        if (action.href === '/dashboard/timetable') return hasPermission('academics.setup');
        if (action.href === '/dashboard/attendance/my') return hasPermission('attendance.view');
        if (action.href === '/dashboard/academics/marks') return hasPermission('academics.marks');
        if (action.href === '/dashboard/reports') return hasPermission('reports.view');
        return false;
      });
    }

    return [
      { title: 'Add Student', href: '/dashboard/students/add', icon: 'userPlus' as const, description: 'Register a new admission', tone: 'blue' as const },
      { title: 'Classes', href: '/dashboard/academics', icon: 'book' as const, description: 'Manage classes and sections', tone: 'emerald' as const },
      { title: 'Homework', href: '/dashboard/homework', icon: 'clipboard' as const, description: 'Create and evaluate homework', tone: 'violet' as const },
      { title: 'Reports', href: '/dashboard/reports', icon: 'chart' as const, description: 'Open school reports center', tone: 'slate' as const },
    ].filter((action) => {
      if (action.href === '/dashboard/students/add') return hasPermission('students.add');
      if (action.href === '/dashboard/academics') return hasPermission('academics.setup');
      if (action.href === '/dashboard/homework') return hasPermission('homework.view');
      if (action.href === '/dashboard/reports') return hasPermission('reports.view');
      return true;
    });
  }, [hasPermission, isTeacher]);

  if (isSessionLoading) {
    return <FullPageLoader label="Loading dashboard..." />;
  }

  if (isSuperAdmin) {
    return <SuperAdminDashboardClient />;
  }

  if (!canViewDashboard) {
    return <AccessDeniedPanel />;
  }

  if (metricsQuery.isLoading) {
    return <FullPageLoader label="Loading dashboard..." />;
  }

  const subscription = subscriptionQuery.data;
  const teacherSchedule = teacherScheduleQuery.data;
  const auditItems = auditQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={isTeacher ? 'Teacher Workspace' : 'School Workspace'}
        title={isTeacher ? 'Today at a Glance' : 'Dashboard Overview'}
        subtitle={isTeacher ? 'Your schedule, class activity, and reporting shortcuts are ready in one place.' : 'A single view for students, attendance, academics, and daily school operations.'}
        actions={(
          <>
            {hasPermission('reports.view') ? (
            <Link href="/dashboard/reports" prefetch={false} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
              Reports
            </Link>
            ) : null}
            {hasPermission('students.add') ? (
              <Link href="/dashboard/students/add" prefetch={false} className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-bold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]">
                Add Student
              </Link>
            ) : null}
          </>
        )}
      >
        <BirthdayBanner items={birthdayQuery.data ?? []} loading={birthdayQuery.isLoading} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <MetricCard key={stat.label} {...stat} />
          ))}
        </div>
      </DashboardHero>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.length ? quickActions.map((action) => (
          <QuickActionTile key={action.title} {...action} />
        )) : <EmptyPanel message="No quick actions are enabled for your role." />}
      </section>

      {hasPermission('plans.view') ? (
        <SectionPanel
          title="Current Plan"
          subtitle="Subscription status and operating limits for this school."
          action={<Link href="/dashboard/plans" prefetch={false} className="text-sm font-bold text-blue-700 hover:underline">Manage Plans</Link>}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Plan" value={subscription?.planName ?? '-'} helper={subscription?.status ?? 'Status unavailable'} icon="package" tone="blue" />
            <MetricCard label="Student Limit" value={formatNumber(subscription?.studentLimit)} helper="Maximum students allowed." icon="users" tone="emerald" />
            <MetricCard label="Teacher Limit" value={formatNumber(subscription?.teacherLimit)} helper="Maximum teachers allowed." icon="graduationCap" tone="amber" />
          </div>
        </SectionPanel>
      ) : null}

      {isTeacher && hasPermission('academics.setup') ? (
        <SectionPanel title="Today's Periods" subtitle={teacherSchedule?.version ? `Version: ${teacherSchedule.version.name}` : 'No published timetable for today.'}>
          <div className="space-y-3">
            {(teacherSchedule?.periods ?? []).map((period) => (
              <div key={period.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3">
                <p className="text-sm font-bold text-[var(--shell-text)]">
                  {period.period.name} ({period.period.startTime}-{period.period.endTime})
                </p>
                <p className="mt-1 text-sm text-[var(--shell-muted)]">
                  {period.subject.name} - {period.class.name}
                  {period.section?.name ? ` ${period.section.name}` : ''}
                  {period.room ? ` - Room ${period.room}` : ''}
                </p>
              </div>
            ))}
            {!teacherSchedule?.periods?.length ? <EmptyPanel message="No classes assigned for today." /> : null}
          </div>
        </SectionPanel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionPanel title="Performance Metrics" subtitle="Operational health indicators.">
            <div className="space-y-3">
              <RingMetric value={performanceQuery.data?.overallScore ?? 0} label="Overall Score" tone="blue" />
              <RingMetric value={performanceQuery.data?.attendanceRate ?? 0} label="Attendance" tone="emerald" />
              <RingMetric value={performanceQuery.data?.satisfactionRate ?? 0} label="Satisfaction" tone="amber" />
            </div>
          </SectionPanel>

          {hasPermission('audit.view') ? (
          <SectionPanel title="Recent Activity" subtitle="Latest audit events from the school workspace.">
            {auditItems.length ? (
              <div className="space-y-3">
                {auditItems.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-3">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[var(--shell-text)]">
                        {log.action ?? 'Activity'} {(log.entityType ?? log.targetType ?? 'record').toLowerCase()}
                      </p>
                      <p className="mt-1 text-xs text-[var(--shell-muted)]">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel message="No recent activity found." />
            )}
          </SectionPanel>
          ) : null}
      </section>
    </div>
  );
}
