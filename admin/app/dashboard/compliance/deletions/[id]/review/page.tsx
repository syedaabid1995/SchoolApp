'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../../components/Button';
import PageHeader from '../../../../../../components/PageHeader';
import { useNotify } from '../../../../../../components/NotificationProvider';
import { approveDeletionRequest, getComplianceJobHistory, getDeletionRequestById, rejectDeletionRequest } from '../../../../../../services/compliance.service';

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('en-IN') : 'N/A');
const formatLabel = (value?: string | null) => (value ?? 'N/A').replace(/_/g, ' ');

export default function DeletionReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const { data: request, isLoading } = useQuery({ queryKey: ['compliance-deletion', id], queryFn: () => getDeletionRequestById(id) });
  const { data: history = [] } = useQuery({ queryKey: ['compliance-history', id], queryFn: () => getComplianceJobHistory(id) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance-deletion', id] });
    queryClient.invalidateQueries({ queryKey: ['compliance-history', id] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approveDeletionRequest(id, { note }),
    onSuccess: () => {
      notify.success('Approved', 'Deletion request approved. Actual deletion execution remains a separate controlled backend workflow.');
      refresh();
    },
    onError: (error: any) => notify.error('Approval failed', error?.response?.data?.error?.message || 'Unable to approve deletion request.'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectDeletionRequest(id, { reason }),
    onSuccess: () => {
      notify.success('Rejected', 'Deletion request rejected.');
      setReason('');
      refresh();
    },
    onError: (error: any) => notify.error('Rejection failed', error?.response?.data?.error?.message || 'Unable to reject deletion request.'),
  });

  const canReview = request?.status === 'REQUESTED' || request?.status === 'PENDING';

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-6xl pr-6">
        <PageHeader title="Review Deletion Request" subtitle={id} actions={<Link className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" href="/dashboard/compliance">Back</Link>} />
        <section className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Deletion requests are sensitive. Approval only marks the request as approved; actual execution is handled separately by the backend deletion workflow.
        </section>
        {isLoading ? <p className="text-sm text-slate-500">Loading request...</p> : null}
        {request ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Request Details</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Detail label="Status" value={formatLabel(request.status)} />
                <Detail label="School" value={`${request.schoolName ?? 'N/A'} ${request.schoolCode ? `(${request.schoolCode})` : ''}`} />
                <Detail label="Requested By" value={request.requestedBy?.name ?? 'N/A'} />
                <Detail label="Requested At" value={formatDate(request.requestedAt)} />
                <Detail label="Reviewed At" value={formatDate(request.approvedAt ?? request.rejectedAt)} />
                <Detail label="Reason" value={request.reason ?? 'N/A'} />
                <Detail label="Rejection Reason" value={request.rejectionReason ?? 'N/A'} />
              </div>
            </section>
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Review</h2>
              <textarea className="mt-3 w-full rounded-md border px-3 py-2 text-sm" rows={3} placeholder="Optional approval note" value={note} onChange={(event) => setNote(event.target.value)} />
              <Button className="mt-3 w-full" disabled={!canReview} loading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
              <textarea className="mt-4 w-full rounded-md border px-3 py-2 text-sm" rows={4} placeholder="Rejection reason is required" value={reason} onChange={(event) => setReason(event.target.value)} />
              <Button className="mt-3 w-full" variant="danger" disabled={!canReview || !reason.trim()} loading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>Reject</Button>
            </section>
          </div>
        ) : null}
        <History rows={history} />
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm text-slate-900">{value}</p>
    </div>
  );
}

function History({ rows }: { rows: Array<{ id: string; oldStatus: string; newStatus: string; reason?: string | null; actor?: { name: string } | null; createdAt?: string | null }> }) {
  return (
    <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Status History</h2>
      {!rows.length ? <p className="mt-3 text-sm text-slate-500">No status history yet.</p> : null}
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border p-3 text-sm">
            <span className="font-semibold">{formatLabel(row.oldStatus)}</span> to <span className="font-semibold">{formatLabel(row.newStatus)}</span>
            <span className="text-slate-500"> by {row.actor?.name ?? 'Unknown'} on {formatDate(row.createdAt)}</span>
            {row.reason ? <div className="mt-1 text-slate-600">{row.reason}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
