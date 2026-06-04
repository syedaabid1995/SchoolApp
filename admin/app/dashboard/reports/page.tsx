'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import { getAnalytics } from '../../../services/analytics.service';
import {
  getSuperAdminDashboardSummary,
  getSupportSummary,
} from '../../../services/adminDashboard.service';
import { getSession } from '../../../services/auth.service';

type UserRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'STUDENT';
type ReportStatus = 'available' | 'coming_soon' | 'requires_module';

type ReportCardItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: ReportStatus;
  href?: string;
  actionLabel?: string;
  roles: UserRole[];
  moduleKey?: string;
  icon: string;
};

const existingRoutes = new Set([
  '/dashboard',
  '/dashboard/academics',
  '/dashboard/academics/exams',
  '/dashboard/academics/marks',
  '/dashboard/timetable',
  '/dashboard/analytics',
  '/dashboard/attendance',
  '/dashboard/attendance/my',
  '/dashboard/attendance/overview',
  '/dashboard/attendance/students/mark',
  '/dashboard/audit',
  '/dashboard/fees',
  '/dashboard/homework',
  '/dashboard/library',
  '/dashboard/leave/my',
  '/dashboard/leave/requests',
  '/dashboard/parents',
  '/dashboard/schools',
  '/dashboard/settings?tab=security',
  '/dashboard/students',
  '/dashboard/subscriptions',
  '/dashboard/support',
  '/dashboard/system-health',
  '/dashboard/backups',
  '/dashboard/teachers',
  '/dashboard/transport',
  '/parent/attendance',
  '/parent/exams',
  '/parent/fees',
  '/parent/profile',
]);

const reportExists = (href?: string) => Boolean(href && existingRoutes.has(href));

const makeReport = (item: Omit<ReportCardItem, 'status'> & { status?: ReportStatus }): ReportCardItem => {
  if (item.status) return { ...item, status: item.status };
  return {
    ...item,
    status: reportExists(item.href) ? 'available' : 'coming_soon',
  };
};

const reportCards: ReportCardItem[] = [
  makeReport({
    id: 'platform-school-growth',
    title: 'School Growth Report',
    description: 'Track new schools and platform adoption over time.',
    category: 'Platform',
    href: '/dashboard/analytics',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'SG',
  }),
  makeReport({
    id: 'platform-subscription-revenue',
    title: 'Subscription / Revenue Report',
    description: 'Review plans, subscriptions, and estimated revenue data.',
    category: 'Subscriptions',
    href: '/dashboard/subscriptions',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'SR',
  }),
  makeReport({
    id: 'platform-school-usage',
    title: 'School Usage Report',
    description: 'Open school records to review tenant usage and status.',
    category: 'Platform',
    href: '/dashboard/schools',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'SU',
  }),
  makeReport({
    id: 'platform-support',
    title: 'Support Ticket Report',
    description: 'Monitor open, urgent, and resolved platform support tickets.',
    category: 'Support',
    href: '/dashboard/support',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'ST',
  }),
  makeReport({
    id: 'platform-security-login',
    title: 'Security / Login Activity Report',
    description: 'Review security settings and login-related activity indicators.',
    category: 'Security',
    href: '/dashboard/settings?tab=security',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'SL',
  }),
  makeReport({
    id: 'platform-audit',
    title: 'Audit Log Report',
    description: 'Search user actions, changes, and compliance activity.',
    category: 'Security',
    href: '/dashboard/audit',
    actionLabel: 'View',
    roles: ['SUPER_ADMIN'],
    icon: 'AL',
  }),
  makeReport({
    id: 'platform-system-health',
    title: 'System Health Report',
    description: 'Detailed infrastructure health reports are not available yet.',
    category: 'System',
    href: '/dashboard/system-health',
    roles: ['SUPER_ADMIN'],
    icon: 'SH',
  }),
  makeReport({
    id: 'platform-backup',
    title: 'Backup Report',
    description: 'Backup history and restore reporting will be added later.',
    category: 'System',
    href: '/dashboard/backups',
    roles: ['SUPER_ADMIN'],
    icon: 'BR',
  }),
  makeReport({
    id: 'platform-compliance',
    title: 'Compliance Report',
    description: 'Data export and deletion compliance reporting is planned.',
    category: 'Compliance',
    href: '/dashboard/compliance',
    roles: ['SUPER_ADMIN'],
    icon: 'CR',
  }),

  makeReport({
    id: 'school-students',
    title: 'Student Report',
    description: 'Review student records, status, class, section, and profile details.',
    category: 'Students',
    href: '/dashboard/students',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'SR',
  }),
  makeReport({
    id: 'school-teachers',
    title: 'Teacher / Staff Report',
    description: 'View staff and teacher profiles assigned to the school.',
    category: 'Staff',
    href: '/dashboard/teachers',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'TR',
  }),
  makeReport({
    id: 'school-attendance',
    title: 'Attendance Report',
    description: 'Open attendance overview and attendance operations.',
    category: 'Attendance',
    href: '/dashboard/attendance',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'AR',
  }),
  makeReport({
    id: 'school-exams',
    title: 'Exam Report',
    description: 'Review exams, schedules, and exam setup details.',
    category: 'Exams',
    href: '/dashboard/academics/exams',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'ER',
  }),
  makeReport({
    id: 'school-marks',
    title: 'Marks Report',
    description: 'Open marks upload and academic mark records.',
    category: 'Exams',
    href: '/dashboard/academics/marks',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'MR',
  }),
  makeReport({
    id: 'school-fees',
    title: 'Fee Collection Report',
    description: 'Open collection, outstanding, ledger, discount, fine, and class-wise fee reports.',
    category: 'Fees',
    href: '/dashboard/fees',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'FR',
  }),
  makeReport({
    id: 'school-parents',
    title: 'Parent Report',
    description: 'Review parent profiles and linked student records.',
    category: 'Students',
    href: '/dashboard/parents',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'PR',
  }),
  makeReport({
    id: 'school-timetable',
    title: 'Timetable Report',
    description: 'Open academic timetable setup and published schedules.',
    category: 'Academics',
    href: '/dashboard/timetable',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'TT',
  }),
  makeReport({
    id: 'school-leave',
    title: 'Leave Report',
    description: 'Review leave requests and approval workflow records.',
    category: 'Operations',
    href: '/dashboard/leave/requests',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    icon: 'LR',
  }),
  makeReport({
    id: 'school-library',
    title: 'Library Report',
    description: 'Manage books, members, issue records, and issued book searches.',
    category: 'Operations',
    href: '/dashboard/library',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    moduleKey: 'library',
    icon: 'LB',
  }),
  makeReport({
    id: 'school-transport',
    title: 'Transport Report',
    description: 'Review students assigned to transport routes and vehicles.',
    category: 'Operations',
    href: '/dashboard/transport',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    moduleKey: 'transport',
    icon: 'TP',
  }),
  makeReport({
    id: 'school-homework',
    title: 'Homework Report',
    description: 'Create homework, evaluate students, and review completion reports.',
    category: 'Academics',
    href: '/dashboard/homework',
    actionLabel: 'View',
    roles: ['SCHOOL_ADMIN'],
    moduleKey: 'homework',
    icon: 'HW',
  }),

  makeReport({
    id: 'teacher-classes',
    title: 'My Classes Report',
    description: 'Review your timetable and assigned class schedule.',
    category: 'Classes',
    href: '/dashboard/timetable',
    actionLabel: 'View',
    roles: ['TEACHER'],
    icon: 'MC',
  }),
  makeReport({
    id: 'teacher-class-attendance',
    title: 'Class Attendance Report',
    description: 'Open attendance marking and class attendance workflows.',
    category: 'Attendance',
    href: '/dashboard/attendance/students/mark',
    actionLabel: 'View',
    roles: ['TEACHER'],
    icon: 'CA',
  }),
  makeReport({
    id: 'teacher-homework',
    title: 'Homework Report',
    description: 'Homework reporting is not available in this dashboard yet.',
    category: 'Classes',
    roles: ['TEACHER'],
    status: 'requires_module',
    moduleKey: 'homework',
    icon: 'HW',
  }),
  makeReport({
    id: 'teacher-exam-marks',
    title: 'Exam Marks Report',
    description: 'Open marks upload and assessment records.',
    category: 'Exams',
    href: '/dashboard/academics/marks',
    actionLabel: 'View',
    roles: ['TEACHER'],
    icon: 'EM',
  }),
  makeReport({
    id: 'teacher-student-performance',
    title: 'Student Performance Report',
    description: 'Detailed student performance reports are planned.',
    category: 'Performance',
    roles: ['TEACHER'],
    status: 'coming_soon',
    icon: 'SP',
  }),

  makeReport({
    id: 'parent-attendance',
    title: 'Child Attendance Report',
    description: 'View child attendance details in the parent portal.',
    category: 'Attendance',
    href: '/parent/attendance',
    actionLabel: 'View',
    roles: ['PARENT'],
    icon: 'CA',
  }),
  makeReport({
    id: 'parent-exams',
    title: 'Exam Result Report',
    description: 'Open exam results and academic performance details.',
    category: 'Exams',
    href: '/parent/exams',
    actionLabel: 'View',
    roles: ['PARENT'],
    icon: 'ER',
  }),
  makeReport({
    id: 'parent-report-card',
    title: 'Report Card',
    description: 'Report card downloads depend on selected student and term.',
    category: 'Documents',
    href: '/parent/exams',
    actionLabel: 'View',
    roles: ['PARENT'],
    icon: 'RC',
  }),
  makeReport({
    id: 'parent-fees',
    title: 'Fee Statement',
    description: 'View fee information in the parent portal.',
    category: 'Fees',
    href: '/parent/fees',
    actionLabel: 'View',
    roles: ['PARENT'],
    icon: 'FS',
  }),
  makeReport({
    id: 'parent-leave',
    title: 'Leave History',
    description: 'Leave history reporting is not available in the parent portal yet.',
    category: 'Documents',
    roles: ['PARENT'],
    status: 'coming_soon',
    icon: 'LH',
  }),

  makeReport({
    id: 'student-attendance',
    title: 'My Attendance',
    description: 'Student dashboard reports are not available yet.',
    category: 'Attendance',
    roles: ['STUDENT'],
    status: 'coming_soon',
    icon: 'MA',
  }),
  makeReport({
    id: 'student-exams',
    title: 'My Exam Results',
    description: 'Student exam result pages are not available yet.',
    category: 'Exams',
    roles: ['STUDENT'],
    status: 'coming_soon',
    icon: 'ME',
  }),
  makeReport({
    id: 'student-card',
    title: 'My Report Card',
    description: 'Student report card pages are not available yet.',
    category: 'Documents',
    roles: ['STUDENT'],
    status: 'coming_soon',
    icon: 'RC',
  }),
  makeReport({
    id: 'student-homework',
    title: 'My Homework Report',
    description: 'Homework reporting needs the homework module to be enabled.',
    category: 'Documents',
    roles: ['STUDENT'],
    status: 'requires_module',
    moduleKey: 'homework',
    icon: 'HW',
  }),
];

const roleSubtitle: Record<UserRole, string> = {
  SUPER_ADMIN: 'Platform-wide reports and analytics.',
  SCHOOL_ADMIN: 'School reports for academics, attendance, exams, and operations.',
  TEACHER: 'Reports for your classes and students.',
  PARENT: "Reports for your child's academic progress.",
  STUDENT: 'Reports for your attendance, exams, and learning activity.',
};

const statusLabels: Record<ReportStatus, string> = {
  available: 'Available',
  coming_soon: 'Coming soon',
  requires_module: 'Requires module',
};

const statusClasses: Record<ReportStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  coming_soon: 'bg-[var(--shell-subtle)] text-[var(--shell-muted)] ring-[var(--shell-border)]',
  requires_module: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const formatNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numberValue) ? numberValue : 0);
};

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-[var(--shell-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--shell-text)]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">{helper}</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-32 animate-pulse rounded-xl bg-[var(--shell-hover)]" />;
}

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function ReportCard({ report }: { report: ReportCardItem }) {
  const canNavigate = report.status === 'available' && reportExists(report.href);

  return (
    <article className="group flex h-full flex-col rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
          {report.icon}
        </div>
        <ReportStatusBadge status={report.status} />
      </div>
      <div className="mt-4 flex-1">
        <p className="text-xs font-bold uppercase text-[var(--shell-muted)]">{report.category}</p>
        <h2 className="mt-2 text-base font-bold text-[var(--shell-text)] group-hover:text-blue-700">{report.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">{report.description}</p>
      </div>
      <div className="mt-5">
        {canNavigate ? (
          <Link
            href={report.href!}
            prefetch={false}
            className="inline-flex w-full items-center justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            {report.actionLabel ?? 'View'}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--shell-muted)]"
          >
            {report.status === 'requires_module' ? 'Requires module' : 'Coming soon'}
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-subtle)] p-8 text-center text-sm text-[var(--shell-muted)]">
      {message}
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | ReportStatus>('all');
  const [dateRange, setDateRange] = useState('30d');

  const {
    data: session,
    isLoading: isSessionLoading,
    refetch: refetchSession,
  } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const role = session?.role as UserRole | undefined;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const schoolId = session?.schoolId ?? undefined;

  const summaryQuery = useQuery({
    queryKey: ['reports-super-admin-summary'],
    queryFn: getSuperAdminDashboardSummary,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const supportQuery = useQuery({
    queryKey: ['reports-super-admin-support'],
    queryFn: getSupportSummary,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['reports-school-analytics', schoolId],
    queryFn: () => getAnalytics({ schoolId }),
    enabled: Boolean(isSchoolAdmin && schoolId),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isSessionLoading && !session?.role) {
      router.replace('/login');
    }
  }, [isSessionLoading, router, session?.role]);

  const visibleReports = useMemo(() => {
    if (!role) return [];
    const normalizedSearch = search.trim().toLowerCase();

    return reportCards.filter((report) => {
      if (!report.roles.includes(role)) return false;
      if (category !== 'all' && report.category !== category) return false;
      if (status !== 'all' && report.status !== status) return false;
      if (!normalizedSearch) return true;

      return (
        report.title.toLowerCase().includes(normalizedSearch) ||
        report.description.toLowerCase().includes(normalizedSearch) ||
        report.category.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [category, role, search, status]);

  const categories = useMemo(() => {
    if (!role) return [];
    return Array.from(new Set(reportCards.filter((report) => report.roles.includes(role)).map((report) => report.category))).sort();
  }, [role]);

  const groupedReports = useMemo(() => {
    return visibleReports.reduce<Record<string, ReportCardItem[]>>((groups, report) => {
      groups[report.category] = groups[report.category] ? [...groups[report.category], report] : [report];
      return groups;
    }, {});
  }, [visibleReports]);

  const quickStats = useMemo(() => {
    if (isSuperAdmin) {
      return [
        {
          label: 'Total Schools',
          value: formatNumber(summaryQuery.data?.schools.total),
          helper: 'All schools registered on the platform.',
        },
        {
          label: 'Active Schools',
          value: formatNumber(summaryQuery.data?.schools.active),
          helper: 'Schools currently active.',
        },
        {
          label: 'Open Support Tickets',
          value: formatNumber(supportQuery.data?.open ?? summaryQuery.data?.support.openTickets),
          helper: 'Open tickets across all schools.',
        },
        {
          label: 'Failed Logins Today',
          value: formatNumber(summaryQuery.data?.security.failedLoginsToday),
          helper: 'Failed login audit events today.',
        },
      ];
    }

    if (isSchoolAdmin) {
      return [
        {
          label: 'Total Students',
          value: formatNumber(analyticsQuery.data?.studentCount),
          helper: 'Student count from school analytics.',
        },
        {
          label: 'Active Teachers',
          value: formatNumber(analyticsQuery.data?.teacherActivity.activeTeachers),
          helper: 'Teachers active in attendance sessions.',
        },
        {
          label: 'Today Attendance',
          value: `${formatNumber(analyticsQuery.data?.attendanceRate)}%`,
          helper: 'Attendance rate from available analytics.',
        },
        {
          label: 'Exams',
          value: formatNumber(analyticsQuery.data?.academicSummary.exams),
          helper: 'Exam count from academic analytics.',
        },
      ];
    }

    return [];
  }, [analyticsQuery.data, isSchoolAdmin, isSuperAdmin, summaryQuery.data, supportQuery.data]);

  const refreshData = async () => {
    await Promise.allSettled([
      refetchSession(),
      isSuperAdmin ? summaryQuery.refetch() : Promise.resolve(),
      isSuperAdmin ? supportQuery.refetch() : Promise.resolve(),
      isSchoolAdmin ? analyticsQuery.refetch() : Promise.resolve(),
    ]);
  };

  if (isSessionLoading) {
    return <FullPageLoader label="Loading reports..." />;
  }

  if (!role) {
    return null;
  }

  const isStatsLoading =
    (isSuperAdmin && (summaryQuery.isLoading || supportQuery.isLoading)) ||
    (isSchoolAdmin && analyticsQuery.isLoading);
  const roleReports = reportCards.filter((report) => report.roles.includes(role));
  const availableReports = roleReports.filter((report) => report.status === 'available').length;
  const pendingReports = roleReports.length - availableReports;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="grid gap-5 border-b border-[var(--shell-border)] bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(37,99,235,0.10),rgba(16,185,129,0.08))] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[var(--shell-muted)]">Reports Center</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--shell-text)] md:text-3xl">Reports</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--shell-muted)]">
              {roleSubtitle[role] ?? 'Available reports for your account.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm font-bold text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              aria-label="Date range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="6m">Last 6 months</option>
              <option value="12m">Last 12 months</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              loading={summaryQuery.isFetching || supportQuery.isFetching || analyticsQuery.isFetching}
            >
              Refresh
            </Button>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--shell-muted)]">Catalog</p>
            <p className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{roleReports.length}</p>
            <p className="mt-1 text-xs text-[var(--shell-muted)]">Reports mapped to your role.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase text-emerald-700">Available</p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">{availableReports}</p>
            <p className="mt-1 text-xs text-emerald-700">Ready to open now.</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase text-amber-700">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{pendingReports}</p>
            <p className="mt-1 text-xs text-amber-700">Coming soon or module-gated.</p>
          </div>
        </div>
      </section>

      {quickStats.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {isStatsLoading
            ? Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)
            : quickStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>
      ) : (
        <EmptyState message="Quick stats are not available for this role yet." />
      )}

      <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[var(--shell-border)] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Find a Report</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">Filter the report catalog without leaving this page.</p>
          </div>
          <span className="rounded-full bg-[var(--shell-subtle)] px-3 py-1 text-xs font-bold text-[var(--shell-muted)]">
            {visibleReports.length} visible
          </span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <div>
            <label htmlFor="report-search" className="mb-2 block text-sm font-bold text-[var(--shell-text)]">
              Search reports
            </label>
            <input
              id="report-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by report name"
              className="w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <div>
            <label htmlFor="report-category" className="mb-2 block text-sm font-bold text-[var(--shell-text)]">
              Category
            </label>
            <select
              id="report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-status" className="mb-2 block text-sm font-bold text-[var(--shell-text)]">
              Status
            </label>
            <select
              id="report-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | ReportStatus)}
              className="w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2.5 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="coming_soon">Coming soon</option>
              <option value="requires_module">Requires module</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setCategory('all');
              setStatus('all');
            }}
          >
            Clear
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
          <h2 className="text-base font-bold text-[var(--shell-text)]">Categories</h2>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${category === 'all' ? 'bg-slate-950 text-white' : 'text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]'}`}
            >
              <span>All categories</span>
              <span>{roleReports.length}</span>
            </button>
            {categories.map((item) => {
              const count = roleReports.filter((report) => report.category === item).length;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-bold ${category === item ? 'bg-slate-950 text-white' : 'text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]'}`}
                >
                  <span>{item}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="space-y-6">
        {Object.keys(groupedReports).length ? (
          Object.entries(groupedReports).map(([group, reports]) => (
            <div key={group} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--shell-border)] pb-3">
                <h2 className="text-lg font-bold text-[var(--shell-text)]">{group}</h2>
                <span className="rounded-full bg-[var(--shell-subtle)] px-3 py-1 text-xs font-bold text-[var(--shell-muted)]">{reports.length} reports</span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {reports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="No reports available for the selected filters." />
        )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Recent Generated Reports</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              Report history will appear here when a generated-report history API is available.
            </p>
          </div>
          <span className="rounded-full bg-[var(--shell-subtle)] px-3 py-1 text-xs font-bold text-[var(--shell-muted)]">
            {dateRange}
          </span>
        </div>
        <div className="mt-5">
          <EmptyState message="No generated reports yet." />
        </div>
      </section>
    </div>
  );
}
