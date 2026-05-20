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
  '/dashboard/academics/timetable',
  '/dashboard/analytics',
  '/dashboard/attendance',
  '/dashboard/attendance/my',
  '/dashboard/attendance/overview',
  '/dashboard/attendance/students/mark',
  '/dashboard/audit',
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
    title: 'Fees Report',
    description: 'Fee report pages are not available in the current dashboard yet.',
    category: 'Fees',
    href: '/dashboard/fees',
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
    href: '/dashboard/academics/timetable',
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
    description: 'Library reporting needs the library module to be enabled.',
    category: 'Operations',
    roles: ['SCHOOL_ADMIN'],
    status: 'requires_module',
    moduleKey: 'library',
    icon: 'LB',
  }),
  makeReport({
    id: 'school-transport',
    title: 'Transport Report',
    description: 'Transport reporting needs the transport module to be enabled.',
    category: 'Operations',
    roles: ['SCHOOL_ADMIN'],
    status: 'requires_module',
    moduleKey: 'transport',
    icon: 'TP',
  }),

  makeReport({
    id: 'teacher-classes',
    title: 'My Classes Report',
    description: 'Review your timetable and assigned class schedule.',
    category: 'Classes',
    href: '/dashboard/academics/timetable',
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
  coming_soon: 'bg-slate-100 text-slate-600 ring-slate-200',
  requires_module: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const formatNumber = (value: unknown) => {
  const numberValue = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numberValue) ? numberValue : 0);
};

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />;
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
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sm font-bold text-sky-700 ring-1 ring-sky-100">
          {report.icon}
        </div>
        <ReportStatusBadge status={report.status} />
      </div>
      <div className="mt-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{report.category}</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">{report.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{report.description}</p>
      </div>
      <div className="mt-5">
        {canNavigate ? (
          <Link
            href={report.href!}
            prefetch={false}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {report.actionLabel ?? 'View'}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-500"
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
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Reports Center</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Reports</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {roleSubtitle[role] ?? 'Available reports for your account.'}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
      </section>

      {quickStats.length ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isStatsLoading
            ? Array.from({ length: 4 }, (_, index) => <SkeletonCard key={index} />)
            : quickStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>
      ) : (
        <EmptyState message="Quick stats are not available for this role yet." />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
          <div>
            <label htmlFor="report-search" className="mb-2 block text-sm font-medium text-slate-700">
              Search reports
            </label>
            <input
              id="report-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by report name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label htmlFor="report-category" className="mb-2 block text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              id="report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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
            <label htmlFor="report-status" className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="report-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | ReportStatus)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
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

      <section className="space-y-6">
        {Object.keys(groupedReports).length ? (
          Object.entries(groupedReports).map(([group, reports]) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-950">{group}</h2>
                <span className="text-sm text-slate-500">{reports.length} reports</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reports.map((report) => (
                  <ReportCard key={report.id} report={report} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <EmptyState message="No reports available for the selected filters." />
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Recent Generated Reports</h2>
            <p className="mt-1 text-sm text-slate-500">
              Report history will appear here when a generated-report history API is available.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
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
