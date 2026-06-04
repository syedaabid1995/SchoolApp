'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../components/Button';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import {
  confirmTeacherCredentialManualShare,
  getTeacherOnboarding,
  listTeacherOnboarding,
  recalculateTeacherOnboarding,
  resendTeacherCredentials,
  updateTeacherOnboarding,
  type TeacherOnboarding,
} from '../../../../services/teacher-onboarding.service';

const readinessItems: Array<[keyof TeacherOnboarding, string]> = [
  ['accountCreated', 'Account created'],
  ['temporaryPasswordShared', 'Temporary password shared'],
  ['manualShareConfirmed', 'Manual share confirmed'],
  ['firstLoginCompleted', 'First login completed'],
  ['passwordChanged', 'Password changed'],
  ['profileCompleted', 'Profile completed'],
  ['active', 'Teacher active'],
  ['classAssigned', 'Class assigned'],
  ['subjectAssigned', 'Subject assigned'],
  ['timetableAssigned', 'Timetable assigned'],
  ['attendanceEnabled', 'Attendance enabled'],
];

const badgeClass = (status: string) => {
  if (status === 'READY') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'BLOCKED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badgeClass(status)}`}>{status}</span>;
}

function ReadinessGrid({ onboarding }: { onboarding: TeacherOnboarding }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {readinessItems.map(([key, label]) => {
        const ok = Boolean(onboarding[key]);
        return (
          <div key={String(key)} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">{label}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{ok ? 'Done' : 'Open'}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TeacherOnboardingClient({ teacherId, schoolId }: { teacherId?: string; schoolId?: string }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const listQuery = useQuery({
    queryKey: ['teacher-onboarding-list', schoolId],
    queryFn: () => listTeacherOnboarding({ schoolId }),
    enabled: !teacherId,
  });
  const detailQuery = useQuery({
    queryKey: ['teacher-onboarding', teacherId, schoolId],
    queryFn: () => getTeacherOnboarding(teacherId!, { schoolId }),
    enabled: Boolean(teacherId),
  });
  const detail = detailQuery.data;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['teacher-onboarding-list'] });
    if (teacherId) queryClient.invalidateQueries({ queryKey: ['teacher-onboarding', teacherId] });
  };

  const recalcMutation = useMutation({
    mutationFn: (id: string) => recalculateTeacherOnboarding(id, { schoolId }),
    onSuccess: () => {
      notify.success('Readiness recalculated', 'Teacher readiness was refreshed from current data.');
      invalidate();
    },
    onError: (error: any) => notify.error('Recalculation failed', error?.response?.data?.error?.message ?? 'Unable to recalculate readiness.'),
  });

  const manualShareMutation = useMutation({
    mutationFn: () => confirmTeacherCredentialManualShare(teacherId!, { schoolId, note }),
    onSuccess: () => {
      notify.success('Manual share confirmed', 'Credential share confirmation was recorded.');
      setNote('');
      invalidate();
    },
    onError: (error: any) => notify.error('Confirmation failed', error?.response?.data?.error?.message ?? 'Unable to confirm manual share.'),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendTeacherCredentials(teacherId!, { schoolId }),
    onSuccess: () => {
      notify.success('Credential delivery attempted', 'Delivery result has been audit logged.');
      invalidate();
    },
    onError: (error: any) => notify.error('Delivery failed', error?.response?.data?.error?.message ?? 'Unable to resend credentials.'),
  });

  const blockMutation = useMutation({
    mutationFn: () => updateTeacherOnboarding(teacherId!, { schoolId, readinessStatus: 'BLOCKED', note }),
    onSuccess: () => {
      notify.success('Onboarding blocked', 'Teacher readiness was blocked.');
      invalidate();
    },
    onError: (error: any) => notify.error('Update failed', error?.response?.data?.error?.message ?? 'Unable to update readiness.'),
  });

  const readyCount = useMemo(() => (listQuery.data?.items ?? []).filter((item) => item.readinessStatus === 'READY').length, [listQuery.data]);

  if (!teacherId) {
    if (listQuery.isLoading) return <FullPageLoader label="Loading teacher onboarding..." />;
    const items = listQuery.data?.items ?? [];
    return (
      <div className="space-y-6">
        <PageHeader title="Teacher Onboarding" subtitle="Track credential, assignment, timetable, and attendance readiness." />
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Teachers</p><p className="mt-2 text-2xl font-bold">{items.length}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Ready</p><p className="mt-2 text-2xl font-bold">{readyCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Open</p><p className="mt-2 text-2xl font-bold">{items.length - readyCount}</p></div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{item.teacher.firstName} {item.teacher.lastName}</p>
                  <p className="text-sm text-slate-500">{item.teacher.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.readinessStatus} />
                  <Button size="sm" variant="outline" onClick={() => recalcMutation.mutate(item.teacherId)} loading={recalcMutation.isPending}>Recalculate</Button>
                  <Link className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" href={`/dashboard/teachers/${item.teacherId}/onboarding`}>Open</Link>
                </div>
              </div>
            ))}
            {!items.length ? <div className="p-8 text-center text-sm text-slate-500">No teachers found.</div> : null}
          </div>
        </section>
      </div>
    );
  }

  if (detailQuery.isLoading) return <FullPageLoader label="Loading teacher readiness..." />;
  if (!detail) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">Unable to load teacher onboarding.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.teacher.firstName} ${detail.teacher.lastName}`}
        subtitle="Teacher onboarding readiness"
        actions={<Button variant="outline" onClick={() => recalcMutation.mutate(detail.teacherId)} loading={recalcMutation.isPending}>Recalculate</Button>}
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">{detail.teacher.email}</p>
            <div className="mt-2"><StatusBadge status={detail.readinessStatus} /></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => resendMutation.mutate()} loading={resendMutation.isPending}>Resend Credentials</Button>
          </div>
        </div>
      </section>
      <ReadinessGrid onboarding={detail} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Credential / Readiness Actions</h2>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Required note for manual credential share or block" />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => manualShareMutation.mutate()} loading={manualShareMutation.isPending} disabled={!note.trim()}>Confirm Manual Share</Button>
          <Button variant="danger" onClick={() => blockMutation.mutate()} loading={blockMutation.isPending} disabled={!note.trim()}>Block Readiness</Button>
        </div>
        {detail.note ? <p className="mt-3 text-sm text-slate-500">Last note: {detail.note}</p> : null}
      </section>
    </div>
  );
}
