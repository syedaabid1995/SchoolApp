import { api } from '../lib/api';

export type StudentAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

export type StudentAttendanceSession = {
  id: string;
  classId: string;
  sectionId: string;
  date: string;
  status: 'DRAFT' | 'LOCKED';
  lockReason: string | null;
  records: Array<{
    id: string;
    studentId: string;
    status: StudentAttendanceStatus;
    remarks?: string | null;
  }>;
};

export const createStudentAttendanceSession = async (payload: {
  classId: string;
  sectionId: string;
  date: string;
  schoolId?: string;
}) => {
  const { data } = await api.post<StudentAttendanceSession>('/attendance/sessions', payload);
  return data;
};

export const updateStudentAttendanceSession = async (
  id: string,
  payload: { records: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string }>; submit?: boolean; unlock?: boolean; reason?: string; schoolId?: string },
) => {
  const { data } = await api.patch<StudentAttendanceSession>(`/attendance/sessions/${id}`, payload);
  return data;
};

export const lockStudentAttendanceSession = async (id: string, reason: string, schoolId?: string) => {
  const { data } = await api.post<StudentAttendanceSession>(`/attendance/sessions/${id}/lock`, { reason, schoolId });
  return data;
};

export const getAttendanceSummary = async (params?: { date?: string; schoolId?: string }) => {
  const { data } = await api.get('/attendance/summary', { params });
  return data as {
    totals: { sessions: number; records: number; present: number; absent: number; late: number; halfDay: number };
    sessions: Array<{ id: string; date: string; className: string; sectionName: string; status: string; recordCount: number; lockReason: string | null }>;
  };
};

export const markTeacherSelfAttendance = async (payload: {
  status: 'PRESENT' | 'LEAVE';
  date?: string;
  teacherId?: string;
  overrideReason?: string;
  schoolId?: string;
}) => {
  const { data } = await api.post('/attendance/teacher/self', payload);
  return data;
};

export const listTeacherSelfAttendance = async (params?: { fromDate?: string; toDate?: string; teacherId?: string; schoolId?: string }) => {
  const { data } = await api.get('/attendance/teacher/self', { params });
  return data as Array<{ id: string; date: string; status: 'PRESENT' | 'LEAVE'; overrideReason?: string | null }>;
};

export const createLeaveRequest = async (payload: { fromDate: string; toDate: string; reason: string; schoolId?: string }) => {
  const { data } = await api.post('/leave/requests', payload);
  return data;
};

export const listLeaveRequests = async (params?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; schoolId?: string }) => {
  const { data } = await api.get('/leave/requests', { params });
  return data as Array<{
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    fromDate: string;
    toDate: string;
    reason: string;
    teacher?: { firstName: string; lastName: string };
  }>;
};

export const approveLeaveRequest = async (id: string, reason?: string, schoolId?: string) => {
  const { data } = await api.patch(`/leave/requests/${id}/approve`, { reason, schoolId });
  return data;
};

export const rejectLeaveRequest = async (id: string, reason?: string, schoolId?: string) => {
  const { data } = await api.patch(`/leave/requests/${id}/reject`, { reason, schoolId });
  return data;
};
