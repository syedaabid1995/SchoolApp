import { api } from '../lib/api';

export type AdminDashboardMetrics = {
  totalStudents: number;
  totalTeachers: number;
  attendanceRateToday: number;
  pendingApprovals: number;
  activeClasses: number;
};

export const getAdminDashboardMetrics = async () => {
  const { data } = await api.get<AdminDashboardMetrics>('/admin/dashboard');
  return data;
};
