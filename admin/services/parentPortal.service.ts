import { api } from '../lib/api';

export type ParentChild = {
  id: string;
  name: string;
  classLabel: string;
  rollNo?: string | null;
};

export type ParentProfile = {
  name: string;
  phone?: string | null;
  email?: string | null;
  schoolName?: string | null;
  academicYear?: string | null;
  children?: ParentChild[];
};

export type ParentDashboard = {
  child?: ParentChild;
  attendancePercent?: number | null;
  currentExam?: string | null;
  latestResult?: { examName: string; total: string; status: string } | null;
  attendanceSnapshot?: { presentDays: number; absentDays: number; monthlyPercent: number } | null;
  notices?: Array<{ id: string; title: string; date: string }>;
};

export const listParentChildren = async (): Promise<ParentChild[]> => {
  const { data } = await api.get('/parents/portal/children');
  return data?.items ?? data ?? [];
};

export const getParentProfile = async (): Promise<ParentProfile> => {
  const { data } = await api.get('/parents/portal/profile');
  return data;
};

export const getParentDashboard = async (childId?: string): Promise<ParentDashboard> => {
  const { data } = await api.get('/parents/portal/dashboard', { params: { childId } });
  return data;
};

export const listParentExams = async (childId?: string, academicYearId?: string) => {
  const { data } = await api.get('/parents/portal/exams', { params: { childId, academicYearId } });
  return data?.items ?? data ?? [];
};

export const listParentResults = async (childId?: string) => {
  const { data } = await api.get('/parents/portal/results', { params: { childId } });
  return data;
};

export const listParentSubjects = async (childId?: string) => {
  const { data } = await api.get('/parents/portal/subjects', { params: { childId } });
  return data?.items ?? data ?? [];
};

export const listParentAttendance = async (childId?: string, month?: string) => {
  const { data } = await api.get('/parents/portal/attendance', { params: { childId, month } });
  return data;
};

export const listParentNotices = async (childId?: string) => {
  const { data } = await api.get('/parents/portal/notices', { params: { childId } });
  return data?.items ?? data ?? [];
};

export const listParentTimetable = async (childId?: string) => {
  const { data } = await api.get('/parents/portal/timetable', { params: { childId } });
  return data?.items ?? data ?? [];
};

export const listParentFees = async (childId?: string) => {
  const { data } = await api.get('/parents/portal/fees', { params: { childId } });
  return data?.items ?? data ?? [];
};
