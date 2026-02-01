'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSubscriptionPlans,
  upsertSubscription,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  listPlanSchools,
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
  }>({ open: false, planId: '', planName: '', schools: [] });
  const [planMoves, setPlanMoves] = useState<Record<string, string>>({});
  const [planLoading, setPlanLoading] = useState(false);
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(),
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!planForm.name.trim()) throw new Error('Plan name is required');
      if (planForm.id) {
        return updateSubscriptionPlan(planForm.id, {
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
      }
      return createSubscriptionPlan({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
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
    setPlanBlocker({ open: false, planId: '', planName: '', schools: [] });
    setPlanMoves({});
    setPlanLoading(false);
  };
  const isBusy = planMutation.isPending || planLoading;

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label="Updating plans..." /> : null}
      <header>
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <p className="text-sm text-slate">Review tenant subscription plans and usage limits.</p>
      </header>
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Subscription Plans</h2>
          <span className="text-xs text-slate">Create and manage plan limits for schools.</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <label className="text-xs font-semibold text-slate">
            Plan Name
            <input
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              placeholder="Plan name"
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate">
            Amount (₹)
            <input
              type="number"
              min={0}
              value={planForm.priceCents / 100}
              onChange={(e) => setPlanForm({ ...planForm, priceCents: Math.round(Number(e.target.value) * 100) })}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate md:col-span-2">
            Features (comma separated)
            <input
              value={planForm.features}
              onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
              placeholder="Attendance, Exams, Reports"
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate">
            Student Limit
            <input
              type="number"
              min={1}
              value={planForm.studentLimit}
              onChange={(e) => setPlanForm({ ...planForm, studentLimit: Number(e.target.value) })}
              placeholder="Student limit"
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate">
            Teacher Limit
            <input
              type="number"
              min={1}
              value={planForm.teacherLimit}
              onChange={(e) => setPlanForm({ ...planForm, teacherLimit: Number(e.target.value) })}
              placeholder="Teacher limit"
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-slate md:col-span-2">
            Status
            <select
              value={planForm.status}
              onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate/20 bg-white px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending}
            >
              {planMutation.isPending ? 'Saving...' : planForm.id ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Features</th>
                <th>Student Limit</th>
                <th>Teacher Limit</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans?.length ? (
                plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-slate/10">
                    <td className="py-3">{plan.name}</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={plan.status === 'ACTIVE'}
                        className={`flex h-6 w-10 items-center rounded-full p-0.5 transition ${
                          plan.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'
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
                          className={`h-5 w-5 rounded-full bg-white shadow transition ${
                            plan.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td>{(plan.priceCents / 100).toFixed(0)}</td>
                    <td className="max-w-[240px] truncate">{plan.features?.length ? plan.features.join(', ') : '—'}</td>
                    <td>{plan.studentLimit}</td>
                    <td>{plan.teacherLimit}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
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
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No plans available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {planBlocker.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-ink">Plan in use</h3>
                <p className="text-sm text-slate">
                  {planBlocker.planName} is assigned to the following schools. Update their plans first.
                </p>
              </div>
              <button className="text-slate" onClick={closeBlocker}>
                ✕
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate">
                  <tr>
                    <th className="py-2">Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Current Plan</th>
                    <th>New Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {planBlocker.schools.map((school) => (
                    <tr key={school.id} className="border-t border-slate/10">
                      <td className="py-3">{school.name}</td>
                      <td>{school.code}</td>
                      <td>{school.status}</td>
                      <td>{school.subscriptionPlan}</td>
                      <td>
                        <select
                          value={planMoves[school.id] ?? ''}
                          onChange={(e) =>
                            setPlanMoves((prev) => ({ ...prev, [school.id]: e.target.value }))
                          }
                          className="rounded-lg border border-slate/20 bg-white px-3 py-1 text-xs"
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
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate">
                Assign a new plan to each school to disable {planBlocker.planName}.
              </p>
              <div className="flex gap-2">
                <button className="rounded-lg border border-slate/20 px-3 py-2 text-sm" onClick={closeBlocker}>
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
                      await updateSubscriptionPlan(planBlocker.planId, { status: 'INACTIVE' });
                      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
                      queryClient.invalidateQueries({ queryKey: ['schools'] });
                      notify.success('Plan disabled', 'Schools reassigned and plan disabled');
                      closeBlocker();
                    } catch (error: any) {
                      const message =
                        error?.response?.data?.error?.message || error?.message || 'Failed to disable plan';
                      notify.error('Update failed', message);
                    } finally {
                      setPlanLoading(false);
                    }
                  }}
                >
                  Disable Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
