import { api } from '../lib/api';

export type AttendanceSubstitution = {
  id: string;
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  date: string;
  originalTeacherId: string | null;
  substituteTeacherId: string;
  reason: string | null;
  canceledAt: string | null;
  canceledById: string | null;
  createdAt: string;
  updatedAt: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  originalTeacher?: { id: string; firstName: string; lastName: string } | null;
  substituteTeacher?: { id: string; firstName: string; lastName: string };
  createdBy?: { id: string; email: string };
  canceledBy?: { id: string; email: string } | null;
};

export const listAttendanceSubstitutions = async (params?: {
  schoolId?: string;
  classId?: string;
  sectionId?: string;
  substituteTeacherId?: string;
  originalTeacherId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
}) => {
  const { data } = await api.get<AttendanceSubstitution[]>('/attendance/substitutions', { params });
  return data;
};

export const createAttendanceSubstitution = async (payload: {
  schoolId?: string;
  classId: string;
  sectionId?: string;
  date: string;
  originalTeacherId?: string;
  substituteTeacherId: string;
  reason?: string;
}) => {
  const { data } = await api.post<AttendanceSubstitution>('/attendance/substitutions', payload);
  return data;
};

export const cancelAttendanceSubstitution = async (id: string, payload?: { schoolId?: string; reason?: string }) => {
  const { data } = await api.patch<AttendanceSubstitution>(`/attendance/substitutions/${id}/cancel`, payload ?? {});
  return data;
};
