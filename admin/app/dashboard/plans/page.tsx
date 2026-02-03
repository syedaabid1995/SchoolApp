'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../services/auth.service';
import { getSubscription, listActivePlans, upsertSubscription } from '../../../services/subscription.service';
import { useNotify } from '../../../components/NotificationProvider';
import FullPageLoader from '../../../components/FullPageLoader';

export default function PlansPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const router = useRouter();
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['active-plans'],
    queryFn: () => listActivePlans(),
  });

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', schoolId],
    queryFn: () => getSubscription(schoolId),
    enabled: Boolean(schoolId),
  });

  const currentPlanId = subscription?.planId ?? plans?.find((p) => p.name === subscription?.planName)?.id ?? null;

  const upgradeMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = plans?.find((item) => item.id === planId);
      if (!plan || !schoolId) throw new Error('Plan not found');
      const paidAt = new Date().toISOString();
      return upsertSubscription({
        schoolId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: paidAt,
        paidAt,
        billingCycle,
        discountPercent: billingCycle === 'ANNUAL' ? 10 : 0,
        graceDays: 15,
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
    },
    onSuccess: () => {
      notify.success('Plan updated', 'Your subscription plan has been updated.');
      queryClient.invalidateQueries({ queryKey: ['subscription', schoolId] });
      fetch('/api/auth/refresh', { method: 'POST' })
        .catch(() => null)
        .finally(() => {
          router.replace('/dashboard');
        });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update plan';
      notify.error('Update failed', message);
    },
  });

  const isBusy = plansLoading || subLoading || upgradeMutation.isPending;

  const planCards = useMemo(() => plans ?? [], [plans]);
  const formatPrice = (plan: { priceCents: number }) => {
    const baseMonthly = plan.priceCents;
    if (billingCycle === 'ANNUAL') {
      const annual = Math.round(baseMonthly * 12 * 0.9);
      return `₹${Math.round(annual / 100)}/yr`;
    }
    return baseMonthly === 0 ? 'Free' : `₹${Math.round(baseMonthly / 100)}/mo`;
  };
  const dueMessage = useMemo(() => {
    if (!subscription?.endsAt || !subscription?.nextDueAt) return null;
    const now = new Date();
    const end = new Date(subscription.endsAt);
    const nextDue = new Date(subscription.nextDueAt);
    const daysToEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysToNextDue = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (subscription.status === 'EXPIRED' || daysToNextDue <= 0) {
      return {
        type: 'error' as const,
        message: `Your subscription has expired. Access is suspended. Please update your plan immediately.`
      };
    }
    
    if (daysToEnd <= 0 && daysToNextDue > 0) {
      return {
        type: 'warning' as const,
        message: `Your subscription ended on ${end.toLocaleDateString()}. You have ${daysToNextDue} days remaining in your grace period. Please renew by ${nextDue.toLocaleDateString()} to avoid suspension.`
      };
    }
    
    if (daysToEnd <= 7) {
      return {
        type: 'info' as const,
        message: `Your subscription expires on ${end.toLocaleDateString()} (${daysToEnd} days remaining). Please renew to avoid interruption.`
      };
    }
    
    return null;
  }, [subscription]);
  const isSubscriptionExpired = useMemo(() => {
    if (!subscription) return false;
    const now = new Date();
    const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;
    const nextDueAt = subscription.nextDueAt ? new Date(subscription.nextDueAt) : null;
    if (subscription.status === 'EXPIRED') return true;
    if (nextDueAt && !Number.isNaN(nextDueAt.getTime()) && nextDueAt < now) return true;
    if (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now) return true;
    return false;
  }, [subscription]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      {isBusy ? <FullPageLoader label="Loading plans..." /> : null}
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Subscription Management
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Choose Your Perfect Plan
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-blue-100">
            Scale your school management with flexible plans designed to grow with your institution. 
            Upgrade anytime to unlock advanced features and increased capacity.
          </p>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/4 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Current Plan Section */}
        <div className="mb-12">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Your Current Plan</h2>
            <p className="text-gray-600">Monitor your subscription status and usage</p>
          </div>
          
          <div className="mx-auto max-w-2xl">
            <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="text-sm font-medium opacity-90">Active Plan</p>
                    <p className="text-2xl font-bold">{subscription?.planName ?? 'No Plan'}</p>
                  </div>
                  <div className="rounded-full bg-white/20 px-3 py-1 text-sm font-semibold backdrop-blur-sm">
                    {subscription?.status ?? 'Inactive'}
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{subscription?.studentLimit ?? 0}</p>
                    <p className="text-sm text-gray-600">Students</p>
                  </div>
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                      <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{subscription?.teacherLimit ?? 0}</p>
                    <p className="text-sm text-gray-600">Teachers</p>
                  </div>
                </div>
                
                {dueMessage && (
                  <div className={`mt-6 rounded-xl border p-4 ${
                    dueMessage.type === 'error' 
                      ? 'border-red-200 bg-gradient-to-r from-red-50 to-red-100'
                      : dueMessage.type === 'warning'
                      ? 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50'
                      : 'border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50'
                  }`}>
                    <div className="flex items-start">
                      <svg className={`mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ${
                        dueMessage.type === 'error'
                          ? 'text-red-600'
                          : dueMessage.type === 'warning'
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`} fill="currentColor" viewBox="0 0 20 20">
                        {dueMessage.type === 'error' ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        )}
                      </svg>
                      <div>
                        <h4 className={`font-semibold ${
                          dueMessage.type === 'error'
                            ? 'text-red-900'
                            : dueMessage.type === 'warning'
                            ? 'text-amber-900'
                            : 'text-blue-900'
                        }`}>
                          {dueMessage.type === 'error' ? 'Subscription Expired' : dueMessage.type === 'warning' ? 'Payment Overdue' : 'Renewal Reminder'}
                        </h4>
                        <p className={`mt-1 text-sm ${
                          dueMessage.type === 'error'
                            ? 'text-red-800'
                            : dueMessage.type === 'warning'
                            ? 'text-amber-800'
                            : 'text-blue-800'
                        }`}>{dueMessage.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="mb-8 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900">Available Plans</h2>
          <p className="mb-8 text-gray-600">Choose the plan that best fits your school's needs</p>
          
          <div className="inline-flex items-center rounded-full bg-white p-1 shadow-lg ring-1 ring-gray-200">
            <button
              className={`relative rounded-full px-6 py-2 text-sm font-semibold transition-all duration-200 ${
                billingCycle === 'MONTHLY'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setBillingCycle('MONTHLY')}
            >
              Monthly
            </button>
            <button
              className={`relative rounded-full px-6 py-2 text-sm font-semibold transition-all duration-200 ${
                billingCycle === 'ANNUAL'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setBillingCycle('ANNUAL')}
            >
              Annual
              <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                Save 10%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {planCards.map((plan, index) => {
            const isCurrent = currentPlanId === plan.id;
            const canRenewCurrent = isCurrent && isSubscriptionExpired;
            const isPopular = index === 1; // Middle plan is popular
            
            return (
              <div
                key={plan.id}
                className={`relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-105 ${
                  isCurrent
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 ring-2 ring-emerald-500 shadow-xl'
                    : isPopular
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 ring-2 ring-blue-500 shadow-xl'
                    : 'bg-white shadow-lg ring-1 ring-gray-200 hover:shadow-xl'
                }`}
              >
                {isPopular && !isCurrent && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 transform">
                    <div className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </div>
                  </div>
                )}
                
                {isCurrent && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 transform">
                    <div className="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1 text-xs font-semibold text-white">
                      {canRenewCurrent ? 'Expired Plan' : 'Current Plan'}
                    </div>
                  </div>
                )}

                <div className="p-8">
                  <div className="mb-6 text-center">
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900">{formatPrice(plan).split('/')[0]}</span>
                      {formatPrice(plan) !== 'Free' && (
                        <span className="text-gray-600">/{formatPrice(plan).split('/')[1]}</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-2 gap-4 text-center">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-2xl font-bold text-blue-600">{plan.studentLimit}</p>
                      <p className="text-sm text-gray-600">Students</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-2xl font-bold text-purple-600">{plan.teacherLimit}</p>
                      <p className="text-sm text-gray-600">Teachers</p>
                    </div>
                  </div>

                  <ul className="mb-8 space-y-3">
                    {(plan.features?.length ? plan.features : ['Core academic features']).map((feature) => (
                      <li key={feature} className="flex items-center text-sm text-gray-700">
                        <svg className="mr-3 h-5 w-5 flex-shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full rounded-xl px-6 py-3 font-semibold transition-all duration-200 ${
                      isCurrent && !canRenewCurrent
                        ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                        : isPopular
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                        : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
                    }`}
                    disabled={(isCurrent && !canRenewCurrent) || upgradeMutation.isPending}
                    onClick={() => upgradeMutation.mutate(plan.id)}
                  >
                    {canRenewCurrent ? (
                      <span className="flex items-center justify-center">
                        Renew Plan
                      </span>
                    ) : isCurrent ? (
                      <span className="flex items-center justify-center">
                        <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Current Plan
                      </span>
                    ) : upgradeMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </span>
                    ) : (
                      'Upgrade Plan'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Need Help Choosing?</h3>
            <p className="mb-6 text-gray-600">
              Our team is here to help you find the perfect plan for your school. 
              Contact us for personalized recommendations and custom enterprise solutions.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center text-sm text-gray-600">
                <svg className="mr-2 h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free migration support
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <svg className="mr-2 h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                24/7 customer support
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <svg className="mr-2 h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No setup fees
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
