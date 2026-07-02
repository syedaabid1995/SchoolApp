'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  getAdminDashboardMetrics,
  getPerformanceMetrics,
} from '../../services/adminDashboard.service';
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

export default function DashboardPage() {
  const { data: session, isLoading: isSessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isTeacher = session?.role === 'TEACHER';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => permissionCodes.includes(code);
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
        icon: 'ST',
        tone: 'blue' as const,
      },
      {
        label: 'Teachers',
        value: metricsQuery.isError ? 'N/A' : formatNumber(metricsQuery.data?.totalTeachers),
        helper: 'Teaching staff in this school.',
        icon: 'TC',
        tone: 'emerald' as const,
      },
      {
        label: 'Attendance Today',
        value: metricsQuery.isError ? 'N/A' : formatPercent(metricsQuery.data?.attendanceRateToday),
        helper: 'Today attendance rate.',
        icon: 'AT',
        tone: 'violet' as const,
      },
      {
        label: 'Active Classes',
        value: metricsQuery.isError ? 'N/A' : formatNumber(metricsQuery.data?.activeClasses),
        helper: 'Classes available for academics.',
        icon: 'CL',
        tone: 'amber' as const,
      },
    ],
    [metricsQuery.data, metricsQuery.isError],
  );

  const quickActions = useMemo(() => {
    if (isTeacher) {
      return [
        { title: 'Timetable', href: '/dashboard/timetable', icon: 'TT', description: 'Open class schedule', tone: 'blue' as const },
        { title: 'Mark Attendance', href: '/dashboard/students/attendance', icon: 'AT', description: 'Start attendance workflow', tone: 'emerald' as const },
        { title: 'Upload Marks', href: '/dashboard/academics/marks', icon: 'MK', description: 'Update assessment records', tone: 'violet' as const },
        { title: 'Reports', href: '/dashboard/reports', icon: 'RP', description: 'Review assigned reports', tone: 'slate' as const },
      ].filter((action) => {
        if (action.href === '/dashboard/timetable') return hasPermission('academics.setup');
        if (action.href === '/dashboard/students/attendance') return hasPermission('attendance.view');
        if (action.href === '/dashboard/academics/marks') return hasPermission('academics.marks');
        if (action.href === '/dashboard/reports') return hasPermission('reports.view');
        return false;
      });
    }

    return [
      { title: 'Add Student', href: '/dashboard/students/add', icon: 'AD', description: 'Register a new admission', tone: 'blue' as const },
      { title: 'Classes', href: '/dashboard/academics', icon: 'CL', description: 'Manage classes and sections', tone: 'emerald' as const },
      { title: 'Homework', href: '/dashboard/homework', icon: 'HW', description: 'Create and evaluate homework', tone: 'violet' as const },
      { title: 'Reports', href: '/dashboard/reports', icon: 'RP', description: 'Open school reports center', tone: 'slate' as const },
    ].filter((action) => {
      if (action.href === '/dashboard/students/add') return hasPermission('students.add');
      if (action.href === '/dashboard/academics') return hasPermission('academics.setup');
      if (action.href === '/dashboard/homework') return hasPermission('homework.view');
      if (action.href === '/dashboard/reports') return hasPermission('reports.view');
      return true;
    });
  }, [isTeacher, permissionCodes]);

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
            <MetricCard label="Plan" value={subscription?.planName ?? '-'} helper={subscription?.status ?? 'Status unavailable'} icon="PL" tone="blue" />
            <MetricCard label="Student Limit" value={formatNumber(subscription?.studentLimit)} helper="Maximum students allowed." icon="ST" tone="emerald" />
            <MetricCard label="Teacher Limit" value={formatNumber(subscription?.teacherLimit)} helper="Maximum teachers allowed." icon="TC" tone="amber" />
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
