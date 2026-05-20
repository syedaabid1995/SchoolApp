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

export type PlanPermissionItem = {
  code: string;
  label: string;
  path: string;
  group: string;
  enabled: boolean;
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

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'OVERDUE'
  | 'PENDING'
  | 'PENDING_CANCEL'
  | string;

export type BillingCycle = 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME' | string;

export type SchoolSubscriptionListItem = {
  schoolId: string;
  schoolName: string;
  schoolCode?: string;
  schoolStatus?: string;
  subscriptionId?: string | null;
  planId?: string | null;
  planName?: string | null;
  status: SubscriptionStatus;
  billingCycle?: BillingCycle;
  trialEndsAt?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  price?: number | null;
  currency?: string;
  studentLimit?: number | null;
  teacherLimit?: number | null;
  storageLimitMb?: number | null;
  usage?: {
    students?: number;
    teachers?: number;
    storageMb?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type SchoolSubscriptionListResponse = {
  items: SchoolSubscriptionListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SubscriptionSummary = {
  totalSchools: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  pausedSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  overdueSubscriptions: number;
  estimatedMonthlyRevenue: number;
  pendingManualPayments: number;
  currency: string;
};

export type SubscriptionHistoryItem = {
  id: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  actorName?: string | null;
  createdAt: string;
};

export type SubscriptionUsage = {
  students: { used: number; limit: number; percentage: number };
  teachers: { used: number; limit: number; percentage: number };
  storage: { usedMb: number; limitMb: number | null; percentage: number | null };
  modules: Array<{ key: string; enabled: boolean }>;
};

export type SchoolSubscriptionDetail = {
  school: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  subscription: {
    id: string;
    status: string;
    plan: {
      id: string;
      name: string;
      price: number;
      currency: string;
      billingCycle: string;
      features: string[];
    } | null;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    pausedAt?: string | null;
    cancelledAt?: string | null;
    cancelAt?: string | null;
    limits: {
      students: number;
      teachers: number;
      storageMb?: number | null;
    };
    usage: {
      students: number;
      teachers: number;
      storageMb: number;
    };
  } | null;
  history: SubscriptionHistoryItem[];
  invoices: unknown[];
  manualPayments: unknown[];
  billingMessage?: string;
};

export type SchoolSubscriptionParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  planId?: string;
  schoolId?: string;
  billingCycle?: string;
  trial?: boolean | '';
  overdue?: boolean | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type ApiEnvelope<T> = T | { success: boolean; data: T };

const unwrapData = <T>(payload: ApiEnvelope<T>): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

const cleanParams = (params?: SchoolSubscriptionParams) => {
  if (!params) return undefined;
  return Object.entries(params).reduce<Record<string, string | number | boolean>>((result, [key, value]) => {
    if (value === undefined || value === null || value === '') return result;
    result[key] = value;
    return result;
  }, {});
};

export const getSubscription = async (schoolId?: string) => {
  const { data } = await api.get<SubscriptionInfo>('/subscriptions', {
    params: schoolId ? { schoolId } : undefined,
  });
  return data;
};

export const getSubscriptionSummary = async () => {
  const { data } = await api.get<ApiEnvelope<SubscriptionSummary>>('/admin/subscriptions/summary');
  return unwrapData(data);
};

export const getSchoolSubscriptions = async (params?: SchoolSubscriptionParams) => {
  const { data } = await api.get<ApiEnvelope<SchoolSubscriptionListResponse>>('/admin/subscriptions', {
    params: cleanParams(params),
  });
  return unwrapData(data);
};

export const getSchoolSubscriptionDetail = async (schoolId: string) => {
  const { data } = await api.get<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}`);
  return unwrapData(data);
};

export const assignSchoolPlan = async (
  schoolId: string,
  payload: { planId: string; billingCycle?: string; startDate?: string; trialDays?: number; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(
    `/admin/subscriptions/${schoolId}/assign-plan`,
    payload,
  );
  return unwrapData(data);
};

export const startTrial = async (
  schoolId: string,
  payload: { planId: string; trialDays: number; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(
    `/admin/subscriptions/${schoolId}/start-trial`,
    payload,
  );
  return unwrapData(data);
};

export const extendTrial = async (
  schoolId: string,
  payload: { extraDays: number; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(
    `/admin/subscriptions/${schoolId}/extend-trial`,
    payload,
  );
  return unwrapData(data);
};

export const upgradeSubscription = async (
  schoolId: string,
  payload: { newPlanId: string; effectiveDate?: string; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(
    `/admin/subscriptions/${schoolId}/upgrade`,
    payload,
  );
  return unwrapData(data);
};

export const downgradeSubscription = async (
  schoolId: string,
  payload: { newPlanId: string; effectiveDate?: string; force?: boolean; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(
    `/admin/subscriptions/${schoolId}/downgrade`,
    payload,
  );
  return unwrapData(data);
};

export const pauseSubscription = async (schoolId: string, payload: { reason?: string | null }) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}/pause`, payload);
  return unwrapData(data);
};

export const resumeSubscription = async (schoolId: string, payload: { reason?: string | null }) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}/resume`, payload);
  return unwrapData(data);
};

export const cancelSubscription = async (
  schoolId: string,
  payload: { cancelAt?: string; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}/cancel`, payload);
  return unwrapData(data);
};

export const renewSubscription = async (
  schoolId: string,
  payload: { periodMonths: number; reason?: string | null },
) => {
  const { data } = await api.post<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}/renew`, payload);
  return unwrapData(data);
};

export const updateSubscriptionLimits = async (
  schoolId: string,
  payload: { studentLimit?: number; teacherLimit?: number; storageLimitMb?: number; reason?: string | null },
) => {
  const { data } = await api.patch<ApiEnvelope<SchoolSubscriptionDetail>>(`/admin/subscriptions/${schoolId}/limits`, payload);
  return unwrapData(data);
};

export const getSubscriptionUsage = async (schoolId: string) => {
  const { data } = await api.get<ApiEnvelope<SubscriptionUsage>>(`/admin/subscriptions/${schoolId}/usage`);
  return unwrapData(data);
};

export const getSubscriptionHistory = async (schoolId: string) => {
  const { data } = await api.get<ApiEnvelope<{ items: SubscriptionHistoryItem[] }>>(
    `/admin/subscriptions/${schoolId}/history`,
  );
  return unwrapData(data);
};

export const getSubscriptionInvoices = async (schoolId: string) => {
  const { data } = await api.get<ApiEnvelope<{ items: unknown[]; total: number; message?: string }>>(
    `/admin/subscriptions/${schoolId}/invoices`,
  );
  return unwrapData(data);
};

export const recordManualPayment = async (
  schoolId: string,
  payload: {
    amount: number;
    currency: string;
    method: string;
    reference?: string | null;
    paidAt: string;
    notes?: string | null;
  },
) => {
  const { data } = await api.post<ApiEnvelope<{ detail: SchoolSubscriptionDetail; gatewayCharged: boolean; message: string }>>(
    `/admin/subscriptions/${schoolId}/manual-payment`,
    payload,
  );
  return unwrapData(data);
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

export const getPlanPermissions = async (planId: string) => {
  const { data } = await api.get<{ planId: string; planName: string; permissions: PlanPermissionItem[] }>(
    `/admin/subscription-plans/${planId}/permissions`,
  );
  return data;
};

export const updatePlanPermissions = async (planId: string, enabledCodes: string[]) => {
  const { data } = await api.put<{ success: boolean }>(`/admin/subscription-plans/${planId}/permissions`, {
    enabledCodes,
  });
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
  billingCycle?: 'MONTHLY' | 'ANNUAL';
  discountPercent?: number;
  graceDays?: number;
  paidAt?: string | Date | null;
  nextDueAt?: string | Date | null;
  studentLimit?: number;
  teacherLimit?: number;
}) => {
  const { data } = await api.post('/subscriptions', payload);
  return data;
};
