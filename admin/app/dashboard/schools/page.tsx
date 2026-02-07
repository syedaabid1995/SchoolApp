'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  listSchools,
  createSchool,
  activateSchool,
  suspendSchool,
  deleteSchool,
} from '../../../services/school.service';
import { listSubscriptionPlans, upsertSubscription } from '../../../services/subscription.service';
import { useNotify } from '../../../components/NotificationProvider';
import FullPageLoader from '../../../components/FullPageLoader';

export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    subscriptionPlan: 'STANDARD',
    adminEmail: '',
  });
  const [isCodeAuto, setIsCodeAuto] = useState(true);
  const [createdAdmin, setCreatedAdmin] = useState<{
    email: string;
    tempPassword: string;
    manualShareRequired?: boolean;
    manualShareUrl?: string | null;
  } | null>(null);
  const [formError, setFormError] = useState('');
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ['schools', debouncedQuery],
    queryFn: () => listSchools({ query: debouncedQuery }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: totalData } = useQuery({
    queryKey: ['schools-total'],
    queryFn: () => listSchools({ page: 1, limit: 1 }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const activePlans = plans?.filter((plan) => plan.status === 'ACTIVE') ?? [];


  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: (result) => {
      setForm({ name: '', code: '', subscriptionPlan: 'STANDARD', adminEmail: '' });
      if (result.adminUser && result.tempPassword) {
        setCreatedAdmin({
          email: result.adminUser.email,
          tempPassword: result.tempPassword,
          manualShareRequired: result.manualShareRequired,
          manualShareUrl: result.manualShareUrl,
        });
        notify.success('School created successfully!', `${form.name} has been created with admin account`);
      } else {
        setCreatedAdmin(null);
        notify.success('School created!', `${form.name} has been created successfully`);
      }
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create school';
      notify.error('School creation failed', message);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'activate' | 'suspend' | 'delete' }) => {
      if (payload.action === 'activate') return activateSchool(payload.id);
      if (payload.action === 'suspend') return suspendSchool(payload.id);
      return deleteSchool(payload.id);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      const actionText = variables.action === 'activate' ? 'activated' : variables.action === 'suspend' ? 'suspended' : 'deleted';
      notify.success(`School ${actionText}!`, `School has been ${actionText} successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to process school action';
      notify.error('Action failed', message);
    },
  });

  const planUpdateMutation = useMutation({
    mutationFn: async (payload: { schoolId: string; planId: string }) => {
      const plan = plans?.find((item) => item.id === payload.planId);
      if (!plan) {
        throw new Error('Plan not found');
      }
      return upsertSubscription({
        schoolId: payload.schoolId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      notify.success('Plan updated', 'Subscription plan updated for school');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update plan';
      notify.error('Plan update failed', message);
    },
  });

  const testExpiryMutation = useMutation({
    mutationFn: async (payload: { schoolId: string; endsAt: string }) => {
      const school = rows.find((item) => item.id === payload.schoolId);
      if (!school) throw new Error('School not found');
      const plan = plans?.find((item) => item.name === school.subscriptionPlan);
      if (!plan) throw new Error('Plan not found for this school');
      const endsAt = new Date(`${payload.endsAt}T23:59:59`);
      if (Number.isNaN(endsAt.getTime())) throw new Error('Invalid expiry date');
      return upsertSubscription({
        schoolId: payload.schoolId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        endsAt: endsAt.toISOString(),
        paidAt: new Date().toISOString(),
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
    },
    onSuccess: (_, variables) => {
      notify.success('Expiry date updated', 'Test subscription expiry date saved');
      setExpiryDates((prev) => ({ ...prev, [variables.schoolId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to set expiry date';
      notify.error('Expiry update failed', message);
    },
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const totalSchools = totalData?.total ?? data?.total ?? 0;
  const isBusy =
    isLoading ||
    createMutation.isPending ||
    actionMutation.isPending ||
    planUpdateMutation.isPending ||
    testExpiryMutation.isPending;

  const buildSchoolCode = (name: string, nextIndex: number) => {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3);
    if (!prefix) return '';
    const suffix = String(nextIndex).padStart(5, '0');
    return `${prefix}_${suffix}`;
  };

  useEffect(() => {
    if (!isCodeAuto) return;
    const nextIndex = totalSchools + 1;
    const generated = buildSchoolCode(form.name, nextIndex);
    if (!generated) return;
    setForm((prev) => ({ ...prev, code: generated }));
  }, [form.name, totalSchools, isCodeAuto]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-6">
      {isBusy ? <FullPageLoader label="Loading schools..." /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative">
            <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Schools
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Schools</h1>
            <p className="mt-2 text-purple-100">Manage tenant lifecycle, status, and subscription visibility.</p>
          </div>
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        </div>

        {/* Create School Section */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 p-3">
              <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create School</h2>
              <p className="text-sm text-gray-500">Add a new school with admin account</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value.toUpperCase() });
                if (!isCodeAuto && !form.code) setIsCodeAuto(true);
              }}
              placeholder="School name"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <input
              value={form.code}
              onChange={(e) => {
                setIsCodeAuto(false);
                setForm({ ...form, code: e.target.value.toUpperCase() });
              }}
              placeholder="School code"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <select
              value={form.subscriptionPlan}
              onChange={(e) =>
                setForm({
                  ...form,
                  subscriptionPlan: e.target.value,
                })
              }
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {activePlans.length ? (
                activePlans.map((plan) => (
                  <option key={plan.id} value={plan.name}>
                    {plan.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="STARTER">Starter</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                </>
              )}
            </select>
            <input
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              placeholder="Admin email"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <button
            className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
            onClick={() => {
              const trimmedName = form.name.trim();
              const trimmedCode = form.code.trim();
              const trimmedEmail = form.adminEmail.trim();
              let error = '';
              if (!trimmedName) error = 'School name is required.';
              else if (!trimmedCode) error = 'School code is required.';
              else if (!trimmedEmail) error = 'Admin email is required.';
              setFormError(error);
              if (error) {
                notify.error('Validation error', error);
                return;
              }
              createMutation.mutate({
                ...form,
                name: trimmedName,
                code: trimmedCode,
                adminEmail: trimmedEmail,
              });
            }}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create School
              </>
            )}
          </button>
          {formError ? <p className="mt-3 text-sm font-semibold text-rose-600">{formError}</p> : null}
          {createdAdmin ? (
            <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-emerald-500 p-2">
                  <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="font-bold text-emerald-900">School admin created successfully!</div>
              </div>
              <div className="space-y-2 text-sm text-emerald-900">
                <div><span className="font-semibold">Email:</span> {createdAdmin.email}</div>
                <div><span className="font-semibold">Temporary password:</span> <code className="rounded bg-emerald-100 px-2 py-1 font-mono">{createdAdmin.tempPassword}</code></div>
              </div>
              {createdAdmin.manualShareUrl ? (
                <a
                  href={createdAdmin.manualShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Share via WhatsApp
                </a>
              ) : null}
              <div className="mt-3 text-xs font-medium text-emerald-700">
                ⚠️ Share this information once. It will not be shown again.
              </div>
            </div>
          ) : null}
        </section>

        {/* School Directory */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">School Directory</h2>
                <p className="text-sm text-gray-500">{rows.length} schools registered</p>
              </div>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools..."
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Plan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Test Expiry</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-2 text-sm">Loading schools...</p>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-gray-600">No schools found</p>
                        <p className="text-xs text-gray-500">Create your first school above</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold">
                            {school.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3 text-sm font-medium text-gray-900">{school.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{school.code}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          aria-pressed={school.status === 'ACTIVE'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            school.status === 'ACTIVE' ? 'bg-emerald-500 focus:ring-emerald-500' : 'bg-rose-500 focus:ring-rose-500'
                          }`}
                          onClick={() =>
                            actionMutation.mutate({
                              id: school.id,
                              action: school.status === 'ACTIVE' ? 'suspend' : 'activate',
                            })
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              school.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={plans?.find((plan) => plan.name === school.subscriptionPlan)?.id ?? ''}
                          onChange={(e) =>
                            planUpdateMutation.mutate({ schoolId: school.id, planId: e.target.value })
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="">Select plan</option>
                          {activePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={expiryDates[school.id] ?? ''}
                            onChange={(e) =>
                              setExpiryDates((prev) => ({ ...prev, [school.id]: e.target.value }))
                            }
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          />
                          <button
                            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            disabled={!expiryDates[school.id]}
                            onClick={() =>
                              testExpiryMutation.mutate({
                                schoolId: school.id,
                                endsAt: expiryDates[school.id],
                              })
                            }
                          >
                            Set
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/schools/${school.id}/admins`}
                            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Admins
                          </Link>
                          <button
                            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                            onClick={() =>
                              actionMutation.mutate({
                                id: school.id,
                                action: 'delete',
                              })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
