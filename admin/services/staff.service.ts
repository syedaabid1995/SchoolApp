import { api } from '../lib/api';
import { env } from '../lib/env';
import { resolveUploadUrl as resolveUploadUrlWithBase, type SignedUploadAssetRef } from './upload-url';

export type StaffRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF';
export type StaffAttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HOLIDAY' | 'HALF_DAY' | 'LEAVE';
export type PayrollStatus = 'GENERATED' | 'PAID' | 'CANCELLED' | 'NOT_GENERATED';

export type Department = { id: string; name: string; schoolId: string };
export type Designation = { id: string; name: string; schoolId: string };

export type Staff = {
  id: string;
  schoolId: string;
  userId: string;
  staffNo?: string | null;
  employeeNo?: string | null;
  firstName: string;
  lastName: string;
  fullName?: string;
  role?: StaffRole | string;
  roleName?: StaffRole | string;
  phone?: string | null;
  emergencyMobile?: string | null;
  email?: string;
  fatherName?: string | null;
  motherName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  dateOfJoining?: string | null;
  photoUrl?: string | null;
  drivingLicense?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  qualifications?: string | null;
  experience?: string | null;
  maritalStatus?: string | null;
  department?: Department | null;
  designation?: Designation | null;
  user?: { id: string; email: string; status: string };
  bankInfo?: Record<string, string | null> | null;
  bankDetails?: Record<string, string | null> | null;
  payrollInfo?: {
    epfNo?: string | null;
    basicSalary?: number | string | null;
    contractType?: string | null;
    paymentMode?: string | null;
  } | null;
  leaveBalances?: Array<{
    id?: string;
    leaveTypeId: string;
    leaveType?: { id: string; name: string; totalDays: number };
    totalDays: number;
    usedDays: number;
    remainingDays?: number;
    extraTakenDays: number;
  }>;
  leaveApplications?: Array<{
    id: string;
    leaveTypeId: string;
    leaveType?: { id: string; name: string; totalDays: number };
    fromDate: string;
    toDate: string;
    durationDays: number;
    reason: string;
    status: string;
    appliedAt: string;
  }>;
  socialLinks?: Array<{ id?: string; platform: string; url: string }>;
  documents?: StaffDocument[];
  timelines?: StaffTimeline[];
  payrolls?: Payroll[];
};

export type StaffListResponse = { items: Staff[]; page: number; limit: number; total: number; pages: number };

export type StaffDocument = {
  id: string;
  title: string;
  fileUrl: string;
  fileName?: string | null;
  fileType?: string | null;
  createdAt: string;
};

export type StaffTimeline = {
  id: string;
  title: string;
  description?: string | null;
  timelineAt: string;
  createdAt: string;
};

export type StaffPayload = {
  email: string;
  password?: string;
  roleName: StaffRole;
  employeeNo?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  firstName: string;
  lastName: string;
  fatherName?: string | null;
  motherName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  dateOfJoining?: string | null;
  phone?: string | null;
  emergencyMobile?: string | null;
  photoUrl?: string | null;
  drivingLicense?: string | null;
  currentAddress?: string | null;
  permanentAddress?: string | null;
  qualifications?: string | null;
  experience?: string | null;
  maritalStatus?: string | null;
  bankDetails?: Record<string, string | null>;
  payrollInfo?: { epfNo?: string | null; basicSalary?: number | null; contractType?: string | null; paymentMode?: string | null };
  leaveBalances?: Array<{ leaveTypeId: string; totalDays: number }>;
  socialLinks?: Array<{ platform: string; url: string }>;
};

export type AttendanceStaffRow = Staff & { status: StaffAttendanceStatus; note?: string | null; attendanceId?: string | null };
export type StaffAttendanceReportRow = {
  staff: Staff;
  present: number;
  late: number;
  absent: number;
  holiday: number;
  halfDay: number;
  leave: number;
  percentage: number;
  daily: Array<{ day: number; status: string; note?: string | null }>;
};

export type Payroll = {
  id: string;
  staffId: string;
  month: number;
  year: number;
  payslipNo: string;
  basicSalary: number | string;
  earnings: number | string;
  deductions: number | string;
  grossSalary: number | string;
  tax: number | string;
  netSalary: number | string;
  paymentMode?: string | null;
  status: PayrollStatus;
  generatedAt: string;
  paidAt?: string | null;
  earningRows?: Array<{ id: string; title: string; amount: number | string }>;
  deductionRows?: Array<{ id: string; title: string; amount: number | string }>;
  payments?: Array<{ id: string; amount: number | string; method?: string | null; reference?: string | null; paidAt: string }>;
};

export const listDepartments = async () => {
  const { data } = await api.get<Department[]>('/staff/departments');
  return data;
};

export const createDepartment = async (payload: { name: string }) => {
  const { data } = await api.post<Department>('/staff/departments', payload);
  return data;
};

export const listDesignations = async () => {
  const { data } = await api.get<Designation[]>('/staff/designations');
  return data;
};

export const createDesignation = async (payload: { name: string }) => {
  const { data } = await api.post<Designation>('/staff/designations', payload);
  return data;
};

export const seedStaffDefaults = async () => {
  const { data } = await api.post<{ departments: Department[]; designations: Designation[]; leaveTypes: Array<{ id: string; name: string; totalDays: number }> }>('/staff/defaults');
  return data;
};

export const listStaff = async (params?: { page?: number; limit?: number; role?: string; staffId?: string; search?: string }) => {
  const { data } = await api.get<StaffListResponse>('/staff', { params });
  return data;
};

export const createStaff = async (payload: StaffPayload) => {
  const { data } = await api.post<{ staff: Staff; tempPassword?: string | null }>('/staff', payload);
  return data;
};

export const getStaff = async (id: string) => {
  const { data } = await api.get<Staff>(`/staff/${id}`);
  return data;
};

export const resolveStaffUploadUrl = (value?: string | null, asset?: SignedUploadAssetRef | null) =>
  resolveUploadUrlWithBase(value, asset, env.apiBaseUrl);

export const updateStaff = async (id: string, payload: Partial<StaffPayload>) => {
  const { data } = await api.patch<Staff>(`/staff/${id}`, payload);
  return data;
};

export const deleteStaff = async (id: string) => {
  const { data } = await api.delete(`/staff/${id}`);
  return data;
};

export const uploadStaffPhoto = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ url: string; filename: string }>('/uploads/photos?category=staff', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const uploadStaffDocument = async (staffId: string, title: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  form.append('title', title);
  const { data } = await api.post<StaffDocument>(`/staff/${staffId}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteStaffDocument = async (staffId: string, documentId: string) => {
  await api.delete(`/staff/${staffId}/documents/${documentId}`);
};

export const addStaffTimeline = async (staffId: string, payload: { title: string; description?: string; date: string; time?: string }) => {
  const { data } = await api.post<StaffTimeline>(`/staff/${staffId}/timeline`, payload);
  return data;
};

export const deleteStaffTimeline = async (staffId: string, timelineId: string) => {
  await api.delete(`/staff/${staffId}/timeline/${timelineId}`);
};

export const loadStaffAttendance = async (params: { role?: string; staffId?: string; date: string }) => {
  const { data } = await api.get<{ date: string; holiday?: unknown; staff: AttendanceStaffRow[] }>('/staff/attendance', { params });
  return data;
};

export const saveStaffAttendance = async (payload: { role?: string | null; date: string; markHoliday?: boolean; holidayReason?: string | null; records: Array<{ staffId: string; status: StaffAttendanceStatus; note?: string | null }> }) => {
  const { data } = await api.post('/staff/attendance', payload);
  return data;
};

export const getStaffAttendanceReport = async (params: { role?: string; staffId?: string; month: number; year: number }) => {
  const { data } = await api.get<{ daysInMonth: number; rows: StaffAttendanceReportRow[] }>('/staff/attendance/report', { params });
  return data;
};

export const listPayroll = async (params: { role?: string; staffId?: string; month: number; year: number }) => {
  const { data } = await api.get<Array<{ staff: Staff; payroll?: Payroll | null; status: PayrollStatus }>>('/staff/payroll', { params });
  return data;
};

export const generatePayroll = async (payload: {
  staffId: string;
  month: number;
  year: number;
  basicSalary: number;
  earnings: Array<{ title: string; amount: number }>;
  deductions: Array<{ title: string; amount: number }>;
  tax: number;
  paymentMode?: string | null;
}) => {
  const { data } = await api.post<Payroll>('/staff/payroll/generate', payload);
  return data;
};

export const payPayroll = async (id: string, payload: { method?: string | null; reference?: string | null; paidAt?: string }) => {
  const { data } = await api.post(`/staff/payroll/${id}/pay`, payload);
  return data;
};

export const getPayrollReport = async (params: { role?: string; staffId?: string; month: number; year: number }) => {
  const { data } = await api.get<{ items: Array<Payroll & { staff: Staff }>; totals: Record<string, number> }>('/staff/payroll/report', { params });
  return data;
};
