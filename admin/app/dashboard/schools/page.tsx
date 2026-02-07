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
  const isBusy =
    isLoading ||
    createMutation.isPending ||
    actionMutation.isPending ||
    planUpdateMutation.isPending ||
    testExpiryMutation.isPending;

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label="Loading schools..." /> : null}
      <header>
        <h1 className="text-2xl font-semibold text-ink">Schools</h1>
        <p className="text-sm text-slate">Manage tenant lifecycle, status, and subscription visibility.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create School</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="School name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="School code"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={form.subscriptionPlan}
            onChange={(e) =>
              setForm({
                ...form,
                subscriptionPlan: e.target.value,
              })
            }
            className="rounded-lg border border-slate/20 bg-white px-3 py-2 text-sm"
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
            placeholder="Admin email (optional)"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
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
          {createMutation.isPending ? 'Creating...' : 'Create School'}
        </button>
        {formError ? <p className="mt-2 text-sm font-semibold text-rose-600">{formError}</p> : null}
        {createdAdmin ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">School admin created</div>
            <div className="mt-1">Email: {createdAdmin.email}</div>
            <div className="mt-1">Temporary password: {createdAdmin.tempPassword}</div>
            {createdAdmin.manualShareUrl ? (
              <a
                href={createdAdmin.manualShareUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800"
              >
                Share via WhatsApp
              </a>
            ) : null}
            <div className="mt-2 text-xs text-emerald-700">
              Share this once. It will not be shown again.
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">School Directory</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Test Expiry</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate">
                    No schools found.
                  </td>
                </tr>
              ) : (
                rows.map((school) => (
                  <tr key={school.id} className="border-t border-slate/10">
                    <td className="py-3">{school.name}</td>
                    <td>{school.code}</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={school.status === 'ACTIVE'}
                        className={`flex h-6 w-10 items-center rounded-full p-0.5 transition ${
                          school.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        onClick={() =>
                          actionMutation.mutate({
                            id: school.id,
                            action: school.status === 'ACTIVE' ? 'suspend' : 'activate',
                          })
                        }
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-white shadow transition ${
                            school.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td>
                      <select
                        value={plans?.find((plan) => plan.name === school.subscriptionPlan)?.id ?? ''}
                        onChange={(e) =>
                          planUpdateMutation.mutate({ schoolId: school.id, planId: e.target.value })
                        }
                        className="rounded-lg border border-slate/20 bg-white px-3 py-1 text-xs"
                      >
                        <option value="">Select plan</option>
                        {activePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={expiryDates[school.id] ?? ''}
                          onChange={(e) =>
                            setExpiryDates((prev) => ({ ...prev, [school.id]: e.target.value }))
                          }
                          className="rounded-lg border border-slate/20 px-2 py-1 text-xs"
                        />
                        <button
                          className="rounded-lg border border-slate/20 px-2 py-1 text-xs disabled:opacity-50"
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
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/dashboard/schools/${school.id}/admins`}
                          className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        >
                          Admins
                        </Link>
                        <button
                          className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
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
  );
}
