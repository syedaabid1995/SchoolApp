'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardPageContainer from '../../../components/DashboardPageContainer';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { PLAN_PERMISSION_MODULES, buildPlanPermissionGroups } from '../../../config/plan-module-permissions';
import { getSession } from '../../../services/auth.service';
import {
  assignSchoolPlan,
  cancelSubscription,
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  downgradeSubscription,
  extendTrial,
  generateSubscriptionInvoice,
  getSchoolSubscriptionDetail,
  getSchoolSubscriptions,
  getSubscriptionSummary,
  getPlanPermissions,
  listSubscriptionPlans,
  pauseSubscription,
  recordManualPayment,
  renewSubscription,
  resumeSubscription,
  startTrial,
  updateSubscriptionLimits,
  updateSubscriptionPlan,
  updatePlanPermissions,
  upgradeSubscription,
  type PlanPermissionItem,
  type SchoolSubscriptionListItem,
  type SubscriptionPlan,
} from '../../../services/subscription.service';

type LifecycleAction =
  | 'assign'
  | 'start-trial'
  | 'extend-trial'
  | 'upgrade'
  | 'downgrade'
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'renew'
  | 'limits'
  | 'generate-invoice'
  | 'manual-payment';

const statusOptions = ['ACTIVE', 'TRIAL', 'PAUSED', 'CANCELLED', 'EXPIRED', 'OVERDUE', 'PENDING'];
const billingCycles = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'YEARLY'];

const formatLabel = (value?: string | null) =>
  (value ?? 'N/A')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (value?: number | null, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatNumber = (value?: number | null) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : '0';

const usagePercent = (used?: number, limit?: number | null) => {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round(((used ?? 0) / limit) * 100));
};

const daysUntil = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const statusBadgeClass = (status?: string | null) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'TRIAL') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'PAUSED' || status === 'PENDING_CANCEL') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  if (status === 'EXPIRED' || status === 'OVERDUE') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-violet-50 text-violet-700 ring-violet-200';
};

type ShellTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet';

const toneClasses: Record<ShellTone, { icon: string; panel: string; bar: string; text: string }> = {
  blue: {
    icon: 'bg-blue-50 text-blue-700 ring-blue-100',
    panel: 'border-blue-100 bg-blue-50/70',
    bar: 'bg-blue-500',
    text: 'text-blue-700',
  },
  emerald: {
    icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    panel: 'border-emerald-100 bg-emerald-50/70',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-700 ring-amber-100',
    panel: 'border-amber-100 bg-amber-50/70',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
  },
  rose: {
    icon: 'bg-rose-50 text-rose-700 ring-rose-100',
    panel: 'border-rose-100 bg-rose-50/70',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700 ring-slate-200',
    panel: 'border-[var(--shell-border)] bg-[var(--shell-subtle)]',
    bar: 'bg-slate-500',
    text: 'text-[var(--shell-text)]',
  },
  violet: {
    icon: 'bg-violet-50 text-violet-700 ring-violet-100',
    panel: 'border-violet-100 bg-violet-50/70',
    bar: 'bg-violet-500',
    text: 'text-violet-700',
  },
};

function Icon({ path, className = 'h-4 w-4' }: { path: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function StatCard({
  label,
  value,
  helper,
  tone = 'slate',
  icon,
}: {
  label: string;
  value: ReactNode;
  helper: string;
  tone?: ShellTone;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${toneClasses[tone].icon}`}>
          {icon}
        </span>
        <p className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      </div>
      <p className="mt-4 truncate text-2xl font-bold text-[var(--shell-text)]">{value}</p>
      <p className="mt-1 text-sm leading-5 text-[var(--shell-muted)]">{helper}</p>
    </div>
  );
}

function LifecycleHealthPanel({
  active,
  trial,
  paused,
  cancelled,
  expired,
  overdue,
  total,
}: {
  active: number;
  trial: number;
  paused: number;
  cancelled: number;
  expired: number;
  overdue: number;
  total: number;
}) {
  const items = [
    { label: 'Active', value: active, tone: 'emerald' as const },
    { label: 'Trial', value: trial, tone: 'blue' as const },
    { label: 'Paused', value: paused, tone: 'amber' as const },
    { label: 'Cancelled', value: cancelled, tone: 'slate' as const },
    { label: 'Expired', value: expired, tone: 'rose' as const },
    { label: 'Overdue', value: overdue, tone: 'rose' as const },
  ];

  return (
    <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Lifecycle mix</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--shell-text)]">Subscription health</h2>
        </div>
        <Badge className={overdue || expired ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}>
          {overdue || expired ? `${overdue + expired} need review` : 'Healthy'}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => {
          const percent = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className={`rounded-xl border p-3 ${toneClasses[item.tone].panel}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--shell-muted)]">{item.label}</span>
                <span className={`text-sm font-bold ${toneClasses[item.tone].text}`}>{item.value}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                <div className={`h-full rounded-full ${toneClasses[item.tone].bar}`} style={{ width: `${Math.max(percent, item.value ? 8 : 0)}%` }} />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-[var(--shell-muted)]">{percent}% of schools</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UsageBar({ label, used, limit }: { label: string; used?: number; limit?: number | null }) {
  const percent = usagePercent(used, limit);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--shell-text)]">{label}</span>
        <span className="text-[var(--shell-muted)]">
          {formatNumber(used)} / {limit ? formatNumber(limit) : 'N/A'}
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div
          className={`h-2 rounded-full ${percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

const initialActionForm = {
  planId: '',
  billingCycle: 'MONTHLY',
  startDate: '',
  trialDays: 14,
  extraDays: 7,
  effectiveDate: 'IMMEDIATE',
  force: false,
  cancelAt: 'IMMEDIATE',
  periodMonths: 1,
  studentLimit: '',
  teacherLimit: '',
  storageLimitMb: '',
  invoiceId: '',
  billingPeriodStart: '',
  billingPeriodEnd: '',
  dueDate: '',
  taxPercent: '',
  discountPercent: '',
  discountAmount: '',
  amount: '',
  paymentMode: 'UPI',
  referenceNumber: '',
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: '',
  reason: '',
};

const initialPlanForm = {
  name: '',
  status: 'ACTIVE',
  price: '0',
  studentLimit: '',
  teacherLimit: '',
  features: '',
};

type PlanFormState = typeof initialPlanForm;
type PlanModalMode = 'modules' | 'edit' | 'create';

const initialSubscriptionFilters = {
  page: 1,
  limit: 20,
  search: '',
  status: '',
  planId: '',
  billingCycle: '',
  trial: '',
  overdue: '',
};

type PlanPermissionGroupView = ReturnType<typeof buildPlanPermissionGroups>[number];
type PlanSectionView = { parent: string; codes: string[] };

const buildPlanSectionDefinitions = (): PlanSectionView[] => {
  const sections = new Map<string, Set<string>>();

  PLAN_PERMISSION_MODULES.forEach((definition) => {
    const sectionCodes = sections.get(definition.parent) ?? new Set<string>();
    definition.codes.forEach((code) => sectionCodes.add(code));
    sections.set(definition.parent, sectionCodes);
  });

  return Array.from(sections.entries()).map(([parent, codes]) => ({
    parent,
    codes: Array.from(codes),
  }));
};

const planSectionDefinitions = buildPlanSectionDefinitions();

const getGroupCodes = (group: PlanPermissionGroupView) =>
  Array.from(new Set(group.modules.flatMap((module) => module.permissions.map((permission) => permission.code))));

const getSectionState = (codes: string[], enabledSet: Set<string>) => {
  const enabledCount = codes.filter((code) => enabledSet.has(code)).length;
  return {
    enabledCount,
    isIncluded: codes.length > 0 && enabledCount === codes.length,
    isPartial: enabledCount > 0 && enabledCount < codes.length,
  };
};

const getSectionsFromGroups = (groups: PlanPermissionGroupView[]): PlanSectionView[] =>
  groups.map((group) => ({ parent: group.parent, codes: getGroupCodes(group) }));

const countIncludedSections = (sections: PlanSectionView[], enabledSet: Set<string>) =>
  sections.filter((section) => getSectionState(section.codes, enabledSet).isIncluded).length;

const buildPlanPayload = (form: PlanFormState) => {
  const price = Number(form.price);
  const studentLimit = Number(form.studentLimit);
  const teacherLimit = Number(form.teacherLimit);
  const features = form.features
    .split('\n')
    .map((feature) => feature.trim())
    .filter(Boolean);

  if (!form.name.trim()) throw new Error('Plan name is required.');
  if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid plan price.');
  if (!Number.isInteger(studentLimit) || studentLimit < 1) throw new Error('Student limit must be at least 1.');
  if (!Number.isInteger(teacherLimit) || teacherLimit < 1) throw new Error('Teacher limit must be at least 1.');

  return {
    name: form.name.trim(),
    status: form.status,
    priceCents: Math.round(price * 100),
    studentLimit,
    teacherLimit,
    features,
  };
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ action: LifecycleAction; item: SchoolSubscriptionListItem } | null>(null);
  const [modulePlanId, setModulePlanId] = useState<string | null>(null);
  const [planModalMode, setPlanModalMode] = useState<PlanModalMode | null>(null);
  const [editedPermissionCodes, setEditedPermissionCodes] = useState<string[]>([]);
  const [actionForm, setActionForm] = useState(initialActionForm);
  const [planForm, setPlanForm] = useState<PlanFormState>(initialPlanForm);
  const [filters, setFilters] = useState(initialSubscriptionFilters);

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? searchParams.get('query') ?? '';
    if (urlSearch) {
      setFilters((current) => ({ ...current, search: urlSearch, page: 1 }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, isSuperAdmin, router, session?.role]);

  const queryParams = useMemo(() => {
    const trial = filters.trial === '' ? undefined : filters.trial === 'true';
    const overdue = filters.overdue === '' ? undefined : filters.overdue === 'true';
    return {
      page: filters.page,
      limit: filters.limit,
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      planId: filters.planId || undefined,
      billingCycle: filters.billingCycle || undefined,
      trial,
      overdue,
    };
  }, [filters]);

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['subscription-lifecycle-summary'],
    queryFn: getSubscriptionSummary,
    enabled: isSuperAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: subscriptions,
    isLoading: isSubscriptionsLoading,
    isError: isSubscriptionsError,
    refetch,
  } = useQuery({
    queryKey: ['school-subscriptions', queryParams],
    queryFn: () => getSchoolSubscriptions(queryParams),
    enabled: isSuperAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: listSubscriptionPlans,
    enabled: isSuperAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['school-subscription-detail', selectedSchoolId],
    queryFn: () => getSchoolSubscriptionDetail(selectedSchoolId as string),
    enabled: Boolean(selectedSchoolId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const { data: modulePermissions, isLoading: isModulePermissionsLoading } = useQuery({
    queryKey: ['subscription-plan-modules', modulePlanId],
    queryFn: () => getPlanPermissions(modulePlanId as string),
    enabled: Boolean(modulePlanId) && isSuperAdmin && planModalMode === 'modules',
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!modulePermissions) return;
    setEditedPermissionCodes(modulePermissions.permissions.filter((permission) => permission.enabled).map((permission) => permission.code));
  }, [modulePermissions]);

  const lifecycleMutation = useMutation({
    mutationFn: async () => {
      if (!actionState) throw new Error('No action selected');
      const schoolId = actionState.item.schoolId;
      const reason = actionForm.reason.trim() || null;

      if (['assign', 'start-trial', 'upgrade', 'downgrade'].includes(actionState.action) && !actionForm.planId) {
        throw new Error('Select a plan.');
      }
      if (['pause', 'resume', 'cancel', 'limits'].includes(actionState.action) && !reason) {
        throw new Error('Reason is required.');
      }

      if (actionState.action === 'assign') {
        return assignSchoolPlan(schoolId, {
          planId: actionForm.planId,
          billingCycle: actionForm.billingCycle,
          startDate: actionForm.startDate || undefined,
          trialDays: Number(actionForm.trialDays) || 0,
          reason,
        });
      }
      if (actionState.action === 'start-trial') {
        return startTrial(schoolId, {
          planId: actionForm.planId,
          trialDays: Number(actionForm.trialDays) || 14,
          reason,
        });
      }
      if (actionState.action === 'extend-trial') {
        return extendTrial(schoolId, { extraDays: Number(actionForm.extraDays) || 7, reason });
      }
      if (actionState.action === 'upgrade') {
        return upgradeSubscription(schoolId, {
          newPlanId: actionForm.planId,
          effectiveDate: actionForm.effectiveDate,
          reason,
        });
      }
      if (actionState.action === 'downgrade') {
        return downgradeSubscription(schoolId, {
          newPlanId: actionForm.planId,
          effectiveDate: actionForm.effectiveDate,
          force: actionForm.force,
          reason,
        });
      }
      if (actionState.action === 'pause') return pauseSubscription(schoolId, { reason });
      if (actionState.action === 'resume') return resumeSubscription(schoolId, { reason });
      if (actionState.action === 'cancel') {
        return cancelSubscription(schoolId, { cancelAt: actionForm.cancelAt, reason });
      }
      if (actionState.action === 'renew') {
        return renewSubscription(schoolId, { periodMonths: Number(actionForm.periodMonths) || 1, reason });
      }
      if (actionState.action === 'limits') {
        return updateSubscriptionLimits(schoolId, {
          studentLimit: actionForm.studentLimit ? Number(actionForm.studentLimit) : undefined,
          teacherLimit: actionForm.teacherLimit ? Number(actionForm.teacherLimit) : undefined,
          storageLimitMb: actionForm.storageLimitMb ? Number(actionForm.storageLimitMb) : undefined,
          reason,
        });
      }
      if (actionState.action === 'generate-invoice') {
        return generateSubscriptionInvoice(schoolId, {
          billingPeriodStart: actionForm.billingPeriodStart || undefined,
          billingPeriodEnd: actionForm.billingPeriodEnd || undefined,
          dueDate: actionForm.dueDate || undefined,
          taxPercent: actionForm.taxPercent ? Number(actionForm.taxPercent) : 0,
          discountPercent: actionForm.discountPercent ? Number(actionForm.discountPercent) : 0,
          discountAmount: actionForm.discountAmount ? Number(actionForm.discountAmount) : undefined,
        });
      }
      if (actionState.action === 'manual-payment' && !actionForm.invoiceId) {
        throw new Error('Select or enter an invoice ID.');
      }
      return recordManualPayment(schoolId, {
        invoiceId: actionForm.invoiceId,
        amount: Number(actionForm.amount),
        paymentMode: actionForm.paymentMode,
        referenceNumber: actionForm.referenceNumber || null,
        paymentDate: actionForm.paymentDate,
        notes: actionForm.notes || null,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle-summary'] });
      if (actionState?.item.schoolId) {
        queryClient.invalidateQueries({ queryKey: ['school-subscription-detail', actionState.item.schoolId] });
      }
      const message = result?.message || 'Subscription lifecycle action completed.';
      notify.success('Subscription updated', message);
      setActionState(null);
      setActionForm(initialActionForm);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update subscription.';
      notify.error('Action failed', message);
    },
  });

  const modulePermissionMutation = useMutation({
    mutationFn: async () => {
      if (!modulePlanId) throw new Error('Select a plan.');
      return updatePlanPermissions(modulePlanId, editedPermissionCodes);
    },
    onSuccess: () => {
      notify.success('Plan modules updated', 'Sidebar modules and permissions were saved for this plan.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plan-modules', modulePlanId] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update plan modules.';
      notify.error('Save failed', message);
    },
  });

  const planCreateMutation = useMutation({
    mutationFn: async () => {
      const plan = await createSubscriptionPlan(buildPlanPayload(planForm));
      await updatePlanPermissions(plan.id, editedPermissionCodes);
      return plan;
    },
    onSuccess: () => {
      notify.success('Plan created', 'Plan details and module sections were saved.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle-summary'] });
      closePlanModal();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to create plan.';
      notify.error('Plan create failed', message);
    },
  });

  const planDeleteMutation = useMutation({
    mutationFn: (planId: string) => deleteSubscriptionPlan(planId),
    onSuccess: () => {
      notify.success('Plan deleted', 'The plan was removed from the catalog.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle-summary'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to delete plan.';
      notify.error('Plan delete failed', message);
    },
  });

  const planEditMutation = useMutation({
    mutationFn: async () => {
      if (!modulePlanId) throw new Error('Select a plan.');
      return updateSubscriptionPlan(modulePlanId, buildPlanPayload(planForm));
    },
    onSuccess: () => {
      notify.success('Plan updated', 'Plan details were saved.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['active-plans'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle-summary'] });
      closePlanModal();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update plan.';
      notify.error('Plan update failed', message);
    },
  });

  const setFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'page' ? {} : { page: 1 }),
    }));
  };

  const openAction = (item: SchoolSubscriptionListItem, action: LifecycleAction) => {
    const openInvoice = action === 'manual-payment' && selectedSchoolId === item.schoolId
      ? detail?.invoices?.find((invoice) => !['PAID', 'CANCELLED'].includes(invoice.status) && invoice.balanceAmount > 0)
      : null;
    setActionState({ item, action });
    setActionForm({
      ...initialActionForm,
      planId: item.planId ?? '',
      billingCycle: item.billingCycle ?? 'MONTHLY',
      studentLimit: item.studentLimit ? String(item.studentLimit) : '',
      teacherLimit: item.teacherLimit ? String(item.teacherLimit) : '',
      invoiceId: openInvoice?.id ?? '',
      amount: openInvoice ? String(openInvoice.balanceAmount) : '',
    });
  };

  const openPlanModules = (plan: SubscriptionPlan) => {
    setModulePlanId(plan.id);
    setPlanModalMode('modules');
  };

  const openPlanCreator = () => {
    setPlanForm({
      ...initialPlanForm,
      status: 'ACTIVE',
      price: '0',
    });
    setModulePlanId(null);
    setEditedPermissionCodes([]);
    setPlanModalMode('create');
  };

  const openPlanEditor = (plan: SubscriptionPlan) => {
    setPlanForm({
      name: plan.name,
      status: plan.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      price: String(plan.priceCents / 100),
      studentLimit: String(plan.studentLimit),
      teacherLimit: String(plan.teacherLimit),
      features: (plan.features ?? []).join('\n'),
    });
    setModulePlanId(plan.id);
    setPlanModalMode('edit');
  };

  const confirmDeletePlan = (plan: SubscriptionPlan) => {
    if (
      !window.confirm(
        `Delete "${plan.name}"? Existing schools keep their current plan name, but this plan will no longer be available for assignment.`,
      )
    ) {
      return;
    }
    planDeleteMutation.mutate(plan.id);
  };

  const closePlanModal = () => {
    setPlanModalMode(null);
    setModulePlanId(null);
    setEditedPermissionCodes([]);
    setPlanForm(initialPlanForm);
  };

  const activePlans = plans?.filter((plan) => plan.status === 'ACTIVE') ?? [];
  const selectedModulePlan = plans?.find((plan) => plan.id === modulePlanId) ?? null;
  const rows = subscriptions?.items ?? [];
  const pagination = subscriptions?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const busy = isSessionLoading || isSummaryLoading || isSubscriptionsLoading || lifecycleMutation.isPending;
  const totalSchools = summary?.totalSchools ?? pagination?.total ?? rows.length;
  const activeCount = summary?.activeSubscriptions ?? 0;
  const trialCount = summary?.trialSubscriptions ?? 0;
  const pausedCount = summary?.pausedSubscriptions ?? 0;
  const cancelledCount = summary?.cancelledSubscriptions ?? 0;
  const expiredCount = summary?.expiredSubscriptions ?? 0;
  const overdueCount = summary?.overdueSubscriptions ?? 0;
  const liveCoverage = totalSchools ? Math.round(((activeCount + trialCount) / totalSchools) * 100) : 0;
  const activeFilterKeys: Array<keyof typeof filters> = ['search', 'status', 'planId', 'billingCycle', 'trial', 'overdue'];
  const activeFiltersCount = activeFilterKeys.filter((key) => String(filters[key] ?? '').trim()).length;
  const clearFilters = () => setFilters({ ...initialSubscriptionFilters, limit: filters.limit });

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <DashboardPageContainer maxWidthClassName="max-w-[96rem]" className="space-y-5">
      {busy ? <FullPageLoader label="Loading subscriptions..." /> : null}
      <PageHeader
        title="School Subscriptions"
        subtitle="Manage plan assignments, billing periods, invoices, payments, limits, and module access across every school."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm font-semibold text-[var(--shell-text)] shadow-sm hover:bg-[var(--shell-hover)]"
          >
            <Icon path={<><path d="M21 12a9 9 0 0 1-9 9 8.6 8.6 0 0 1-6-2.4" /><path d="M3 12a9 9 0 0 1 15-6.7" /><path d="M21 3v6h-6" /></>} />
            Refresh
          </button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total schools"
            value={formatNumber(totalSchools)}
            helper={`${liveCoverage}% active or trial`}
            tone="blue"
            icon={<Icon path={<><path d="M3 21h18" /><path d="M5 21V7l8-4 6 3v15" /><path d="M9 9h1" /><path d="M9 13h1" /><path d="M14 10h1" /><path d="M14 14h1" /></>} />}
          />
          <StatCard
            label="Live plans"
            value={formatNumber(activeCount + trialCount)}
            helper={`${activeCount} active, ${trialCount} trial`}
            tone="emerald"
            icon={<Icon path={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>} />}
          />
          <StatCard
            label="Estimated MRR"
            value={formatCurrency(summary?.estimatedMonthlyRevenue, summary?.currency)}
            helper="Projected from plan prices"
            tone="violet"
            icon={<Icon path={<><path d="M3 7h18v13H3z" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M7 14h5" /><path d="M16 14h1" /></>} />}
          />
          <StatCard
            label="Open invoices"
            value={formatNumber(summary?.pendingManualPayments)}
            helper="Unpaid, partial, or overdue"
            tone={overdueCount || expiredCount ? 'rose' : 'amber'}
            icon={<Icon path={<><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path d="M9 8h6" /><path d="M9 12h6" /><path d="M9 16h4" /></>} />}
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Icon path={<><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>} />
            </span>
            <div>
              <p className="font-bold text-amber-950">Offline billing mode</p>
              <p className="mt-1">
                Billing gateway integration is not connected. Super Admin can generate subscription invoices and record offline payments against those invoices.
              </p>
            </div>
          </div>
        </div>
      </section>

      <LifecycleHealthPanel
        active={activeCount}
        trial={trialCount}
        paused={pausedCount}
        cancelled={cancelledCount}
        expired={expiredCount}
        overdue={overdueCount}
        total={Math.max(totalSchools, 1)}
      />

      <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Find subscriptions</h2>
            <p className="text-sm text-[var(--shell-muted)]">
              {activeFiltersCount ? `${activeFiltersCount} filter${activeFiltersCount === 1 ? '' : 's'} applied` : 'All schools are included'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!activeFiltersCount}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--shell-border)] px-3 text-sm font-semibold text-[var(--shell-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon path={<><path d="M3 6h18" /><path d="m8 6 8 12" /><path d="m16 6-8 12" /></>} />
            Clear
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <label className="xl:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="School name, code, plan"
              className="mt-1 h-10 w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilter('status', value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{formatLabel(status)}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Plan" value={filters.planId} onChange={(value) => setFilter('planId', value)}>
            <option value="">All plans</option>
            {(plans ?? []).map((plan) => (
              <option key={plan.id} value={plan.id}>{plan.name}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Billing" value={filters.billingCycle} onChange={(value) => setFilter('billingCycle', value)}>
            <option value="">Any cycle</option>
            {billingCycles.map((cycle) => (
              <option key={cycle} value={cycle}>{formatLabel(cycle)}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="Trial" value={filters.trial} onChange={(value) => setFilter('trial', value)}>
            <option value="">Any</option>
            <option value="true">Trial only</option>
            <option value="false">Non-trial</option>
          </FilterSelect>
          <FilterSelect label="Overdue" value={filters.overdue} onChange={(value) => setFilter('overdue', value)}>
            <option value="">Any</option>
            <option value="true">Overdue</option>
            <option value="false">Not overdue</option>
          </FilterSelect>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">School subscription lifecycle</h2>
            <p className="text-sm text-[var(--shell-muted)]">
              {pagination ? `${pagination.total} schools found` : 'Manage every tenant subscription'}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <Badge className="bg-[var(--shell-subtle)] text-[var(--shell-muted)] ring-[var(--shell-border)]">Page {filters.page} of {totalPages}</Badge>
            <FilterSelect label="Rows" value={String(filters.limit)} onChange={(value) => setFilter('limit', Number(value))}>
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {isSubscriptionsError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load subscriptions.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Retry
            </button>
          </div>
        ) : rows.length === 0 && !isSubscriptionsLoading ? (
          <div className="p-10 text-center text-sm text-[var(--shell-muted)]">No school subscriptions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">
                <tr>
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Period</th>
                  <th className="px-5 py-3">Usage</th>
                  <th className="px-5 py-3">Billing</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {rows.map((item) => {
                  const daysRemaining = daysUntil(item.currentPeriodEnd);
                  const periodTone = daysRemaining === null || daysRemaining > 14 ? 'text-[var(--shell-muted)]' : daysRemaining >= 0 ? 'text-amber-700' : 'text-rose-700';
                  return (
                    <tr key={item.schoolId} className="align-top hover:bg-[var(--shell-hover)]">
                      <td className="min-w-[18rem] px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold uppercase text-white">
                            {(item.schoolName || 'SC').slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--shell-text)]">{item.schoolName}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--shell-muted)]">
                              <span>{item.schoolCode ?? 'No code'}</span>
                              <span className="h-1 w-1 rounded-full bg-[var(--shell-border)]" />
                              <span>{formatLabel(item.schoolStatus)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="min-w-[12rem] px-5 py-4">
                        <div className="font-semibold text-[var(--shell-text)]">{item.planName ?? 'No plan assigned'}</div>
                        <div className="mt-1 text-xs text-[var(--shell-muted)]">{formatLabel(item.billingCycle)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={statusBadgeClass(item.status)}>{formatLabel(item.status)}</Badge>
                      </td>
                      <td className="min-w-[13rem] px-5 py-4">
                        <div className="font-semibold text-[var(--shell-text)]">Ends {formatDate(item.currentPeriodEnd)}</div>
                        <div className={`mt-1 text-xs font-semibold ${periodTone}`}>
                          {daysRemaining === null ? 'No period date' : daysRemaining >= 0 ? `${daysRemaining} days remaining` : `${Math.abs(daysRemaining)} days past end`}
                        </div>
                        {item.trialEndsAt ? <div className="mt-1 text-xs text-[var(--shell-muted)]">Trial ends {formatDate(item.trialEndsAt)}</div> : null}
                      </td>
                      <td className="min-w-[13rem] px-5 py-4">
                        <UsageBar label="Students" used={item.usage?.students} limit={item.studentLimit} />
                        <div className="mt-3">
                          <UsageBar label="Teachers" used={item.usage?.teachers} limit={item.teacherLimit} />
                        </div>
                      </td>
                      <td className="min-w-[9rem] px-5 py-4">
                        <div className="font-semibold text-[var(--shell-text)]">{formatCurrency(item.price, item.currency)}</div>
                        <div className="mt-1 text-xs text-[var(--shell-muted)]">{item.currency ?? 'INR'}</div>
                      </td>
                      <td className="min-w-[22rem] px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton icon={<Icon path={<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />} />} onClick={() => setSelectedSchoolId(item.schoolId)}>View</ActionButton>
                          <ActionButton icon={<Icon path={<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h10" /></>} />} onClick={() => openAction(item, item.subscriptionId ? 'upgrade' : 'assign')}>{item.subscriptionId ? 'Plan' : 'Assign'}</ActionButton>
                          {item.status === 'TRIAL' ? <ActionButton onClick={() => openAction(item, 'extend-trial')}>Extend</ActionButton> : <ActionButton onClick={() => openAction(item, 'start-trial')}>Trial</ActionButton>}
                          {item.status === 'PAUSED' ? <ActionButton onClick={() => openAction(item, 'resume')}>Resume</ActionButton> : <ActionButton onClick={() => openAction(item, 'pause')}>Pause</ActionButton>}
                          <ActionButton onClick={() => openAction(item, 'renew')}>Renew</ActionButton>
                          <ActionButton icon={<Icon path={<><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path d="M9 9h6" /></>} />} onClick={() => openAction(item, 'generate-invoice')}>Invoice</ActionButton>
                          <ActionButton onClick={() => openAction(item, 'limits')}>Limits</ActionButton>
                          <ActionButton onClick={() => openAction(item, 'manual-payment')}>Payment</ActionButton>
                          {item.status !== 'CANCELLED' ? <ActionButton danger onClick={() => openAction(item, 'cancel')}>Cancel</ActionButton> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-5 py-4 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {rows.length} of {pagination?.total ?? rows.length} schools
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', Math.max(1, filters.page - 1))}
              className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
              className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Plan catalog</p>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Limits and module access</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-50 text-blue-700 ring-blue-200">Modules follow School Admin sidebar names</Badge>
            <button
              type="button"
              onClick={openPlanCreator}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Icon path={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />
              Create Plan
            </button>
          </div>
        </div>

        {(plans ?? []).length ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {(plans ?? []).map((plan) => {
              const featurePreview = (plan.features ?? []).slice(0, 3);
              return (
                <article key={plan.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-[var(--shell-text)]">{plan.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-[var(--shell-muted)]">{formatCurrency(plan.priceCents / 100)} monthly</p>
                    </div>
                    <Badge className={statusBadgeClass(plan.status)}>{formatLabel(plan.status)}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-[var(--shell-muted)]">Students</p>
                      <p className="mt-1 text-lg font-bold text-blue-700">{formatNumber(plan.studentLimit)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-[var(--shell-muted)]">Teachers</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">{formatNumber(plan.teacherLimit)}</p>
                    </div>
                  </div>

                  <div className="mt-4 min-h-16 space-y-2">
                    {featurePreview.length ? (
                      featurePreview.map((feature) => (
                        <p key={feature} className="flex items-start gap-2 text-sm leading-5 text-[var(--shell-muted)]">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                          {feature}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--shell-muted)]">No feature summary added.</p>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => openPlanEditor(plan)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <Icon path={<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openPlanModules(plan)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                    >
                      <Icon path={<><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></>} />
                      Modules
                    </button>
                    <button
                      type="button"
                      disabled={planDeleteMutation.isPending}
                      onClick={() => confirmDeletePlan(plan)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Icon path={<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>} />
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center text-sm text-[var(--shell-muted)]">
            No subscription plans found.
          </div>
        )}
      </section>

      {selectedSchoolId ? (
        <SubscriptionDetailDrawer
          schoolId={selectedSchoolId}
          detail={detail}
          loading={isDetailLoading}
          onClose={() => setSelectedSchoolId(null)}
          onAction={(itemAction) => {
            const item = rows.find((row) => row.schoolId === selectedSchoolId);
            if (item) openAction(item, itemAction);
          }}
        />
      ) : null}

      {actionState ? (
        <ActionModal
          action={actionState.action}
          item={actionState.item}
          plans={activePlans}
          form={actionForm}
          setForm={setActionForm}
          loading={lifecycleMutation.isPending}
          onClose={() => setActionState(null)}
          onSubmit={() => {
            if (actionState.action === 'cancel' && !window.confirm('Cancel this subscription? This may restrict school access.')) return;
            if (actionState.action === 'pause' && !window.confirm('Pause this subscription? The school may lose access to paid modules.')) return;
            if (actionState.action === 'downgrade' && !window.confirm('Downgrading may disable modules or reduce limits.')) return;
            if (actionState.action === 'limits' && !window.confirm('Override plan limits for this school?')) return;
            if (actionState.action === 'manual-payment' && !window.confirm('Record this manual payment? This does not charge a real payment gateway.')) return;
            lifecycleMutation.mutate();
          }}
        />
      ) : null}

      {modulePlanId && planModalMode === 'modules' ? (
        <PlanModulesModal
          plan={selectedModulePlan}
          permissions={modulePermissions?.permissions ?? []}
          editedCodes={editedPermissionCodes}
          loading={isModulePermissionsLoading}
          saving={modulePermissionMutation.isPending}
          onChange={setEditedPermissionCodes}
          onClose={closePlanModal}
          onSubmit={() => modulePermissionMutation.mutate()}
        />
      ) : null}

      {modulePlanId && planModalMode === 'edit' ? (
        <PlanEditModal
          mode="edit"
          plan={selectedModulePlan}
          form={planForm}
          saving={planEditMutation.isPending}
          onFormChange={(patch) => setPlanForm((current) => ({ ...current, ...patch }))}
          onClose={closePlanModal}
          onSubmit={() => planEditMutation.mutate()}
        />
      ) : null}

      {planModalMode === 'create' ? (
        <PlanEditModal
          mode="create"
          plan={null}
          form={planForm}
          saving={planCreateMutation.isPending}
          moduleSections={planSectionDefinitions}
          enabledCodes={editedPermissionCodes}
          onFormChange={(patch) => setPlanForm((current) => ({ ...current, ...patch }))}
          onModuleChange={setEditedPermissionCodes}
          onClose={closePlanModal}
          onSubmit={() => planCreateMutation.mutate()}
        />
      ) : null}
    </DashboardPageContainer>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false,
  icon,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function PlanEditModal({
  mode,
  plan,
  form,
  saving,
  moduleSections = [],
  enabledCodes = [],
  onFormChange,
  onModuleChange,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  plan: SubscriptionPlan | null;
  form: PlanFormState;
  saving: boolean;
  moduleSections?: PlanSectionView[];
  enabledCodes?: string[];
  onFormChange: (patch: Partial<PlanFormState>) => void;
  onModuleChange?: (codes: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const isCreate = mode === 'create';
  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);
  const includedSectionCount = useMemo(() => countIncludedSections(moduleSections, enabledSet), [moduleSections, enabledSet]);
  const allModuleCodes = useMemo(() => Array.from(new Set(moduleSections.flatMap((section) => section.codes))), [moduleSections]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close plan drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[var(--shell-card)] shadow-2xl">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-col gap-4 border-b border-[var(--shell-border)] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{isCreate ? 'Create plan' : 'Edit plan'}</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{isCreate ? 'New Subscription Plan' : plan?.name ?? 'Subscription Plan'}</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              {isCreate
                ? 'Set pricing, limits, features, and sidebar sections.'
                : 'Update plan pricing, limits, and feature lines.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
            <div>
              <h3 className="text-base font-bold text-[var(--shell-text)]">Plan Details</h3>
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Plan Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => onFormChange({ name: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Premium"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Status</span>
                    <select
                      value={form.status}
                      onChange={(event) => onFormChange({ status: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Monthly Price</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.price}
                      onChange={(event) => onFormChange({ price: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Student Limit</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.studentLimit}
                      onChange={(event) => onFormChange({ studentLimit: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Teacher Limit</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={form.teacherLimit}
                      onChange={(event) => onFormChange({ teacherLimit: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Feature Lines</span>
                  <textarea
                    value={form.features}
                    onChange={(event) => onFormChange({ features: event.target.value })}
                    rows={8}
                    className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="One feature per line"
                  />
                </label>
              </div>
            </div>
          </section>

          {isCreate ? (
            <section className="mt-4 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--shell-text)]">Modules</h3>
                  <p className="mt-1 text-sm text-[var(--shell-muted)]">
                    {includedSectionCount} of {moduleSections.length} sections enabled
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onModuleChange?.(allModuleCodes)}
                    className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => onModuleChange?.([])}
                    className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                  >
                    Disable All
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <PlanSectionList
                  sections={moduleSections}
                  enabledCodes={enabledCodes}
                  disabled={saving}
                  onChange={(codes) => onModuleChange?.(codes)}
                />
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--shell-border)] p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : isCreate ? 'Create Plan' : 'Save Plan'}
          </button>
        </div>
      </form>
      </aside>
    </div>
  );
}

function PlanSectionList({
  sections,
  enabledCodes,
  disabled = false,
  onChange,
}: {
  sections: PlanSectionView[];
  enabledCodes: string[];
  disabled?: boolean;
  onChange: (codes: string[]) => void;
}) {
  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);

  const toggleCodes = (codes: string[], enabled: boolean) => {
    const next = new Set(enabledCodes);
    codes.forEach((code) => {
      if (enabled) next.add(code);
      else next.delete(code);
    });
    onChange(Array.from(next));
  };

  if (!sections.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center text-sm text-[var(--shell-muted)]">
        No module sections found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)]">
      {sections.map((section) => {
        const sectionState = getSectionState(section.codes, enabledSet);
        return (
          <div
            key={section.parent}
            className={`flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between ${
              sectionState.isIncluded ? 'bg-emerald-50/45' : sectionState.isPartial ? 'bg-amber-50/50' : 'bg-[var(--shell-card)]'
            }`}
          >
            <h4 className="text-sm font-bold text-[var(--shell-text)]">{section.parent}</h4>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleCodes(section.codes, !sectionState.isIncluded)}
              className={`w-24 rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
                sectionState.isIncluded
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : sectionState.isPartial
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
              }`}
            >
              {sectionState.isIncluded ? 'Enabled' : sectionState.isPartial ? 'Partial' : 'Disabled'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PlanModulesModal({
  plan,
  permissions,
  editedCodes,
  loading,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  plan: SubscriptionPlan | null;
  permissions: PlanPermissionItem[];
  editedCodes: string[];
  loading: boolean;
  saving: boolean;
  onChange: (codes: string[]) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const groups = useMemo(() => buildPlanPermissionGroups(permissions), [permissions]);
  const sections = useMemo(() => getSectionsFromGroups(groups), [groups]);
  const enabledSet = useMemo(() => new Set(editedCodes), [editedCodes]);
  const allCodes = useMemo(() => Array.from(new Set(permissions.map((permission) => permission.code))), [permissions]);
  const includedSectionCount = useMemo(() => countIncludedSections(sections, enabledSet), [sections, enabledSet]);

  const setCodes = (codes: string[]) => onChange(Array.from(new Set(codes)));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close modules drawer" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[var(--shell-card)] shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-[var(--shell-border)] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Plan modules and sidebar access</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{plan?.name ?? 'Subscription Plan'}</h2>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              {includedSectionCount} of {sections.length} sections enabled
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCodes(allCodes)}
              disabled={loading}
              className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50"
            >
              Enable All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={loading}
              className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50"
            >
              Disable All
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-[var(--shell-subtle)]" />
              ))}
            </div>
          ) : sections.length ? (
            <PlanSectionList
              sections={sections}
              enabledCodes={editedCodes}
              disabled={saving || loading}
              onChange={onChange}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-10 text-center text-sm text-[var(--shell-muted)]">
              No module permissions found for this plan.
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--shell-border)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--shell-muted)]">
            {includedSectionCount} of {sections.length} sections enabled
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={onSubmit}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Modules'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SubscriptionDetailDrawer({
  detail,
  loading,
  onClose,
  onAction,
}: {
  schoolId: string;
  detail: Awaited<ReturnType<typeof getSchoolSubscriptionDetail>> | undefined;
  loading: boolean;
  onClose: () => void;
  onAction: (action: LifecycleAction) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close subscription detail" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Subscription detail</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{detail?.school.name ?? 'Loading school...'}</h2>
            <p className="text-sm text-[var(--shell-muted)]">{detail?.school.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Close
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-8 text-sm text-[var(--shell-muted)]">Loading subscription detail...</div>
        ) : (
          <div className="space-y-5 py-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <InfoBox label="Plan" value={detail.subscription?.plan?.name ?? 'No plan assigned'} />
              <InfoBox label="Status" value={formatLabel(detail.subscription?.status)} />
              <InfoBox label="Current Period" value={`${formatDate(detail.subscription?.currentPeriodStart)} to ${formatDate(detail.subscription?.currentPeriodEnd)}`} />
              <InfoBox label="Trial Ends" value={formatDate(detail.subscription?.trialEndsAt)} />
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Usage and limits</h3>
              <div className="mt-4 space-y-4">
                <UsageBar label="Students" used={detail.subscription?.usage.students} limit={detail.subscription?.limits.students} />
                <UsageBar label="Teachers" used={detail.subscription?.usage.teachers} limit={detail.subscription?.limits.teachers} />
                <UsageBar label="Storage" used={detail.subscription?.usage.storageMb} limit={detail.subscription?.limits.storageMb ?? null} />
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Lifecycle actions</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionButton onClick={() => onAction('assign')}>Assign Plan</ActionButton>
                <ActionButton onClick={() => onAction('upgrade')}>Upgrade</ActionButton>
                <ActionButton onClick={() => onAction('downgrade')}>Downgrade</ActionButton>
                <ActionButton onClick={() => onAction('extend-trial')}>Extend Trial</ActionButton>
                <ActionButton onClick={() => onAction('pause')}>Pause</ActionButton>
                <ActionButton onClick={() => onAction('resume')}>Resume</ActionButton>
                <ActionButton onClick={() => onAction('renew')}>Renew</ActionButton>
                <ActionButton onClick={() => onAction('generate-invoice')}>Generate Invoice</ActionButton>
                <ActionButton onClick={() => onAction('limits')}>Override Limits</ActionButton>
                <ActionButton onClick={() => onAction('manual-payment')}>Manual Payment</ActionButton>
                <ActionButton danger onClick={() => onAction('cancel')}>Cancel</ActionButton>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Billing records</h3>
              {detail.invoices.length ? (
                <div className="mt-3 space-y-2">
                  {detail.invoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-xl bg-[var(--shell-subtle)] p-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-[var(--shell-text)]">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-[var(--shell-muted)]">
                            {formatDate(invoice.billingPeriodStart)} to {formatDate(invoice.billingPeriodEnd)} - Due {formatDate(invoice.dueDate)}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--shell-muted)]">{invoice.id}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={statusBadgeClass(invoice.status)}>{formatLabel(invoice.status)}</Badge>
                          <p className="mt-1 text-sm font-semibold text-[var(--shell-text)]">{formatCurrency(invoice.balanceAmount)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--shell-muted)]">
                  {detail.billingMessage ?? 'No invoice or payment records are available.'}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">History</h3>
              <div className="mt-3 space-y-2">
                {detail.history.length === 0 ? (
                  <p className="text-sm text-[var(--shell-muted)]">No subscription history found.</p>
                ) : (
                  detail.history.map((item) => (
                    <div key={item.id} className="rounded-xl bg-[var(--shell-subtle)] p-3">
                      <p className="font-semibold text-[var(--shell-text)]">{formatLabel(item.action)}</p>
                      <p className="text-xs text-[var(--shell-muted)]">{item.actorName ?? 'System'} - {formatDateTime(item.createdAt)}</p>
                      {item.reason ? <p className="mt-1 text-xs text-[var(--shell-muted)]">Reason: {String(item.reason)}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--shell-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--shell-text)]">{value}</p>
    </div>
  );
}

function ActionModal({
  action,
  item,
  plans,
  form,
  setForm,
  loading,
  onClose,
  onSubmit,
}: {
  action: LifecycleAction;
  item: SchoolSubscriptionListItem;
  plans: SubscriptionPlan[];
  form: typeof initialActionForm;
  setForm: (form: typeof initialActionForm) => void;
  loading: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const selectedPlan = plans.find((plan) => plan.id === form.planId);
  const exceedsSelectedPlan =
    action === 'downgrade' &&
    selectedPlan &&
    ((item.usage?.students ?? 0) > selectedPlan.studentLimit || (item.usage?.teachers ?? 0) > selectedPlan.teacherLimit);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{formatLabel(action)}</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--shell-text)]">{item.schoolName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {['assign', 'start-trial', 'upgrade', 'downgrade'].includes(action) ? (
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Plan</span>
              <select value={form.planId} onChange={(event) => setForm({ ...form, planId: event.target.value })} className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)]">
                <option value="">Select plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.priceCents / 100)}</option>
                ))}
              </select>
            </label>
          ) : null}

          {action === 'assign' ? (
            <>
              <FormSelect label="Billing cycle" value={form.billingCycle} onChange={(value) => setForm({ ...form, billingCycle: value })}>
                {billingCycles.map((cycle) => <option key={cycle} value={cycle}>{formatLabel(cycle)}</option>)}
              </FormSelect>
              <FormInput label="Trial days" type="number" value={String(form.trialDays)} onChange={(value) => setForm({ ...form, trialDays: Number(value) })} />
              <FormInput label="Start date" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
            </>
          ) : null}

          {action === 'start-trial' ? (
            <FormInput label="Trial days" type="number" value={String(form.trialDays)} onChange={(value) => setForm({ ...form, trialDays: Number(value) })} />
          ) : null}

          {action === 'extend-trial' ? (
            <FormInput label="Extra days" type="number" value={String(form.extraDays)} onChange={(value) => setForm({ ...form, extraDays: Number(value) })} />
          ) : null}

          {['upgrade', 'downgrade'].includes(action) ? (
            <FormSelect label="Effective date" value={form.effectiveDate} onChange={(value) => setForm({ ...form, effectiveDate: value })}>
              <option value="IMMEDIATE">Immediate</option>
              <option value="NEXT_BILLING_CYCLE">Next billing cycle</option>
            </FormSelect>
          ) : null}

          {action === 'downgrade' && exceedsSelectedPlan ? (
            <label className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <input type="checkbox" checked={form.force} onChange={(event) => setForm({ ...form, force: event.target.checked })} className="mr-2" />
              Current usage exceeds selected plan limits. Force downgrade after review.
            </label>
          ) : null}

          {action === 'cancel' ? (
            <FormSelect label="Cancel when" value={form.cancelAt} onChange={(value) => setForm({ ...form, cancelAt: value })}>
              <option value="IMMEDIATE">Immediately</option>
              <option value="PERIOD_END">At period end</option>
            </FormSelect>
          ) : null}

          {action === 'renew' ? (
            <FormInput label="Period months" type="number" value={String(form.periodMonths)} onChange={(value) => setForm({ ...form, periodMonths: Number(value) })} />
          ) : null}

          {action === 'limits' ? (
            <>
              <FormInput label="Student limit" type="number" value={form.studentLimit} onChange={(value) => setForm({ ...form, studentLimit: value })} />
              <FormInput label="Teacher limit" type="number" value={form.teacherLimit} onChange={(value) => setForm({ ...form, teacherLimit: value })} />
              <FormInput label="Storage limit MB" type="number" value={form.storageLimitMb} onChange={(value) => setForm({ ...form, storageLimitMb: value })} />
              <p className="text-xs text-[var(--shell-muted)]">Storage limit is not persisted in the current backend schema.</p>
            </>
          ) : null}

          {action === 'generate-invoice' ? (
            <>
              <FormInput label="Billing period start" type="date" value={form.billingPeriodStart} onChange={(value) => setForm({ ...form, billingPeriodStart: value })} />
              <FormInput label="Billing period end" type="date" value={form.billingPeriodEnd} onChange={(value) => setForm({ ...form, billingPeriodEnd: value })} />
              <FormInput label="Due date" type="date" value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} />
              <FormInput label="Tax percent" type="number" value={form.taxPercent} onChange={(value) => setForm({ ...form, taxPercent: value })} />
              <FormInput label="Discount percent" type="number" value={form.discountPercent} onChange={(value) => setForm({ ...form, discountPercent: value })} />
              <FormInput label="Discount amount" type="number" value={form.discountAmount} onChange={(value) => setForm({ ...form, discountAmount: value })} />
              <p className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Total is calculated on the backend from the assigned plan price, tax, and discount.
              </p>
            </>
          ) : null}

          {action === 'manual-payment' ? (
            <>
              <FormInput label="Invoice ID" value={form.invoiceId} onChange={(value) => setForm({ ...form, invoiceId: value })} />
              <FormInput label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
              <FormSelect label="Payment mode" value={form.paymentMode} onChange={(value) => setForm({ ...form, paymentMode: value })}>
                {['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER'].map((mode) => (
                  <option key={mode} value={mode}>{formatLabel(mode)}</option>
                ))}
              </FormSelect>
              <FormInput label="Reference" value={form.referenceNumber} onChange={(value) => setForm({ ...form, referenceNumber: value })} />
              <FormInput label="Payment date" type="date" value={form.paymentDate} onChange={(value) => setForm({ ...form, paymentDate: value })} />
              <FormInput label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              <p className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                This records an offline payment against the selected invoice. It does not charge a payment gateway.
              </p>
            </>
          ) : null}

          <label className="sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Reason</span>
            <textarea
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              rows={3}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)]"
              placeholder="Reason for this lifecycle action"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--shell-border)] pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Cancel
          </button>
          <button type="button" disabled={loading} onClick={onSubmit} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)]"
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)]"
      >
        {children}
      </select>
    </label>
  );
}
