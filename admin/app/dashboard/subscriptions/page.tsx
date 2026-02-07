'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSubscriptionPlans,
  upsertSubscription,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  listPlanSchools,
  getPlanPermissions,
  updatePlanPermissions,
} from '../../../services/subscription.service';
import { useNotify } from '../../../components/NotificationProvider';
import FullPageLoader from '../../../components/FullPageLoader';

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    priceCents: 0,
    features: '',
    studentLimit: 500,
    teacherLimit: 50,
    status: 'ACTIVE',
  });
  const [planBlocker, setPlanBlocker] = useState<{
    open: boolean;
    planId: string;
    planName: string;
    schools: { id: string; name: string; code: string; status: string; subscriptionPlan: string }[];
    mode: 'disable' | 'delete';
  }>({ open: false, planId: '', planName: '', schools: [], mode: 'disable' });
  const [planMoves, setPlanMoves] = useState<Record<string, string>>({});
  const [planLoading, setPlanLoading] = useState(false);
  const [permissionEditor, setPermissionEditor] = useState<{
    open: boolean;
    planId: string;
    planName: string;
  }>({ open: false, planId: '', planName: '' });
  const [planPermissionCodes, setPlanPermissionCodes] = useState<string[]>([]);
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data: planPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['subscription-plan-permissions', permissionEditor.planId],
    queryFn: () => getPlanPermissions(permissionEditor.planId),
    enabled: Boolean(permissionEditor.planId),
    refetchOnWindowFocus: false,
  });

  const permissionsMutation = useMutation({
    mutationFn: () => updatePlanPermissions(permissionEditor.planId, planPermissionCodes),
    onSuccess: () => {
      notify.success('Plan access updated', 'Navigation access controls saved.');
      queryClient.invalidateQueries({ queryKey: ['subscription-plan-permissions', permissionEditor.planId] });
      setPermissionEditor({ open: false, planId: '', planName: '' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update plan access';
      notify.error('Update failed', message);
    },
  });

  useEffect(() => {
    if (!planPermissions) return;
    setPlanPermissionCodes(
      planPermissions.permissions.filter((permission) => permission.enabled).map((permission) => permission.code),
    );
  }, [planPermissions]);

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!planForm.name.trim()) throw new Error('Plan name is required');
      if (planForm.id) {
        const updated = await updateSubscriptionPlan(planForm.id, {
          name: planForm.name.trim(),
          status: planForm.status,
          priceCents: Number(planForm.priceCents),
          features: planForm.features
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          studentLimit: Number(planForm.studentLimit),
          teacherLimit: Number(planForm.teacherLimit),
        });
        return { plan: updated, created: false };
      }
      const created = await createSubscriptionPlan({
        name: planForm.name.trim(),
        status: planForm.status,
        priceCents: Number(planForm.priceCents),
        features: planForm.features
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        studentLimit: Number(planForm.studentLimit),
        teacherLimit: Number(planForm.teacherLimit),
      });
      return { plan: created, created: true };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      if (result?.created && result.plan?.id) {
        setPermissionEditor({ open: true, planId: result.plan.id, planName: result.plan.name });
      }
      setPlanForm({
        id: '',
        name: '',
        priceCents: 0,
        features: '',
        studentLimit: 500,
        teacherLimit: 50,
        status: 'ACTIVE',
      });
      notify.success('Plan saved', 'Subscription plan updated successfully');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to save plan';
      notify.error('Plan update failed', message);
    },
  });

  const closeBlocker = () => {
    setPlanBlocker({ open: false, planId: '', planName: '', schools: [], mode: 'disable' });
    setPlanMoves({});
    setPlanLoading(false);
  };
  const isBusy = planMutation.isPending || planLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40 p-6">
      {isBusy ? <FullPageLoader label="Updating plans..." /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative">
            <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Subscriptions
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Subscription Plans</h1>
            <p className="mt-2 text-emerald-100">Manage tenant subscription plans and usage limits.</p>
          </div>
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        </div>

        {/* Create/Edit Plan Section */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 p-3">
              <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{planForm.id ? 'Edit Plan' : 'Create Plan'}</h2>
              <p className="text-sm text-gray-500">Configure subscription plan details and limits</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-6">
            <input
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              placeholder="Plan name"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <input
              type="number"
              min={0}
              value={planForm.priceCents / 100}
              onChange={(e) => setPlanForm({ ...planForm, priceCents: Math.round(Number(e.target.value) * 100) })}
              placeholder="Amount (₹)"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <input
              value={planForm.features}
              onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
              placeholder="Features (comma separated)"
              className="md:col-span-2 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <input
              type="number"
              min={1}
              value={planForm.studentLimit}
              onChange={(e) => setPlanForm({ ...planForm, studentLimit: Number(e.target.value) })}
              placeholder="Student limit"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <input
              type="number"
              min={1}
              value={planForm.teacherLimit}
              onChange={(e) => setPlanForm({ ...planForm, teacherLimit: Number(e.target.value) })}
              placeholder="Teacher limit"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <select
              value={planForm.status}
              onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
              className="md:col-span-2 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button
              className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl disabled:opacity-50"
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending}
            >
              {planMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {planForm.id ? 'Update Plan' : 'Create Plan'}
                </>
              )}
            </button>
          </div>
        </section>

        {/* Plans Directory */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Plans Directory</h2>
              <p className="text-sm text-gray-500">{plans?.length ?? 0} plans configured</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Features</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Student Limit</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Teacher Limit</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Access</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {plans?.length ? (
                  plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold">
                            {plan.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3 text-sm font-medium text-gray-900">{plan.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          aria-pressed={plan.status === 'ACTIVE'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            plan.status === 'ACTIVE' ? 'bg-emerald-500 focus:ring-emerald-500' : 'bg-rose-500 focus:ring-rose-500'
                          }`}
                          onClick={() =>
                            (async () => {
                              if (plan.status === 'ACTIVE') {
                                setPlanLoading(true);
                                try {
                                  const result = await listPlanSchools(plan.id);
                                  if (result.items.length > 0) {
                                    setPlanBlocker({
                                      open: true,
                                      planId: plan.id,
                                      planName: plan.name,
                                      schools: result.items,
                                      mode: 'disable',
                                    });
                                  } else {
                                    await updateSubscriptionPlan(plan.id, { status: 'INACTIVE' });
                                    queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                                  }
                                } catch (error: any) {
                                  const message =
                                    error?.response?.data?.error?.message || error?.message || 'Failed to update status';
                                  notify.error('Status update failed', message);
                                } finally {
                                  setPlanLoading(false);
                                }
                                return;
                              }
                              updateSubscriptionPlan(plan.id, {
                                status: 'ACTIVE',
                              })
                                .then(() => {
                                  queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                                })
                                .catch((error: any) => {
                                  const message =
                                    error?.response?.data?.error?.message || error?.message || 'Failed to update status';
                                  notify.error('Status update failed', message);
                                });
                            })()
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              plan.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">₹{(plan.priceCents / 100).toFixed(0)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[240px] truncate">{plan.features?.length ? plan.features.join(', ') : '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{plan.studentLimit}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{plan.teacherLimit}</td>
                      <td className="px-6 py-4">
                        <button
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                          onClick={() => setPermissionEditor({ open: true, planId: plan.id, planName: plan.name })}
                        >
                          Configure
                        </button>
                      </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        onClick={() =>
                          setPlanForm({
                            id: plan.id,
                            name: plan.name,
                            priceCents: plan.priceCents ?? 0,
                            features: plan.features?.join(', ') ?? '',
                            studentLimit: plan.studentLimit,
                            teacherLimit: plan.teacherLimit,
                            status: plan.status,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="ml-2 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        onClick={async () => {
                          setPlanLoading(true);
                          try {
                            const result = await listPlanSchools(plan.id);
                            if (result.items.length > 0) {
                              setPlanBlocker({
                                open: true,
                                planId: plan.id,
                                planName: plan.name,
                                schools: result.items,
                                mode: 'delete',
                              });
                            } else {
                              await deleteSubscriptionPlan(plan.id);
                              queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                              notify.success('Plan deleted', 'Plan removed successfully');
                            }
                          } catch (error: any) {
                            const message =
                              error?.response?.data?.error?.message || error?.message || 'Failed to delete plan';
                            if (String(message).toLowerCase().includes('plan is in use')) {
                              try {
                                const result = await listPlanSchools(plan.id);
                                if (result.items.length > 0) {
                                  setPlanBlocker({
                                    open: true,
                                    planId: plan.id,
                                    planName: plan.name,
                                    schools: result.items,
                                    mode: 'delete',
                                  });
                                  return;
                                }
                              } catch {
                                // fall through to error toast
                              }
                            }
                            notify.error('Delete failed', message);
                          } finally {
                            setPlanLoading(false);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-gray-600">No plans available</p>
                        <p className="text-xs text-gray-500">Create your first plan above</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {permissionEditor.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Plan Access Controls</h3>
                <p className="text-sm text-gray-500">
                  {permissionEditor.planName} · Select navigation items enabled for this plan.
                </p>
              </div>
              <button
                onClick={() => setPermissionEditor({ open: false, planId: '', planName: '' })}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            {permissionsLoading ? (
              <div className="py-10 text-center text-sm text-gray-500">Loading access controls...</div>
            ) : (
              <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pr-2">
                {Object.entries(
                  planPermissions?.permissions.reduce<Record<string, typeof planPermissions.permissions>>((acc, item) => {
                    if (!acc[item.group]) acc[item.group] = [];
                    acc[item.group].push(item);
                    return acc;
                  }, {}) ?? {},
                ).map(([group, items]) => (
                  <div key={group} className="rounded-xl border border-gray-200">
                    <div className="bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">{group}</div>
                    <div className="divide-y divide-gray-100">
                      {items.map((permission) => {
                        const enabled = planPermissionCodes.includes(permission.code);
                        return (
                          <label key={permission.code} className="flex items-center justify-between px-4 py-3 text-sm">
                            <div>
                              <p className="font-medium text-gray-800">{permission.label}</p>
                              <p className="text-xs text-gray-500">{permission.path}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPlanPermissionCodes((prev) =>
                                  prev.includes(permission.code)
                                    ? prev.filter((code) => code !== permission.code)
                                    : [...prev, permission.code],
                                )
                              }
                              className={`relative h-6 w-11 rounded-full p-1 transition-all ${
                                enabled ? 'bg-emerald-500' : 'bg-slate-200 border border-slate-300'
                              }`}
                            >
                              <span
                                className={`block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  enabled ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">
                Default is none. Only enabled items will be visible and accessible for schools on this plan.
              </p>
              <button
                type="button"
                onClick={() => permissionsMutation.mutate()}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={permissionsMutation.isPending}
              >
                {permissionsMutation.isPending ? 'Saving...' : 'Save Access'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Plan Blocker Modal */}
      {planBlocker.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-3">
                  <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {planBlocker.mode === 'delete' ? 'Plan in use (delete)' : 'Plan in use'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {planBlocker.planName} is assigned to the following schools. Reassign them before{' '}
                    {planBlocker.mode === 'delete' ? 'deleting' : 'disabling'} this plan.
                  </p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={closeBlocker}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Current Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">New Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {planBlocker.schools.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{school.name}</td>
                      <td className="px-4 py-3 text-gray-600">{school.code}</td>
                      <td className="px-4 py-3 text-gray-600">{school.status}</td>
                      <td className="px-4 py-3 text-gray-600">{school.subscriptionPlan}</td>
                      <td className="px-4 py-3">
                        <select
                          value={planMoves[school.id] ?? ''}
                          onChange={(e) =>
                            setPlanMoves((prev) => ({ ...prev, [school.id]: e.target.value }))
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        >
                          <option value="">Select plan</option>
                          {plans
                            ?.filter((item) => item.status === 'ACTIVE' && item.id !== planBlocker.planId)
                            .map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Assign a new plan to each school to {planBlocker.mode === 'delete' ? 'delete' : 'disable'}{' '}
                {planBlocker.planName}.
              </p>
              <div className="flex gap-2">
                <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={closeBlocker}>
                  Cancel
                </button>
                <button
                  className={`rounded-lg px-6 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50 ${
                    planBlocker.mode === 'delete'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                  }`}
                  disabled={
                    planBlocker.schools.some((school) => !planMoves[school.id]) || planLoading
                  }
                  onClick={async () => {
                    setPlanLoading(true);
                    try {
                      await Promise.all(
                        planBlocker.schools.map((school) =>
                          upsertSubscription({
                            schoolId: school.id,
                            planId: planMoves[school.id],
                            status: 'ACTIVE',
                            startsAt: new Date().toISOString(),
                          }),
                        ),
                      );
                      if (planBlocker.mode === 'delete') {
                        await deleteSubscriptionPlan(planBlocker.planId);
                        notify.success('Plan deleted', 'Schools reassigned and plan deleted');
                      } else {
                        await updateSubscriptionPlan(planBlocker.planId, { status: 'INACTIVE' });
                        notify.success('Plan disabled', 'Schools reassigned and plan disabled');
                      }
                      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                      queryClient.invalidateQueries({ queryKey: ['schools'] });
                      closeBlocker();
                    } catch (error: any) {
                      const message =
                        error?.response?.data?.error?.message ||
                        error?.message ||
                        `Failed to ${planBlocker.mode === 'delete' ? 'delete' : 'disable'} plan`;
                      notify.error('Update failed', message);
                    } finally {
                      setPlanLoading(false);
                    }
                  }}
                >
                  {planBlocker.mode === 'delete' ? 'Delete Plan' : 'Disable Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
