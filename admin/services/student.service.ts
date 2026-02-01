import { api } from '../lib/api';
import { env } from '../lib/env';

export type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  dob: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  photoUrl?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  emergencyContact?: string | null;
  medicalConditions?: string | null;
  allergies?: string | null;
  doctorContact?: string | null;
  docBirthCert?: string | null;
  docTransferCert?: string | null;
  docAadhaar?: string | null;
  docReportCard?: string | null;
  status: string;
  classId: string | null;
  sectionId: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
  photos?: Array<{ id: string; url: string; createdAt: string }>;
  parentLinks?: Array<{
    parentId: string;
    parent: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
  }>;
  createdAt: string;
  updatedAt: string;
};

export type TransferTarget = { id: string; name: string; code: string };

export type TransferRequest = {
  id: string;
  studentId: string;
  fromSchoolId: string;
  toSchoolId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; admissionNo: string };
  fromSchool: { id: string; name: string; code: string };
};

export const listStudents = async (params?: { status?: string; schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<Student[]>('/students/students', { params: sanitized });
  return data;
};

export const getStudent = async (id: string) => {
  const { data } = await api.get<Student>(`/students/students/${id}`);
  return data;
};

export const createStudent = async (payload: {
  admissionNo: string;
  fullName: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  photoUrl?: string;
  fatherName?: string;
  motherName?: string;
  guardianName?: string;
  guardianRelationship?: string;
  parentPhone?: string;
  parentEmail?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  doctorContact?: string;
  docBirthCert?: string;
  docTransferCert?: string;
  docAadhaar?: string;
  docReportCard?: string;
  classId?: string | null;
  sectionId?: string | null;
  schoolId?: string;
}) => {
  const { data } = await api.post('/students/students', payload);
  return data;
};

export const updateStudent = async (
  id: string,
  payload: Partial<{
    admissionNo: string;
    fullName: string;
    dob: string | null;
    gender: string | null;
    bloodGroup: string | null;
    photoUrl: string | null;
    fatherName: string | null;
    motherName: string | null;
    guardianName: string | null;
    guardianRelationship: string | null;
    parentPhone: string | null;
    parentEmail: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    emergencyContact: string | null;
    medicalConditions: string | null;
    allergies: string | null;
    doctorContact: string | null;
    docBirthCert: string | null;
    docTransferCert: string | null;
    docAadhaar: string | null;
    docReportCard: string | null;
    classId: string | null;
    sectionId: string | null;
  }>,
) => {
  const { data } = await api.patch(`/students/students/${id}`, payload);
  return data;
};

export const deleteStudent = async (id: string) => {
  const { data } = await api.delete(`/students/students/${id}`);
  return data;
};

export const uploadStudentPhoto = async (file: File, params?: { schoolId?: string; studentId?: string; category?: 'students' | 'teachers' }) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/uploads/photos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: {
      schoolId: params?.schoolId,
      category: params?.category ?? 'students',
      studentId: params?.studentId,
    },
  });
  return data as { url: string; filename: string };
};

export const uploadStudentDocument = async (file: File, studentId: string, params?: { schoolId?: string }) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/uploads/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    params: {
      schoolId: params?.schoolId,
      studentId,
      category: 'documents',
    },
  });
  return data as { url: string; filename: string };
};

export const resolveUploadUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const base = env.apiBaseUrl.replace(/\/api\/v1\/?$/, '');
  const url = value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
  return url;
};

export const addStudentPhoto = async (studentId: string, url: string) => {
  const { data } = await api.post(`/students/students/${studentId}/photos`, { url });
  return data as { id: string; url: string; createdAt: string };
};

export const deleteStudentPhoto = async (studentId: string, photoId: string) => {
  await api.delete(`/students/students/${studentId}/photos/${photoId}`);
};

export const linkParent = async (studentId: string, parentId: string) => {
  const { data } = await api.post(`/students/students/${studentId}/parents`, { parentId });
  return data;
};

export const changeStudentStatus = async (studentId: string, status: 'TRANSFERRED' | 'EXITED', reason?: string) => {
  const { data } = await api.post(`/students/students/${studentId}/status`, { status, reason });
  return data;
};

export const listParents = async (params?: { schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/students/parents', { params: sanitized });
  return data;
};

export const lookupParentByPhone = async (phone: string) => {
  const { data } = await api.get('/students/parents/lookup', { params: { phone } });
  return data as { found: boolean; userId?: string; displayName?: string; phone?: string };
};

export const getParent = async (id: string) => {
  const { data } = await api.get(`/students/parents/${id}`);
  return data;
};

export const createParent = async (payload: {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  createLogin?: boolean;
  sendVia?: 'SMS' | 'EMAIL' | 'BOTH';
  schoolId?: string;
}) => {
  const { data } = await api.post('/students/parents', payload);
  return data;
};

export const listTransferTargets = async (params?: { schoolId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<TransferTarget[]>('/students/transfer-targets', { params: sanitized });
  return data;
};

export const createTransferRequest = async (studentId: string, payload: { toSchoolId: string; reason?: string; schoolId?: string }) => {
  const { data } = await api.post(`/students/students/${studentId}/transfer-requests`, payload);
  return data;
};

export const listIncomingTransferRequests = async (params?: { schoolId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<TransferRequest[]>('/students/transfer-requests', { params: sanitized });
  return data;
};

export const acceptTransferRequest = async (requestId: string, payload?: { reason?: string; schoolId?: string }) => {
  const { data } = await api.post(`/students/transfer-requests/${requestId}/accept`, payload ?? {});
  return data;
};

export const rejectTransferRequest = async (requestId: string, payload?: { reason?: string; schoolId?: string }) => {
  const { data } = await api.post(`/students/transfer-requests/${requestId}/reject`, payload ?? {});
  return data;
};
