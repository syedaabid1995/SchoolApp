import { api } from '../lib/api';
import type { Staff, StaffRole } from './staff.service';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type StudentLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type LeaveType = {
  id: string;
  schoolId: string;
  name: string;
  totalDays: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LeaveDefine = {
  id: string;
  schoolId: string;
  roleName: StaffRole | string;
  leaveTypeId: string;
  days: number;
  leaveType?: LeaveType;
  createdAt?: string;
  updatedAt?: string;
};

export type LeaveAttachment = {
  id: string;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

export type LeaveBalance = {
  leaveType: LeaveType;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  extraTakenDays: number;
};

export type LeaveApplication = {
  id: string;
  schoolId: string;
  staffId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  staff?: Staff;
  appliedAt: string;
  fromDate: string;
  toDate: string;
  durationDays: number;
  duration?: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: { id: string; email: string } | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  attachments?: LeaveAttachment[];
  histories?: Array<{
    id: string;
    fromStatus?: LeaveStatus | null;
    toStatus: LeaveStatus;
    note?: string | null;
    createdAt: string;
    changedBy?: { id: string; email: string };
  }>;
  balances?: LeaveBalance[];
  createdAt?: string;
  updatedAt?: string;
};

export type StudentLeaveRequest = {
  id: string;
  schoolId: string;
  studentId: string;
  childId: string;
  studentName: string;
  childName: string;
  admissionNo?: string | null;
  rollNo?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  className?: string | null;
  sectionName?: string | null;
  classLabel?: string | null;
  parentId: string;
  parentName: string;
  parentPhone?: string | null;
  parentEmail?: string | null;
  parentUser?: { id: string; email: string; status: string } | null;
  leaveType: string;
  fromDate: string;
  toDate: string;
  requestedDays: number;
  workingDays: number;
  skippedDays: Array<{ date: string; reason: string; type: string }>;
  reason: string;
  status: StudentLeaveStatus;
  reviewedBy?: { id: string; email: string } | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const listLeaveTypes = async () => {
  const { data } = await api.get<LeaveType[]>('/leave/types');
  return data;
};

export const createLeaveType = async (payload: { name: string; totalDays: number }) => {
  const { data } = await api.post<LeaveType>('/leave/types', payload);
  return data;
};

export const updateLeaveType = async (id: string, payload: Partial<{ name: string; totalDays: number }>) => {
  const { data } = await api.patch<LeaveType>(`/leave/types/${id}`, payload);
  return data;
};

export const deleteLeaveType = async (id: string) => {
  await api.delete(`/leave/types/${id}`);
};

export const listLeaveDefines = async () => {
  const { data } = await api.get<LeaveDefine[]>('/leave/defines');
  return data;
};

export const createLeaveDefine = async (payload: { roleName: string; leaveTypeId: string; days: number }) => {
  const { data } = await api.post<LeaveDefine>('/leave/defines', payload);
  return data;
};

export const updateLeaveDefine = async (id: string, payload: Partial<{ roleName: string; leaveTypeId: string; days: number }>) => {
  const { data } = await api.patch<LeaveDefine>(`/leave/defines/${id}`, payload);
  return data;
};

export const deleteLeaveDefine = async (id: string) => {
  await api.delete(`/leave/defines/${id}`);
};

export const getMyLeaveBalances = async () => {
  const { data } = await api.get<{ staff: Staff; items: LeaveBalance[] }>('/leave/balances/me');
  return data;
};

export const listLeaveApplications = async (params?: { status?: LeaveStatus | ''; roleName?: string; staffId?: string; search?: string; mine?: boolean }) => {
  const { data } = await api.get<LeaveApplication[]>('/leave/applications', { params });
  return data;
};

export const getLeaveApplication = async (id: string) => {
  const { data } = await api.get<LeaveApplication>(`/leave/applications/${id}`);
  return data;
};

export const createLeaveApplication = async (payload: {
  leaveTypeId: string;
  appliedAt?: string;
  fromDate: string;
  toDate: string;
  reason: string;
  file?: File | null;
}) => {
  const form = new FormData();
  form.append('leaveTypeId', payload.leaveTypeId);
  if (payload.appliedAt) form.append('appliedAt', payload.appliedAt);
  form.append('fromDate', payload.fromDate);
  form.append('toDate', payload.toDate);
  form.append('reason', payload.reason);
  if (payload.file) form.append('file', payload.file);
  const { data } = await api.post<LeaveApplication>('/leave/applications', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateLeaveApplication = async (
  id: string,
  payload: Partial<{ leaveTypeId: string; appliedAt: string; fromDate: string; toDate: string; reason: string; file: File | null }>,
) => {
  const form = new FormData();
  if (payload.leaveTypeId) form.append('leaveTypeId', payload.leaveTypeId);
  if (payload.appliedAt) form.append('appliedAt', payload.appliedAt);
  if (payload.fromDate) form.append('fromDate', payload.fromDate);
  if (payload.toDate) form.append('toDate', payload.toDate);
  if (payload.reason) form.append('reason', payload.reason);
  if (payload.file) form.append('file', payload.file);
  const { data } = await api.patch<LeaveApplication>(`/leave/applications/${id}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteLeaveApplication = async (id: string) => {
  await api.delete(`/leave/applications/${id}`);
};

export const updateLeaveStatus = async (id: string, payload: { status: LeaveStatus; note?: string | null }) => {
  const { data } = await api.patch<LeaveApplication>(`/leave/applications/${id}/status`, payload);
  return data;
};

export const listStudentLeaveRequests = async (params?: {
  status?: StudentLeaveStatus | '';
  classId?: string;
  sectionId?: string;
  search?: string;
}) => {
  const { data } = await api.get<StudentLeaveRequest[]>('/leave/student-requests', { params });
  return data;
};

export const getStudentLeaveRequest = async (id: string) => {
  const { data } = await api.get<StudentLeaveRequest>(`/leave/student-requests/${id}`);
  return data;
};

export const updateStudentLeaveStatus = async (id: string, payload: { status: StudentLeaveStatus; note?: string | null }) => {
  const { data } = await api.patch<StudentLeaveRequest>(`/leave/student-requests/${id}/status`, payload);
  return data;
};

export const deleteStudentLeaveRequest = async (id: string) => {
  await api.delete(`/leave/student-requests/${id}`);
};
