import { api } from '../lib/api';

export type TeacherReadinessStatus = 'PENDING' | 'READY' | 'BLOCKED';

export type TeacherOnboarding = {
  id: string;
  schoolId: string;
  teacherId: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo?: string | null;
    phone?: string | null;
    email: string;
    isActive: boolean;
  };
  accountCreated: boolean;
  temporaryPasswordShared: boolean;
  manualShareConfirmed: boolean;
  firstLoginCompleted: boolean;
  passwordChanged: boolean;
  profileCompleted: boolean;
  active: boolean;
  classAssigned: boolean;
  subjectAssigned: boolean;
  timetableAssigned: boolean;
  attendanceEnabled: boolean;
  readinessStatus: TeacherReadinessStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherOnboardingList = { items: TeacherOnboarding[]; total: number };

export const listTeacherOnboarding = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<TeacherOnboardingList>('/teachers/onboarding', { params });
  return data;
};

export const getTeacherOnboarding = async (teacherId: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<TeacherOnboarding>(`/teachers/${teacherId}/onboarding`, { params });
  return data;
};

export const recalculateTeacherOnboarding = async (teacherId: string, payload?: { schoolId?: string }) => {
  const { data } = await api.post<TeacherOnboarding>(`/teachers/${teacherId}/onboarding/recalculate`, payload ?? {});
  return data;
};

export const updateTeacherOnboarding = async (
  teacherId: string,
  payload: { schoolId?: string; readinessStatus?: TeacherReadinessStatus; note?: string | null },
) => {
  const { data } = await api.patch<TeacherOnboarding>(`/teachers/${teacherId}/onboarding`, payload);
  return data;
};

export const resendTeacherCredentials = async (teacherId: string, payload?: { schoolId?: string }) => {
  const { data } = await api.post<{ onboarding: TeacherOnboarding; delivery: unknown }>(`/teachers/${teacherId}/credentials/resend`, payload ?? {});
  return data;
};

export const confirmTeacherCredentialManualShare = async (
  teacherId: string,
  payload: { schoolId?: string; note: string },
) => {
  const { data } = await api.post<TeacherOnboarding>(`/teachers/${teacherId}/credentials/manual-share-confirm`, payload);
  return data;
};
