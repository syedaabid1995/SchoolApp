import { api } from '../lib/api';

type ApiEnvelope<T> = T | { success?: boolean; data: T };

const unwrapData = <T>(payload: ApiEnvelope<T>): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    (payload as { data?: T }).data !== undefined
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export type AdminDashboardMetrics = {
  totalStudents: number;
  totalTeachers: number;
  attendanceRateToday: number;
  pendingApprovals: number;
  activeClasses: number;
};

export type WeeklyAnalytics = {
  attendance: number[];
  enrollment: number[];
  performance: number[];
  days: string[];
};

export type PerformanceMetrics = {
  overallScore: number;
  attendanceRate: number;
  satisfactionRate: number;
};

export type RecentActivity = {
  id: string;
  action: string;
  time: string;
  type: 'success' | 'info' | 'warning';
};

export type SystemStatus = {
  database: { status: 'healthy' | 'warning' | 'error'; label: string };
  apiServices: { status: 'online' | 'offline' | 'maintenance'; label: string };
  backup: { status: 'scheduled' | 'running' | 'failed'; label: string };
};

export type DashboardRange = '7d' | '30d' | '6m' | '12m';

export type TopSchoolsSort = 'students' | 'teachers' | 'storage' | 'revenue' | 'tickets';

export type SuperAdminSummary = {
  schools: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    archived: number;
  };
  users: {
    total: number;
    superAdmins: number;
    schoolAdmins: number;
    teachers: number;
    parents: number;
    students: number;
  };
  subscriptions: {
    totalPlans: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    expiredSubscriptions: number;
    cancelledSubscriptions: number;
  };
  support: {
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    criticalTickets: number;
  };
  security: {
    failedLoginsToday: number;
    successfulLoginsToday: number;
    activeSessions: number;
    mfaEnabledAdmins: number;
  };
  system: {
    backupJobsToday: number;
    failedBackupJobs: number;
    pendingComplianceRequests: number;
  };
};

export type SchoolGrowthPoint = {
  period: string;
  newSchools: number;
  activeSchools: number;
  suspendedSchools: number;
};

export type SchoolGrowthResponse = {
  range: DashboardRange;
  data: SchoolGrowthPoint[];
};

export type RevenuePoint = {
  period: string;
  revenue: number;
  pending: number;
  overdue: number;
};

export type RevenueSummaryResponse = {
  range: DashboardRange;
  currency: string;
  isEstimated?: boolean;
  revenueSource?: string;
  summary: {
    monthlyRecurringRevenue: number;
    totalRevenue: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  data: RevenuePoint[];
};

export type PlatformActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  schoolId?: string | null;
  schoolName?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
};

export type PlatformActivityResponse = {
  items: PlatformActivityItem[];
};

export type SupportTicketSummaryItem = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  schoolId: string;
  schoolName: string;
  createdAt: string;
};

export type SupportSummaryResponse = {
  total: number;
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  closed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  recentTickets: SupportTicketSummaryItem[];
};

export type TopSchoolItem = {
  schoolId: string;
  schoolName: string;
  status: string;
  students: number;
  teachers: number;
  parents: number;
  subscriptionPlan: string;
  storageUsed: number;
  openTickets: number;
};

export type TopSchoolsResponse = {
  sortBy: TopSchoolsSort;
  items: TopSchoolItem[];
};

export type PlatformStatusValue = 'healthy' | 'warning' | 'down' | 'unknown' | 'error' | 'unavailable';

export type PlatformSystemStatus = {
  database: {
    status: PlatformStatusValue;
    latencyMs: number;
  };
  redis: {
    status: PlatformStatusValue;
    latencyMs: number;
  };
  queues: {
    status: PlatformStatusValue;
    pendingJobs: number;
    failedJobs: number;
  };
  storage: {
    status: PlatformStatusValue;
  };
  email: {
    status: PlatformStatusValue;
  };
  generatedAt: string;
  api?: string;
  db?: string;
  uptimeSeconds?: number;
};

export const getAdminDashboardMetrics = async () => {
  const { data } = await api.get<AdminDashboardMetrics>('/admin/dashboard');
  return data;
};

export const getWeeklyAnalytics = async () => {
  const { data } = await api.get<WeeklyAnalytics>('/admin/dashboard/analytics/weekly');
  return data;
};

export const getPerformanceMetrics = async () => {
  const { data } = await api.get<PerformanceMetrics>('/admin/dashboard/performance');
  return data;
};

export const getRecentActivities = async () => {
  const { data } = await api.get<RecentActivity[]>('/admin/dashboard/activities');
  return data;
};

export const getSystemStatus = async () => {
  const { data } = await api.get<SystemStatus>('/admin/dashboard/system-status');
  return data;
};

export const getSuperAdminDashboardSummary = async () => {
  const { data } = await api.get<ApiEnvelope<SuperAdminSummary>>('/admin/dashboard/summary');
  return unwrapData(data);
};

export const getSchoolGrowth = async (range: DashboardRange) => {
  const { data } = await api.get<ApiEnvelope<SchoolGrowthResponse>>('/admin/dashboard/school-growth', {
    params: { range },
  });
  return unwrapData(data);
};

export const getRevenueSummary = async (range: DashboardRange) => {
  const { data } = await api.get<ApiEnvelope<RevenueSummaryResponse>>('/admin/dashboard/revenue', {
    params: { range },
  });
  return unwrapData(data);
};

export const getPlatformActivity = async (limit = 20) => {
  const { data } = await api.get<ApiEnvelope<PlatformActivityResponse>>('/admin/dashboard/activity', {
    params: { limit },
  });
  return unwrapData(data);
};

export const getSupportSummary = async () => {
  const { data } = await api.get<ApiEnvelope<SupportSummaryResponse>>('/admin/dashboard/support-summary');
  return unwrapData(data);
};

export const getTopSchools = async (sortBy: TopSchoolsSort, limit = 10) => {
  const { data } = await api.get<ApiEnvelope<TopSchoolsResponse>>('/admin/dashboard/top-schools', {
    params: { sortBy, limit },
  });
  return unwrapData(data);
};

export const getSuperAdminSystemStatus = async () => {
  const { data } = await api.get<ApiEnvelope<PlatformSystemStatus>>('/admin/dashboard/system-status');
  return unwrapData(data);
};
