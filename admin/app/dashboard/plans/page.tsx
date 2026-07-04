'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../services/auth.service';
import {
  createSubscriptionCheckout,
  getSubscription,
  listActivePlans,
  verifySubscriptionCheckout,
  type SubscriptionCheckoutOrder,
  type SubscriptionInfo,
  type SubscriptionPlan,
} from '../../../services/subscription.service';
import { useNotify } from '../../../components/NotificationProvider';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import DashboardPageContainer from '../../../components/DashboardPageContainer';

type BillingCycle = 'MONTHLY' | 'ANNUAL';
type NoticeTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutInstance = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
  }
}

const toneClasses: Record<NoticeTone, { badge: string; panel: string; icon: string; button: string; text: string }> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700 ring-blue-200',
    panel: 'border-blue-200 bg-blue-50/80',
    icon: 'bg-blue-600 text-white',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    text: 'text-blue-700',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    panel: 'border-emerald-200 bg-emerald-50/80',
    icon: 'bg-emerald-600 text-white',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    text: 'text-emerald-700',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    panel: 'border-amber-200 bg-amber-50/80',
    icon: 'bg-amber-500 text-white',
    button: 'bg-amber-500 text-slate-950 hover:bg-amber-400',
    text: 'text-amber-700',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    panel: 'border-rose-200 bg-rose-50/80',
    icon: 'bg-rose-600 text-white',
    button: 'bg-rose-600 text-white hover:bg-rose-700',
    text: 'text-rose-700',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    panel: 'border-slate-200 bg-slate-50',
    icon: 'bg-slate-900 text-white',
    button: 'bg-slate-900 text-white hover:bg-slate-800',
    text: 'text-slate-700',
  },
};

const formatNumber = (value?: number | null) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : '0';

const formatDate = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatStatus = (value?: string | null) =>
  value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Inactive';

const errorMessage = (error: unknown, fallback: string) =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error as Error)?.message ||
  fallback;

const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Payment checkout is unavailable on the server.'));
      return;
    }
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existingScript = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Unable to load Razorpay checkout.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
    document.body.appendChild(script);
  });

const openRazorpayCheckout = (
  checkout: SubscriptionCheckoutOrder,
  session?: { email?: string | null; displayName?: string | null; schoolName?: string | null } | null,
) =>
  new Promise<RazorpaySuccessResponse>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.Razorpay) {
      reject(new Error('Razorpay checkout is unavailable.'));
      return;
    }

    const instance = new window.Razorpay({
      key: checkout.keyId,
      amount: checkout.order.amount,
      currency: checkout.order.currency,
      name: 'Akademifyy',
      description: `${checkout.plan.name} ${checkout.checkout.billingCycle.toLowerCase()} subscription`,
      order_id: checkout.order.id,
      prefill: {
        name: session?.displayName ?? session?.schoolName ?? checkout.school.name,
        email: session?.email ?? undefined,
      },
      notes: {
        receipt: checkout.checkout.receipt,
        planId: checkout.plan.id,
      },
      theme: {
        color: '#2563eb',
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled before completion.')),
      },
      handler: (response: RazorpaySuccessResponse) => resolve(response),
    });
    instance.open();
  });

const statusTone = (status?: string | null): NoticeTone => {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'ACTIVE' || normalized === 'TRIAL') return 'emerald';
  if (normalized === 'OVERDUE' || normalized === 'PENDING' || normalized === 'PENDING_CANCEL') return 'amber';
  if (normalized === 'EXPIRED' || normalized === 'CANCELLED') return 'rose';
  return 'slate';
};

const getPriceParts = (plan: SubscriptionPlan, billingCycle: BillingCycle) => {
  const monthlyCents = Number(plan.priceCents ?? 0);
  if (monthlyCents <= 0) {
    return { amount: 'Free', cadence: '', helper: 'Included core access' };
  }
  if (billingCycle === 'ANNUAL') {
    const annualCents = Math.round(monthlyCents * 12 * 0.9);
    return {
      amount: `Rs ${Math.round(annualCents / 100).toLocaleString('en-IN')}`,
      cadence: 'year',
      helper: '10% annual saving',
    };
  }
  return {
    amount: `Rs ${Math.round(monthlyCents / 100).toLocaleString('en-IN')}`,
    cadence: 'month',
    helper: 'Billed monthly',
  };
};

const getDueNotice = (subscription?: SubscriptionInfo | null) => {
  if (!subscription?.endsAt || !subscription?.nextDueAt) return null;

  const now = new Date();
  const end = new Date(subscription.endsAt);
  const nextDue = new Date(subscription.nextDueAt);
  const daysToEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const daysToNextDue = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (subscription.status === 'EXPIRED' || daysToNextDue <= 0) {
    return {
      tone: 'rose' as const,
      title: 'Subscription expired',
      message: 'Access is restricted until the school subscription is renewed.',
    };
  }

  if (daysToEnd <= 0 && daysToNextDue > 0) {
    return {
      tone: 'amber' as const,
      title: 'Grace period active',
      message: `Renew by ${formatDate(subscription.nextDueAt)} to avoid suspension.`,
    };
  }

  if (daysToEnd <= 7) {
    return {
      tone: 'blue' as const,
      title: 'Renewal approaching',
      message: `The current period ends on ${formatDate(subscription.endsAt)}.`,
    };
  }

  return null;
};

const isSubscriptionExpired = (subscription?: SubscriptionInfo | null) => {
  if (!subscription) return false;
  const now = new Date();
  const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
  const nextDueAt = subscription.nextDueAt ? new Date(subscription.nextDueAt) : null;
  if (subscription.status === 'EXPIRED') return true;
  if (nextDueAt && !Number.isNaN(nextDueAt.getTime()) && nextDueAt < now) return true;
  if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return true;
  return false;
};

function Icon({ path }: { path: ReactNode }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: NoticeTone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1 ${toneClasses[tone].badge}`}>
      {label}
    </span>
  );
}

function BillingToggle({ billingCycle, onChange }: { billingCycle: BillingCycle; onChange: (cycle: BillingCycle) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-1" role="group" aria-label="Billing cycle">
      {(['MONTHLY', 'ANNUAL'] as const).map((cycle) => {
        const active = billingCycle === cycle;
        return (
          <button
            key={cycle}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(cycle)}
            className={[
              'inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-black transition',
              active ? 'bg-[var(--shell-card)] text-[var(--shell-text)] shadow-sm' : 'text-[var(--shell-muted)] hover:text-[var(--shell-text)]',
            ].join(' ')}
          >
            {cycle === 'MONTHLY' ? 'Monthly' : 'Annual'}
            {cycle === 'ANNUAL' ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                Save 10%
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SummaryMetric({ label, value, helper, tone, icon }: { label: string; value: ReactNode; helper: string; tone: NoticeTone; icon: ReactNode }) {
  return (
    <article className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone].icon}`}>
          {icon}
        </span>
        <span className="text-right text-[11px] font-bold uppercase text-[var(--shell-muted)]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-black text-[var(--shell-text)]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">{helper}</p>
    </article>
  );
}

function DueNotice({ notice }: { notice: NonNullable<ReturnType<typeof getDueNotice>> }) {
  const tone = toneClasses[notice.tone];
  return (
    <section className={`rounded-xl border px-4 py-3 ${tone.panel}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
            <Icon path={<path d="M12 9v4" />} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-[var(--shell-text)]">{notice.title}</p>
            <p className="mt-1 text-sm leading-5 text-[var(--shell-muted)]">{notice.message}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${tone.badge}`}>
          Action needed
        </span>
      </div>
    </section>
  );
}

function CurrentPlanOverview({
  subscription,
  currentPlan,
  billingCycle,
}: {
  subscription?: SubscriptionInfo | null;
  currentPlan?: SubscriptionPlan | null;
  billingCycle: BillingCycle;
}) {
  const planName = subscription?.planName ?? currentPlan?.name ?? 'No plan selected';
  const price = currentPlan ? getPriceParts(currentPlan, billingCycle) : null;
  const tone = statusTone(subscription?.status);

  return (
    <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase text-[var(--shell-muted)]">Current subscription</p>
            <StatusBadge label={formatStatus(subscription?.status)} tone={tone} />
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--shell-text)]">{planName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--shell-muted)]">
            {subscription
              ? `Billing is ${formatStatus(subscription.billingCycle)} with renewal due ${formatDate(subscription.nextDueAt)}.`
              : 'Choose a plan below to activate this school workspace.'}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-4 py-3 text-left lg:min-w-52">
          <p className="text-xs font-black uppercase text-[var(--shell-muted)]">Selected cycle</p>
          <p className="mt-1 text-2xl font-black text-[var(--shell-text)]">{price?.amount ?? 'Pending'}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--shell-muted)]">{price?.cadence ? `per ${price.cadence}` : 'Select a paid plan'}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LimitPill label="Students" value={subscription?.studentLimit ?? currentPlan?.studentLimit ?? 0} tone="blue" />
        <LimitPill label="Teachers" value={subscription?.teacherLimit ?? currentPlan?.teacherLimit ?? 0} tone="emerald" />
        <LimitPill label="Started" value={formatDate(subscription?.startsAt)} tone="slate" />
        <LimitPill label="Next Due" value={formatDate(subscription?.nextDueAt)} tone="amber" />
      </div>
    </section>
  );
}

function LimitPill({ label, value, tone }: { label: string; value: ReactNode; tone: NoticeTone }) {
  return (
    <div className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-3">
      <p className="text-xs font-black uppercase text-[var(--shell-muted)]">{label}</p>
      <p className={`mt-1 text-lg font-black ${toneClasses[tone].text}`}>{typeof value === 'number' ? formatNumber(value) : value}</p>
    </div>
  );
}

function PlanCard({
  plan,
  billingCycle,
  isCurrent,
  isRecommended,
  canRenewCurrent,
  isPending,
  onSelect,
}: {
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  isCurrent: boolean;
  isRecommended: boolean;
  canRenewCurrent: boolean;
  isPending: boolean;
  onSelect: (planId: string) => void;
}) {
  const price = getPriceParts(plan, billingCycle);
  const features = plan.features?.length ? plan.features : ['Core academic management'];
  const visibleFeatures = features.slice(0, 6);
  const buttonDisabled = isPending;
  const tone: NoticeTone = isCurrent ? 'emerald' : isRecommended ? 'blue' : 'slate';

  return (
    <article className={[
      'relative flex min-h-[34rem] flex-col rounded-xl border bg-[var(--shell-card)] p-5 shadow-sm transition',
      isCurrent ? 'border-emerald-300 ring-2 ring-emerald-100' : isRecommended ? 'border-blue-300 ring-2 ring-blue-100' : 'border-[var(--shell-border)] hover:border-slate-300 hover:shadow-md',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-[var(--shell-muted)]">Plan</p>
          <h3 className="mt-2 truncate text-2xl font-black text-[var(--shell-text)]">{plan.name}</h3>
        </div>
        {isCurrent ? <StatusBadge label={canRenewCurrent ? 'Renew due' : 'Current'} tone="emerald" /> : null}
        {!isCurrent && isRecommended ? <StatusBadge label="Recommended" tone="blue" /> : null}
      </div>

      <div className="mt-6">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-black tracking-tight text-[var(--shell-text)]">{price.amount}</span>
          {price.cadence ? <span className="pb-1 text-sm font-bold text-[var(--shell-muted)]">/ {price.cadence}</span> : null}
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--shell-muted)]">{price.helper}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <LimitPill label="Students" value={plan.studentLimit} tone="blue" />
        <LimitPill label="Teachers" value={plan.teacherLimit} tone="emerald" />
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {visibleFeatures.map((feature) => (
          <li key={feature} className="flex gap-3 text-sm leading-5 text-[var(--shell-muted)]">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${toneClasses[tone].badge}`}>
              <Icon path={<path d="m7 12 3 3 7-7" />} />
            </span>
            <span>{feature}</span>
          </li>
        ))}
        {features.length > visibleFeatures.length ? (
          <li className="text-sm font-bold text-[var(--shell-muted)]">+{features.length - visibleFeatures.length} more included</li>
        ) : null}
      </ul>

      <button
        type="button"
        disabled={buttonDisabled}
        onClick={() => onSelect(plan.id)}
        className={[
          'mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60',
          isCurrent && !canRenewCurrent ? 'border border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-muted)]' : toneClasses[tone].button,
        ].join(' ')}
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Icon path={isCurrent && !canRenewCurrent ? <path d="M12 5v14M5 12h14" /> : <path d="M5 12h14" />} />
        )}
        {isPending ? 'Opening payment' : isCurrent ? 'Renew plan' : 'Select plan'}
      </button>
    </article>
  );
}

function EmptyPlans() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center">
      <p className="text-base font-black text-[var(--shell-text)]">No active plans found</p>
      <p className="mt-2 text-sm text-[var(--shell-muted)]">Ask the platform administrator to publish at least one active subscription plan.</p>
    </div>
  );
}

export default function PlansPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const schoolId = session?.schoolId ?? undefined;
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['active-plans'],
    queryFn: () => listActivePlans(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', schoolId],
    queryFn: () => getSubscription(schoolId),
    enabled: Boolean(schoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const currentPlanId = subscription?.planId ?? plans?.find((p) => p.name === subscription?.planName)?.id ?? null;
  const currentPlan = plans?.find((plan) => plan.id === currentPlanId) ?? null;

  const checkoutMutation = useMutation({
    mutationFn: createSubscriptionCheckout,
  });
  const verifyMutation = useMutation({
    mutationFn: verifySubscriptionCheckout,
  });

  const requestPlanChange = async (planId: string) => {
    const plan = plans?.find((item) => item.id === planId);
    if (!schoolId) {
      notify.error('Payment unavailable', 'School context was not found for this session.');
      return;
    }

    setPendingPlanId(planId);
    try {
      await loadRazorpayCheckout();
      const checkout = await checkoutMutation.mutateAsync({ planId, billingCycle });
      const payment = await openRazorpayCheckout(checkout, session);
      const result = await verifyMutation.mutateAsync({
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });

      notify.success('Payment successful', result.message || `${plan?.name ?? 'Selected plan'} is now active.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['subscription'] }),
        queryClient.invalidateQueries({ queryKey: ['subscription', schoolId] }),
        queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] }),
        queryClient.invalidateQueries({ queryKey: ['subscription-lifecycle-summary'] }),
      ]);
    } catch (error) {
      const message = errorMessage(error, 'Unable to complete payment.');
      if (message.toLowerCase().includes('cancelled')) {
        notify.info('Payment cancelled', 'No changes were made to the subscription.');
      } else {
        notify.error('Payment failed', message);
      }
    } finally {
      setPendingPlanId(null);
    }
  };

  const planCards = useMemo(() => plans ?? [], [plans]);
  const dueNotice = useMemo(() => getDueNotice(subscription), [subscription]);
  const canRenewCurrent = useMemo(() => isSubscriptionExpired(subscription), [subscription]);
  const isBusy = plansLoading || subLoading;
  const recommendedPlanId = planCards.length ? planCards[Math.min(1, planCards.length - 1)]?.id : null;

  return (
    <div className="min-h-screen bg-[var(--shell-bg)]">
      {isBusy ? <FullPageLoader label="Loading plans..." /> : null}

      <DashboardPageContainer maxWidthClassName="max-w-7xl" className="space-y-5">
        <PageHeader
          title="Plans"
          subtitle="Review the current subscription, compare capacity limits, and choose the plan that fits this school."
          actions={<BillingToggle billingCycle={billingCycle} onChange={setBillingCycle} />}
        />

        {dueNotice ? <DueNotice notice={dueNotice} /> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
          <CurrentPlanOverview subscription={subscription} currentPlan={currentPlan} billingCycle={billingCycle} />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <SummaryMetric
              label="Current plan"
              value={subscription?.planName ?? 'None'}
              helper={formatStatus(subscription?.status)}
              tone={statusTone(subscription?.status)}
              icon={<Icon path={<path d="M4 7h16M4 12h16M4 17h10" />} />}
            />
            <SummaryMetric
              label="Student capacity"
              value={formatNumber(subscription?.studentLimit)}
              helper="Allowed student records"
              tone="blue"
              icon={<Icon path={<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />} />}
            />
            <SummaryMetric
              label="Teacher capacity"
              value={formatNumber(subscription?.teacherLimit)}
              helper="Allowed staff teachers"
              tone="emerald"
              icon={<Icon path={<path d="M12 3v12M5 8h14M7 21h10" />} />}
            />
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase text-[var(--shell-muted)]">Plan comparison</p>
              <h2 className="mt-1 text-xl font-black text-[var(--shell-text)]">Available subscription plans</h2>
            </div>
            <p className="max-w-xl text-sm leading-5 text-[var(--shell-muted)]">
              Annual billing applies a 10% discount and renews the school for a full year.
            </p>
          </div>

          {planCards.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {planCards.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  isCurrent={currentPlanId === plan.id}
                  isRecommended={recommendedPlanId === plan.id}
                  canRenewCurrent={currentPlanId === plan.id && canRenewCurrent}
                  isPending={pendingPlanId === plan.id}
                  onSelect={requestPlanChange}
                />
              ))}
            </div>
          ) : (
            <EmptyPlans />
          )}
        </section>

        <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-base font-black text-[var(--shell-text)]">Need a custom limit?</p>
              <p className="mt-1 text-sm text-[var(--shell-muted)]">Platform admins can adjust school limits and module access from the subscriptions console.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['No setup fee', 'Plan modules controlled by admin', 'Renew anytime'].map((item) => (
                <span key={item} className="rounded-full bg-[var(--shell-subtle)] px-3 py-1 text-xs font-black text-[var(--shell-muted)] ring-1 ring-[var(--shell-border)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </DashboardPageContainer>
    </div>
  );
}
