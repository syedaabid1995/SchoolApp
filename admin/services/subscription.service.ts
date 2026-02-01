import { api } from '../lib/api';

export type SubscriptionPlan = {
  id: string;
  name: string;
  status: string;
  priceCents: number;
  features: string[];
  studentLimit: number;
  teacherLimit: number;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionMetrics = {
  plan: {
    name: string;
    status: string;
    startsAt: string;
    endsAt: string | null;
    studentLimit: number;
    teacherLimit: number;
  } | null;
  usage: {
    students: number;
    teachers: number;
  };
  overLimit: {
    students: boolean;
    teachers: boolean;
  };
};

export type SubscriptionInfo = {
  id: string;
  schoolId: string;
  planName: string;
  planId: string | null;
  status: string;
  startsAt: string;
  endsAt: string | null;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  discountPercent: number;
  graceDays: number;
  paidAt: string | null;
  nextDueAt: string | null;
  studentLimit: number;
  teacherLimit: number;
  plan?: SubscriptionPlan | null;
};

export const getSubscription = async (schoolId?: string) => {
  const { data } = await api.get<SubscriptionInfo>('/subscriptions', {
    params: schoolId ? { schoolId } : undefined,
  });
  return data;
};

export const listSubscriptionPlans = async () => {
  const { data } = await api.get<SubscriptionPlan[]>('/admin/subscription-plans');
  return data;
};

export const listActivePlans = async () => {
  const { data } = await api.get<SubscriptionPlan[]>('/subscriptions/plans');
  return data;
};

export const createSubscriptionPlan = async (payload: {
  name: string;
  status: string;
  priceCents: number;
  features: string[];
  studentLimit: number;
  teacherLimit: number;
}) => {
  const { data } = await api.post<SubscriptionPlan>('/admin/subscription-plans', payload);
  return data;
};

export const updateSubscriptionPlan = async (
  id: string,
  payload: Partial<{
    name: string;
    status: string;
    priceCents: number;
    features: string[];
    studentLimit: number;
    teacherLimit: number;
  }>,
) => {
  const { data } = await api.patch<SubscriptionPlan>(`/admin/subscription-plans/${id}`, payload);
  return data;
};

export const deleteSubscriptionPlan = async (id: string) => {
  const { data } = await api.delete<SubscriptionPlan>(`/admin/subscription-plans/${id}`);
  return data;
};

export const listPlanSchools = async (planId: string) => {
  const { data } = await api.get<{ items: { id: string; name: string; code: string; status: string; subscriptionPlan: string }[] }>(
    `/admin/subscription-plans/${planId}/schools`,
  );
  return data;
};

export const getSubscriptionMetrics = async (schoolId: string) => {
  const { data } = await api.get<SubscriptionMetrics>(`/admin/subscription-metrics/${schoolId}`);
  return data;
};

export const upsertSubscription = async (payload: {
  schoolId: string;
  planId?: string;
  planName?: string;
  status: string;
  startsAt: string | Date;
  endsAt?: string | Date | null;
  studentLimit?: number;
  teacherLimit?: number;
}) => {
  const { data } = await api.post('/subscriptions', payload);
  return data;
};
