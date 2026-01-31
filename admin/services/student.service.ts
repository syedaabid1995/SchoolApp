import { api } from '../lib/api';

export type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  status: string;
  classId: string | null;
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listStudents = async (params?: { status?: string; schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<Student[]>('/students/students', { params: sanitized });
  return data;
};

export const createStudent = async (payload: {
  admissionNo: string;
  firstName: string;
  lastName: string;
  dob?: string;
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
    firstName: string;
    lastName: string;
    dob: string | null;
    classId: string | null;
    sectionId: string | null;
  }>,
) => {
  const { data } = await api.patch(`/students/students/${id}`, payload);
  return data;
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
