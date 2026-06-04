'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import {
  blockSchoolOnboarding,
  getSchoolOnboarding,
  goLiveSchoolOnboarding,
  recalculateSchoolOnboarding,
  requestSchoolOnboardingReview,
  updateSchoolOnboardingChecklist,
  type ChecklistStatus,
  type SchoolOnboardingChecklistItem,
} from '../../../services/school-onboarding.service';

const statusClass = (status: string) => {
  if (status === 'ACTIVE' || status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'READY_FOR_REVIEW' || status === 'SKIPPED') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'BLOCKED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const label = (value: string) => value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(value)}`}>{label(value)}</span>;
}

export default function SchoolOnboardingClient({ schoolId, reviewMode = false }: { schoolId: string; reviewMode?: boolean }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const queryKey = ['school-onboarding', schoolId];

  const onboardingQuery = useQuery({
    queryKey,
    queryFn: () => getSchoolOnboarding(schoolId),
    enabled: Boolean(schoolId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateMutation = useMutation({
    mutationFn: ({ item, status }: { item: SchoolOnboardingChecklistItem; status: ChecklistStatus }) => {
      const note = status === 'SKIPPED' || status === 'BLOCKED' ? window.prompt(`${label(status)} reason`) ?? '' : null;
      return updateSchoolOnboardingChecklist(schoolId, item.key, { status, note });
    },
    onSuccess: () => {
      notify.success('Checklist updated', 'Readiness checklist was updated.');
      invalidate();
    },
    onError: (error: any) => notify.error('Update failed', error?.response?.data?.error?.message ?? 'Unable to update checklist.'),
  });

  const recalcMutation = useMutation({
    mutationFn: () => recalculateSchoolOnboarding(schoolId),
    onSuccess: () => {
      notify.success('Readiness recalculated', 'Checklist was synced with current setup data.');
      invalidate();
    },
    onError: (error: any) => notify.error('Recalculation failed', error?.response?.data?.error?.message ?? 'Unable to recalculate readiness.'),
  });

  const reviewMutation = useMutation({
    mutationFn: () => requestSchoolOnboardingReview(schoolId),
    onSuccess: () => {
      notify.success('Review requested', 'School is ready for Super Admin review.');
      invalidate();
    },
    onError: (error: any) => notify.error('Review blocked', error?.response?.data?.error?.message ?? 'Unable to request review.'),
  });

  const goLiveMutation = useMutation({
    mutationFn: (override: boolean) => goLiveSchoolOnboarding(schoolId, { override, reason: reason.trim() || null }),
    onSuccess: () => {
      notify.success('School activated', 'Onboarding is now active.');
      setReason('');
      invalidate();
    },
    onError: (error: any) => notify.error('Go-live failed', error?.response?.data?.error?.message ?? 'Unable to activate onboarding.'),
  });

  const blockMutation = useMutation({
    mutationFn: () => blockSchoolOnboarding(schoolId, reason.trim()),
    onSuccess: () => {
      notify.success('School blocked', 'Onboarding was blocked with the provided reason.');
      setReason('');
      invalidate();
    },
    onError: (error: any) => notify.error('Block failed', error?.response?.data?.error?.message ?? 'Unable to block onboarding.'),
  });

  const data = onboardingQuery.data;
  const checklist = data?.checklist ?? [];
  const grouped = useMemo(() => ({
    incomplete: checklist.filter((item) => item.status === 'PENDING' || item.status === 'BLOCKED'),
    complete: checklist.filter((item) => item.status === 'COMPLETED' || item.status === 'SKIPPED'),
  }), [checklist]);

  if (onboardingQuery.isLoading) return <FullPageLoader label="Loading onboarding..." />;

  if (onboardingQuery.isError || !data) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">Unable to load onboarding readiness.</div>;
  }

  const busy = updateMutation.isPending || recalcMutation.isPending || reviewMutation.isPending || goLiveMutation.isPending || blockMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Onboarding"
        subtitle={`${data.school.name} (${data.school.code}) readiness workflow`}
        actions={<Button variant="outline" onClick={() => recalcMutation.mutate()} loading={recalcMutation.isPending}>Recalculate</Button>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
          <div className="mt-3"><Badge value={data.school.onboardingStatus} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Progress</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{data.summary.percent}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Completed</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{data.summary.completed}/{data.summary.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Required open</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{data.summary.requiredIncomplete}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Checklist</h2>
            <p className="mt-1 text-sm text-slate-500">Auto-calculated items use current setup data. Manual skips require notes.</p>
          </div>
          {!reviewMode ? <Button onClick={() => reviewMutation.mutate()} loading={reviewMutation.isPending} disabled={data.summary.requiredIncomplete > 0}>Request Review</Button> : null}
        </div>
        <div className="divide-y divide-slate-100">
          {[...grouped.incomplete, ...grouped.complete].map((item) => (
            <div key={item.key} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <Badge value={item.status} />
                  {item.required ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Required</span> : null}
                </div>
                {item.note ? <p className="mt-1 text-sm text-slate-500">{item.note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => updateMutation.mutate({ item, status: 'COMPLETED' })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50">Complete</button>
                <button disabled={busy} onClick={() => updateMutation.mutate({ item, status: 'SKIPPED' })} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-50">Skip</button>
                <button disabled={busy} onClick={() => updateMutation.mutate({ item, status: 'BLOCKED' })} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">Block</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {reviewMode ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Review Decision</h2>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Reason for override or block" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button onClick={() => goLiveMutation.mutate(false)} loading={goLiveMutation.isPending} disabled={data.summary.requiredIncomplete > 0}>Approve Go-Live</Button>
            <Button variant="outline" onClick={() => goLiveMutation.mutate(true)} loading={goLiveMutation.isPending} disabled={!reason.trim()}>Override Go-Live</Button>
            <Button variant="danger" onClick={() => blockMutation.mutate()} loading={blockMutation.isPending} disabled={!reason.trim()}>Block</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
