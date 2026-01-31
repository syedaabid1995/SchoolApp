import { api } from '../lib/api';

export type AnalyticsResponse = {
  attendanceRate: number;
  studentCount: number;
  teacherActivity: { sessions: number; activeTeachers: number };
  academicSummary: { exams: number; marks: number };
};

export const getAnalytics = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<AnalyticsResponse>('/analytics', { params });
  return data;
};
