import { api } from '../lib/api';

export type AttendanceSummary = {
  totals: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
  };
  daily: Array<{
    date: string;
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  }>;
  byClass: Array<{
    classId: string | null;
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  }>;
};

export type AttendanceSession = {
  id: string;
  date: string;
  status: string;
  approvalStatus: string;
  period?: { id: string; name: string };
  _count?: { records: number };
};

export const getAttendanceSummary = async (params?: {
  dateFrom?: string;
  dateTo?: string;
  classId?: string;
  schoolId?: string;
}) => {
  const { data } = await api.get<AttendanceSummary>('/attendance-summary', { params });
  return data;
};

export const listAttendanceSessions = async (params?: { dateFrom?: string; dateTo?: string; approvalStatus?: string; schoolId?: string }) => {
  const { data } = await api.get<AttendanceSession[]>('/attendance/sessions', { params });
  return data;
};

export const approveSession = async (sessionId: string, schoolId?: string) => {
  const { data } = await api.post(`/attendance-approval/sessions/${sessionId}/approve`, { schoolId });
  return data;
};

export const rejectSession = async (sessionId: string, reason: string, schoolId?: string) => {
  const { data } = await api.post(`/attendance-approval/sessions/${sessionId}/reject`, { reason, schoolId });
  return data;
};
