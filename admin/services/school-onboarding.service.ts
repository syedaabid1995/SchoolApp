import { api } from '../lib/api';

export type SchoolOnboardingStatus = 'DRAFT' | 'SETUP_IN_PROGRESS' | 'READY_FOR_REVIEW' | 'ACTIVE' | 'BLOCKED';
export type ChecklistStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'BLOCKED';

export type SchoolOnboardingChecklistItem = {
  id: string;
  schoolId: string;
  key: string;
  label: string;
  status: ChecklistStatus;
  required: boolean;
  completedAt?: string | null;
  completedById?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SchoolOnboardingResponse = {
  school: {
    id: string;
    name: string;
    code: string;
    onboardingStatus: SchoolOnboardingStatus;
  };
  checklist: SchoolOnboardingChecklistItem[];
  summary: {
    total: number;
    completed: number;
    pending: number;
    requiredIncomplete: number;
    percent: number;
  };
};

export const getSchoolOnboarding = async (schoolId: string) => {
  const { data } = await api.get<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding`);
  return data;
};

export const updateSchoolOnboardingChecklist = async (
  schoolId: string,
  key: string,
  payload: { status: ChecklistStatus; note?: string | null },
) => {
  const { data } = await api.put<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding/checklist/${key}`, payload);
  return data;
};

export const recalculateSchoolOnboarding = async (schoolId: string) => {
  const { data } = await api.post<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding/recalculate`, {});
  return data;
};

export const requestSchoolOnboardingReview = async (schoolId: string) => {
  const { data } = await api.post<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding/request-review`, {});
  return data;
};

export const goLiveSchoolOnboarding = async (schoolId: string, payload?: { reason?: string | null; override?: boolean }) => {
  const { data } = await api.post<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding/go-live`, payload ?? {});
  return data;
};

export const blockSchoolOnboarding = async (schoolId: string, reason: string) => {
  const { data } = await api.post<SchoolOnboardingResponse>(`/schools/${schoolId}/onboarding/block`, { reason });
  return data;
};
