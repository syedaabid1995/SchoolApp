'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardPageContainer from '../../../components/DashboardPageContainer';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import {
  approveDemoRequest,
  listDemoRequests,
  type DemoRequest,
  type DemoRequestStatus,
} from '../../../services/demo-request.service';

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

const formatNumber = (value: number) => value.toLocaleString('en-IN');

const statusClass = (status: DemoRequestStatus) =>
  status === 'APPROVED'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--shell-text)]">{value}</p>
    </div>
  );
}

function RequestCard({
  request,
  onApprove,
  approving,
}: {
  request: DemoRequest;
  onApprove: (id: string) => void;
  approving: boolean;
}) {
  return (
    <article className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-[var(--shell-text)]">{request.schoolName}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(request.status)}`}>
              {request.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--shell-muted)]">
            {request.name} · {request.email}
            {request.phone ? ` · ${request.phone}` : ''}
          </p>
        </div>
        <button
          type="button"
          disabled={request.status === 'APPROVED' || approving}
          onClick={() => onApprove(request.id)}
          className="rounded-lg bg-[var(--shell-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {request.status === 'APPROVED' ? 'Approved' : approving ? 'Approving...' : 'Approve & Email'}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-[var(--shell-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shell-muted)]">Students</p>
          <p className="mt-1 font-bold text-[var(--shell-text)]">{formatNumber(request.studentCount)}</p>
        </div>
        <div className="rounded-lg bg-[var(--shell-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shell-muted)]">Staff</p>
          <p className="mt-1 font-bold text-[var(--shell-text)]">{formatNumber(request.staffCount)}</p>
        </div>
        <div className="rounded-lg bg-[var(--shell-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--shell-muted)]">Submitted</p>
          <p className="mt-1 font-bold text-[var(--shell-text)]">{formatDateTime(request.createdAt)}</p>
        </div>
      </div>

      {request.message ? (
        <p className="mt-4 rounded-lg border border-[var(--shell-border)] p-3 text-sm text-[var(--shell-muted)]">
          {request.message}
        </p>
      ) : null}

      {request.status === 'APPROVED' ? (
        <div className="mt-4 text-sm text-[var(--shell-muted)]">
          Approved {formatDateTime(request.approvedAt)} by {request.approvedBy?.email ?? 'admin'}.
          Link expires {formatDateTime(request.approvalTokenExpiresAt)}. Email: {request.emailDeliveryStatus ?? 'N/A'}.
        </div>
      ) : null}
    </article>
  );
}

export default function DemoRequestsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DemoRequestStatus | ''>('');
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['demo-requests', status, search],
    queryFn: () => listDemoRequests({ status, search }),
  });

  const approveMutation = useMutation({
    mutationFn: approveDemoRequest,
    onSuccess: () => {
      notify.success('Demo request approved', 'The approval email has been queued or sent.');
      queryClient.invalidateQueries({ queryKey: ['demo-requests'] });
    },
    onError: (error: any) => {
      notify.error('Approval failed', error?.response?.data?.message ?? error?.message ?? 'Please try again.');
    },
  });

  const requests = query.data ?? [];
  const stats = useMemo(() => {
    const pending = requests.filter((item) => item.status === 'PENDING').length;
    const approved = requests.filter((item) => item.status === 'APPROVED').length;
    return { total: requests.length, pending, approved };
  }, [requests]);

  if (query.isLoading) {
    return <FullPageLoader />;
  }

  return (
    <DashboardPageContainer>
      <PageHeader
        title="Demo Requests"
        subtitle="Review website demo bookings and send 24-hour approval links."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Approved" value={stats.approved} />
      </div>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm md:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or school"
          className="min-h-10 flex-1 rounded-lg border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-[var(--shell-primary)]"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as DemoRequestStatus | '')}
          className="min-h-10 rounded-lg border border-[var(--shell-border)] bg-white px-3 text-sm font-semibold text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-[var(--shell-primary)]"
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
        </select>
      </div>

      <div className="mt-6 space-y-4">
        {requests.length ? (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={(id) => approveMutation.mutate(id)}
              approving={approveMutation.isPending && approveMutation.variables === request.id}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-card)] p-10 text-center text-sm text-[var(--shell-muted)]">
            No demo requests found.
          </div>
        )}
      </div>
    </DashboardPageContainer>
  );
}
