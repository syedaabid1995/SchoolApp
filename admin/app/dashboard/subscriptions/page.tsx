'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import {
  assignSchoolPlan,
  cancelSubscription,
  downgradeSubscription,
  extendTrial,
  getSchoolSubscriptionDetail,
  getSchoolSubscriptions,
  getSubscriptionSummary,
  listSubscriptionPlans,
  pauseSubscription,
  recordManualPayment,
  renewSubscription,
  resumeSubscription,
  startTrial,
  updateSubscriptionLimits,
  upgradeSubscription,
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

const usagePercent = (used?: number, limit?: number | null) => {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, Math.round(((used ?? 0) / limit) * 100));
};

const statusBadgeClass = (status?: string | null) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'TRIAL') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'PAUSED' || status === 'PENDING_CANCEL') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  if (status === 'EXPIRED' || status === 'OVERDUE') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-violet-50 text-violet-700 ring-violet-200';
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function StatCard({ label, value, helper }: { label: string; value: ReactNode; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[var(--shell-text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--shell-muted)]">{helper}</p>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used?: number; limit?: number | null }) {
  const percent = usagePercent(used, limit);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--shell-text)]">{label}</span>
        <span className="text-[var(--shell-muted)]">
          {used ?? 0} / {limit ?? 'N/A'}
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
  amount: '',
  currency: 'INR',
  method: 'UPI',
  reference: '',
  paidAt: new Date().toISOString().slice(0, 10),
  notes: '',
  reason: '',
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ action: LifecycleAction; item: SchoolSubscriptionListItem } | null>(null);
  const [actionForm, setActionForm] = useState(initialActionForm);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    planId: '',
    billingCycle: '',
    trial: '',
    overdue: '',
  });

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
      return recordManualPayment(schoolId, {
        amount: Number(actionForm.amount),
        currency: actionForm.currency,
        method: actionForm.method,
        reference: actionForm.reference || null,
        paidAt: actionForm.paidAt,
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

  const setFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'page' ? {} : { page: 1 }),
    }));
  };

  const openAction = (item: SchoolSubscriptionListItem, action: LifecycleAction) => {
    setActionState({ item, action });
    setActionForm({
      ...initialActionForm,
      planId: item.planId ?? '',
      billingCycle: item.billingCycle ?? 'MONTHLY',
      studentLimit: item.studentLimit ? String(item.studentLimit) : '',
      teacherLimit: item.teacherLimit ? String(item.teacherLimit) : '',
    });
  };

  const activePlans = plans?.filter((plan) => plan.status === 'ACTIVE') ?? [];
  const rows = subscriptions?.items ?? [];
  const pagination = subscriptions?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const busy = isSessionLoading || isSummaryLoading || isSubscriptionsLoading || lifecycleMutation.isPending;

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6 pb-12">
      {busy ? <FullPageLoader label="Loading subscriptions..." /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="School Subscriptions"
          subtitle="Manage plans, trials, renewals, limits, and subscription lifecycle for all schools."
        />
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)] shadow-sm hover:bg-[var(--shell-hover)]"
        >
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Billing gateway integration is not connected. Revenue is estimated from plan prices, and manual payments are recorded as audit history only.
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active" value={summary?.activeSubscriptions ?? 0} helper="Currently active schools" />
        <StatCard label="Trial" value={summary?.trialSubscriptions ?? 0} helper="Schools in trial" />
        <StatCard label="Paused" value={summary?.pausedSubscriptions ?? 0} helper="Temporarily paused" />
        <StatCard label="Cancelled" value={summary?.cancelledSubscriptions ?? 0} helper="Cancelled subscriptions" />
        <StatCard label="Expired" value={summary?.expiredSubscriptions ?? 0} helper="Past period end" />
        <StatCard label="Overdue" value={summary?.overdueSubscriptions ?? 0} helper="Past next due date" />
        <StatCard label="Estimated MRR" value={formatCurrency(summary?.estimatedMonthlyRevenue, summary?.currency)} helper="Not payment gateway revenue" />
        <StatCard label="Manual Payments" value={summary?.pendingManualPayments ?? 0} helper="Payment model not implemented" />
      </section>

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="School name, code, plan"
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
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
          <FilterSelect label="Overdue" value={filters.overdue} onChange={(value) => setFilter('overdue', value)}>
            <option value="">Any</option>
            <option value="true">Overdue</option>
            <option value="false">Not overdue</option>
          </FilterSelect>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--shell-text)]">School Subscription Lifecycle</h2>
            <p className="text-sm text-[var(--shell-muted)]">
              {pagination ? `${pagination.total} schools found` : 'Manage every tenant subscription'}
            </p>
          </div>
          <FilterSelect label="Rows" value={String(filters.limit)} onChange={(value) => setFilter('limit', Number(value))}>
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </FilterSelect>
        </div>

        {isSubscriptionsError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load subscriptions.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
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
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {rows.map((item) => (
                  <tr key={item.schoolId} className="hover:bg-[var(--shell-hover)]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--shell-text)]">{item.schoolName}</div>
                      <div className="text-xs text-[var(--shell-muted)]">{item.schoolCode ?? 'No code'} - {formatLabel(item.schoolStatus)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--shell-text)]">{item.planName ?? 'No plan assigned'}</div>
                      <div className="text-xs text-[var(--shell-muted)]">{formatLabel(item.billingCycle)}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={statusBadgeClass(item.status)}>{formatLabel(item.status)}</Badge>
                    </td>
                    <td className="px-5 py-4 text-[var(--shell-muted)]">
                      <div>Ends: {formatDate(item.currentPeriodEnd)}</div>
                      {item.trialEndsAt ? <div className="text-xs">Trial ends: {formatDate(item.trialEndsAt)}</div> : null}
                    </td>
                    <td className="min-w-[180px] px-5 py-4">
                      <UsageBar label="Students" used={item.usage?.students} limit={item.studentLimit} />
                      <div className="mt-2">
                        <UsageBar label="Teachers" used={item.usage?.teachers} limit={item.teacherLimit} />
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[var(--shell-text)]">{formatCurrency(item.price, item.currency)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ActionButton onClick={() => setSelectedSchoolId(item.schoolId)}>View</ActionButton>
                        <ActionButton onClick={() => openAction(item, item.subscriptionId ? 'upgrade' : 'assign')}>{item.subscriptionId ? 'Change Plan' : 'Assign Plan'}</ActionButton>
                        {item.status === 'TRIAL' ? <ActionButton onClick={() => openAction(item, 'extend-trial')}>Extend Trial</ActionButton> : <ActionButton onClick={() => openAction(item, 'start-trial')}>Start Trial</ActionButton>}
                        {item.status === 'PAUSED' ? <ActionButton onClick={() => openAction(item, 'resume')}>Resume</ActionButton> : <ActionButton onClick={() => openAction(item, 'pause')}>Pause</ActionButton>}
                        <ActionButton onClick={() => openAction(item, 'renew')}>Renew</ActionButton>
                        <ActionButton onClick={() => openAction(item, 'limits')}>Limits</ActionButton>
                        <ActionButton onClick={() => openAction(item, 'manual-payment')}>Payment</ActionButton>
                        {item.status !== 'CANCELLED' ? <ActionButton danger onClick={() => openAction(item, 'cancel')}>Cancel</ActionButton> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-5 py-4 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Page {filters.page} of {totalPages}</span>
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

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--shell-text)]">Plan Catalog</h2>
        <p className="mt-1 text-sm text-[var(--shell-muted)]">Existing subscription plans used for lifecycle actions.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--shell-text)]">{plan.name}</p>
                <Badge className={statusBadgeClass(plan.status)}>{formatLabel(plan.status)}</Badge>
              </div>
              <p className="mt-2 text-xl font-bold text-[var(--shell-text)]">{formatCurrency(plan.priceCents / 100)}</p>
              <p className="text-xs text-[var(--shell-muted)]">Students {plan.studentLimit} - Teachers {plan.teacherLimit}</p>
            </div>
          ))}
        </div>
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
    </div>
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
        className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
    </label>
  );
}

function ActionButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
      }`}
    >
      {children}
    </button>
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
                <ActionButton onClick={() => onAction('limits')}>Override Limits</ActionButton>
                <ActionButton onClick={() => onAction('manual-payment')}>Manual Payment</ActionButton>
                <ActionButton danger onClick={() => onAction('cancel')}>Cancel</ActionButton>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--shell-border)] p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Billing records</h3>
              <p className="mt-2 text-sm text-[var(--shell-muted)]">
                {detail.billingMessage ?? 'No invoice or payment records are available.'}
              </p>
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

          {action === 'manual-payment' ? (
            <>
              <FormInput label="Amount" type="number" value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
              <FormInput label="Currency" value={form.currency} onChange={(value) => setForm({ ...form, currency: value.toUpperCase().slice(0, 3) })} />
              <FormInput label="Method" value={form.method} onChange={(value) => setForm({ ...form, method: value })} />
              <FormInput label="Reference" value={form.reference} onChange={(value) => setForm({ ...form, reference: value })} />
              <FormInput label="Paid date" type="date" value={form.paidAt} onChange={(value) => setForm({ ...form, paidAt: value })} />
              <FormInput label="Notes" value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} />
              <p className="sm:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                This records a manual payment note. It does not charge a payment gateway.
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
