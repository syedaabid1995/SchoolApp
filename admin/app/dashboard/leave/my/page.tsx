'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  createLeaveApplication,
  deleteLeaveApplication,
  getMyLeaveBalances,
  listLeaveApplications,
  listLeaveTypes,
  updateLeaveApplication,
  type LeaveApplication,
  type LeaveStatus,
} from '../../../../services/leave.service';

const staffRoles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

const today = () => new Date().toISOString().slice(0, 10);

const statusClass: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const duration = (item: LeaveApplication) => item.durationDays ?? item.duration ?? 0;

const exportCsv = (items: LeaveApplication[]) => {
  const headers = ['Type', 'From', 'To', 'Apply date', 'Duration', 'Status', 'Reason'];
  const body = items.map((item) => [item.leaveType?.name ?? '', item.fromDate, item.toDate, item.appliedAt, duration(item), item.status, item.reason]);
  const csv = [headers, ...body].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'my-leave-requests.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function MyLeavePage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    id: '',
    appliedAt: today(),
    leaveTypeId: '',
    fromDate: today(),
    toDate: today(),
    reason: '',
    file: null as File | null,
  });
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const allowed = Boolean(session?.role && staffRoles.includes(session.role));

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: listLeaveTypes, enabled: allowed });
  const balancesQuery = useQuery({ queryKey: ['my-leave-balances'], queryFn: getMyLeaveBalances, enabled: allowed });
  const applicationsQuery = useQuery({
    queryKey: ['my-leave-applications', statusFilter],
    queryFn: () => listLeaveApplications({ mine: true, status: statusFilter || undefined }),
    enabled: allowed,
  });

  const items = useMemo(() => applicationsQuery.data ?? [], [applicationsQuery.data]);

  const resetForm = () => setForm({ id: '', appliedAt: today(), leaveTypeId: '', fromDate: today(), toDate: today(), reason: '', file: null });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.leaveTypeId) throw new Error('Leave type is required.');
      if (!form.reason.trim()) throw new Error('Reason is required.');
      if (form.file && form.file.size > 10 * 1024 * 1024) throw new Error('Attachment must be under 10 MB.');
      return form.id
        ? updateLeaveApplication(form.id, form)
        : createLeaveApplication({ leaveTypeId: form.leaveTypeId, appliedAt: form.appliedAt, fromDate: form.fromDate, toDate: form.toDate, reason: form.reason, file: form.file });
    },
    onSuccess: () => {
      notify.success(form.id ? 'Leave updated' : 'Leave applied', 'Your leave request was saved.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['my-leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
    onError: (error: any) => notify.error('Unable to save leave', error?.response?.data?.error?.message ?? error.message ?? 'Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLeaveApplication,
    onSuccess: () => {
      notify.success('Leave deleted', 'Pending leave request was deleted.');
      queryClient.invalidateQueries({ queryKey: ['my-leave-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete leave request.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking leave access..." />;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-rose-600">School staff access required</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Leave application is not available for your role.</h1>
          <p className="mt-2 text-sm text-slate-500">Only School Admin and staff users can apply for leave.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Apply Leave"
          subtitle="View remaining leave balances and submit leave applications."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Leave' }, { label: 'Apply Leave' }]}
          actions={<button onClick={() => applicationsQuery.refetch()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Refresh</button>}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">My Remaining Leaves</h2>
              <p className="text-sm text-slate-500">Balances are calculated from approved leave only.</p>
            </div>
            <button onClick={() => exportCsv(items)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Export</button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {balancesQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)
            ) : balancesQuery.data?.items.length ? (
              balancesQuery.data.items.map((balance) => (
                <div key={balance.leaveType.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-950">{balance.leaveType.name}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-bold text-slate-950">{balance.totalDays}</p><p className="text-slate-500">Total</p></div>
                    <div><p className="font-bold text-emerald-700">{balance.remainingDays}</p><p className="text-slate-500">Remaining</p></div>
                    <div><p className="font-bold text-rose-700">{balance.extraTakenDays}</p><p className="text-slate-500">Extra</p></div>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 md:col-span-4">No leave balance configured yet.</p>
            )}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">{form.id ? 'Edit Leave' : 'Apply Leave'}</h2>
            <div className="mt-4 space-y-3">
              <input type="date" value={form.appliedAt} onChange={(event) => setForm({ ...form, appliedAt: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select value={form.leaveTypeId} onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select leave type</option>
                {(typesQuery.data ?? []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.fromDate} onChange={(event) => setForm({ ...form, fromDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input type="date" value={form.toDate} onChange={(event) => setForm({ ...form, toDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Reason" className="min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] ?? null })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <div className="flex justify-end gap-2">
                {form.id ? <button onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Cancel</button> : null}
                <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] disabled:opacity-50">
                  {saveMutation.isPending ? 'Saving...' : form.id ? 'Update Leave' : 'Save Apply Leave'}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Leave List</h2>
                <p className="text-sm text-slate-500">Pending requests can be edited or deleted.</p>
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeaveStatus | '')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">All status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Apply date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applicationsQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={6} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                  ) : items.length ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-semibold">{item.leaveType?.name ?? '-'}</td>
                        <td className="px-4 py-3">{formatDate(item.fromDate)}</td>
                        <td className="px-4 py-3">{formatDate(item.toDate)}</td>
                        <td className="px-4 py-3">{formatDate(item.appliedAt)}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[item.status]}`}>{item.status}</span></td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            {item.attachments?.[0] ? <a href={item.attachments[0].fileUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">File</a> : null}
                            {item.status === 'PENDING' ? (
                              <>
                                <button onClick={() => setForm({ id: item.id, appliedAt: item.appliedAt.slice(0, 10), leaveTypeId: item.leaveTypeId, fromDate: item.fromDate.slice(0, 10), toDate: item.toDate.slice(0, 10), reason: item.reason, file: null })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">Edit</button>
                                <button onClick={() => window.confirm('Delete this leave request?') && deleteMutation.mutate(item.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button>
                              </>
                            ) : <span className="text-xs text-slate-400">Locked</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No leave requests found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
