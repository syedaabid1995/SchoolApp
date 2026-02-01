import { api } from '../lib/api';

export type TeacherProfile = {
  id: string;
  schoolId: string;
  userId: string;
  employeeNo: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  address?: string | null;
  bankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: { email: string; status: string };
  classAssignments: Array<{ id: string; class: { id: string; name: string } }>;
  subjectAssignments: Array<{ id: string; subject: { id: string; name: string } }>;
};

export type TeacherListResponse = {
  items: TeacherProfile[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export const listTeachers = async (params?: { page?: number; limit?: number; query?: string; isActive?: boolean; schoolId?: string }) => {
  const { data } = await api.get<TeacherListResponse>('/teachers', { params });
  return data;
};

export const getTeacher = async (id: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<TeacherProfile>(`/teachers/${id}`, { params });
  return data;
};

export const createTeacher = async (payload: {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  phone?: string | null;
  address?: string | null;
  bankDetails?: {
    accountHolderName?: string | null;
    accountNumber?: string | null;
    ifscCode?: string | null;
    accountType?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    panNumber?: string | null;
  };
  schoolId?: string;
}) => {
  const { data } = await api.post('/teachers', payload);
  return data;
};

export const updateTeacher = async (
  id: string,
  payload: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    employeeNo: string | null;
    phone: string | null;
    address: string | null;
    isActive: boolean;
    schoolId?: string;
    bankDetails?: {
      accountHolderName?: string | null;
      accountNumber?: string | null;
      ifscCode?: string | null;
      accountType?: string | null;
      bankName?: string | null;
      branchName?: string | null;
      panNumber?: string | null;
    };
  }>,
) => {
  const { data } = await api.patch(`/teachers/${id}`, payload);
  return data;
};

export const deleteTeacher = async (id: string) => {
  const { data } = await api.delete(`/teachers/${id}`);
  return data;
};

export const setTeacherStatus = async (teacherId: string, isActive: boolean) => {
  const { data } = await api.patch(`/teacher-assignments/teachers/${teacherId}/status`, { isActive });
  return data;
};

export const assignClass = async (payload: { teacherId: string; classId: string }) => {
  const { data } = await api.post('/teacher-assignments/classes/assign', payload);
  return data;
};

export const unassignClass = async (payload: { teacherId: string; classId: string }) => {
  const { data } = await api.post('/teacher-assignments/classes/unassign', payload);
  return data;
};

export const assignSubject = async (payload: { teacherId: string; subjectId: string }) => {
  const { data } = await api.post('/teacher-assignments/subjects/assign', payload);
  return data;
};

export const unassignSubject = async (payload: { teacherId: string; subjectId: string }) => {
  const { data } = await api.post('/teacher-assignments/subjects/unassign', payload);
  return data;
};
