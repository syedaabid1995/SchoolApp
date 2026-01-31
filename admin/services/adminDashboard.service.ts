import { api } from '../lib/api';

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
