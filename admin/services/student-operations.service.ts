import { api } from '../lib/api';
import type { Student } from './student.service';

export type StudentAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY';
export type StudentPromotionResult = 'PASS' | 'FAIL';

export type StudentGroup = {
  id: string;
  name: string;
  _count?: { students?: number };
  createdAt?: string;
  updatedAt?: string;
};

export type StudentCategory = StudentGroup;

export type AttendanceStudentRow = {
  id: string;
  admissionNo: string;
  rollNo?: string | null;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  status: StudentAttendanceStatus;
  note?: string | null;
  attendanceId?: string | null;
};

export type AttendanceLoadResponse = {
  date: string;
  holiday?: { id: string; reason?: string | null } | null;
  students: AttendanceStudentRow[];
};

export type AttendanceReportRow = {
  studentId: string;
  admissionNo: string;
  rollNo?: string | null;
  studentName: string;
  present: number;
  late: number;
  absent: number;
  holiday: number;
  halfDay: number;
  percentage: number;
  daily: Array<{ day: number; status: string; note?: string | null }>;
};

export type AttendanceReportResponse = {
  daysInMonth: number;
  holidays: Array<{ id: string; holidayDate: string; reason?: string | null }>;
  rows: AttendanceReportRow[];
};

export type PromotionPreview = {
  currentSession?: { id: string; name: string } | null;
  suggestedPromoteSession?: { id: string; name: string } | null;
  students: Student[];
};

const cleanParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export const listStudentGroups = async (params?: { search?: string }) => {
  const { data } = await api.get<StudentGroup[]>('/students/groups', { params: cleanParams(params) });
  return data;
};

export const createStudentGroup = async (payload: { name: string }) => {
  const { data } = await api.post<StudentGroup>('/students/groups', payload);
  return data;
};

export const updateStudentGroup = async (id: string, payload: { name: string }) => {
  const { data } = await api.patch<StudentGroup>(`/students/groups/${id}`, payload);
  return data;
};

export const deleteStudentGroup = async (id: string) => {
  await api.delete(`/students/groups/${id}`);
};

export const listStudentCategories = async (params?: { search?: string }) => {
  const { data } = await api.get<StudentCategory[]>('/students/categories', { params: cleanParams(params) });
  return data;
};

export const createStudentCategory = async (payload: { name: string }) => {
  const { data } = await api.post<StudentCategory>('/students/categories', payload);
  return data;
};

export const updateStudentCategory = async (id: string, payload: { name: string }) => {
  const { data } = await api.patch<StudentCategory>(`/students/categories/${id}`, payload);
  return data;
};

export const deleteStudentCategory = async (id: string) => {
  await api.delete(`/students/categories/${id}`);
};

export const loadStudentAttendance = async (params: {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  date: string;
}) => {
  const { data } = await api.get<AttendanceLoadResponse>('/students/attendance', { params });
  return data;
};

export const saveStudentAttendance = async (payload: {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  date: string;
  markHoliday?: boolean;
  holidayReason?: string | null;
  records: Array<{ studentId: string; status: StudentAttendanceStatus; note?: string | null }>;
}) => {
  const { data } = await api.post('/students/attendance', payload);
  return data;
};

export const getStudentAttendanceReport = async (params: {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  month: number;
  year: number;
}) => {
  const { data } = await api.get<AttendanceReportResponse>('/students/attendance/report', { params });
  return data;
};

export const previewStudentPromotion = async (params: {
  academicSessionId: string;
  classId: string;
  sectionId?: string;
}) => {
  const { data } = await api.get<PromotionPreview>('/students/promotions/preview', { params });
  return data;
};

export const promoteStudents = async (payload: {
  fromAcademicSessionId: string;
  toAcademicSessionId: string;
  fromClassId: string;
  toClassId: string;
  fromSectionId: string;
  toSectionId: string;
  note?: string | null;
  results: Array<{ studentId: string; result: StudentPromotionResult }>;
}) => {
  const { data } = await api.post('/students/promotions', payload);
  return data;
};

export const listDisabledStudents = async (params?: { classId?: string; sectionId?: string; search?: string }) => {
  const { data } = await api.get<Student[]>('/students/disabled', { params: cleanParams(params) });
  return data;
};

export const disableStudent = async (id: string, payload?: { reason?: string }) => {
  const { data } = await api.post<Student>(`/students/students/${id}/disable`, payload ?? {});
  return data;
};

export const restoreDisabledStudent = async (id: string, payload?: { reason?: string }) => {
  const { data } = await api.post<Student>(`/students/disabled/${id}/restore`, payload ?? {});
  return data;
};

export const deleteDisabledStudent = async (id: string) => {
  await api.delete(`/students/disabled/${id}`);
};
