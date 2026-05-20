'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../components/Button';
import FullPageLoader from '../../../../components/FullPageLoader';
import { getSession } from '../../../../services/auth.service';
import {
  addSupportTicketComment,
  assignSupportTicket,
  getSupportAssignableUsers,
  getSupportTicketById,
  updateSupportTicketPriority,
  updateSupportTicketStatus,
  type TicketPriority,
  type TicketStatus,
} from '../../../../services/support.service';

const ticketStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const ticketPriorities: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const formatLabel = (value?: string | null) =>
  (value ?? 'N/A')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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

const statusBadgeClass = (status?: TicketStatus) => {
  if (status === 'OPEN') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'RESOLVED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const priorityBadgeClass = (priority?: TicketPriority) => {
  if (priority === 'URGENT') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (priority === 'HIGH') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (priority === 'MEDIUM') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function SupportTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = String(params.id ?? '');
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [commentError, setCommentError] = useState('');

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  const {
    data: ticket,
    isLoading: isTicketLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['support-ticket', ticketId, isSuperAdmin],
    queryFn: () => getSupportTicketById(ticketId, { admin: isSuperAdmin }),
    enabled: Boolean(ticketId && session?.role),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: assignableUsers } = useQuery({
    queryKey: ['support-assignable-users'],
    queryFn: getSupportAssignableUsers,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const invalidateTicket = () => {
    queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId, isSuperAdmin] });
    queryClient.invalidateQueries({ queryKey: ['tickets'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) => updateSupportTicketStatus(ticketId, status, { admin: isSuperAdmin }),
    onSuccess: invalidateTicket,
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: TicketPriority) => updateSupportTicketPriority(ticketId, priority, { admin: isSuperAdmin }),
    onSuccess: invalidateTicket,
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => assignSupportTicket(ticketId, assignedToId),
    onSuccess: invalidateTicket,
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      addSupportTicketComment(
        ticketId,
        {
          body: commentBody.trim(),
          isInternal: isSuperAdmin ? isInternal : false,
        },
        { admin: isSuperAdmin },
      ),
    onSuccess: () => {
      setCommentBody('');
      setIsInternal(false);
      setCommentError('');
      invalidateTicket();
    },
  });

  const isClosed = ticket?.status === 'CLOSED';
  const canReopen = isClosed;
  const comments = useMemo(() => ticket?.comments ?? [], [ticket?.comments]);

  const submitComment = () => {
    if (!commentBody.trim()) {
      setCommentError('Comment cannot be empty.');
      return;
    }
    setCommentError('');
    commentMutation.mutate();
  };

  if (isSessionLoading || isTicketLoading) {
    return <FullPageLoader label="Loading ticket..." />;
  }

  if (isError || !ticket) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Unable to load ticket</h1>
        <p className="mt-2 text-sm text-slate-500">The ticket may not exist or you may not have access to it.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          <Link
            href="/dashboard/support"
            prefetch={false}
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
          >
            Back to Support
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/dashboard/support" prefetch={false} className="text-sm font-semibold text-sky-700 hover:underline">
              Back to support list
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {ticket.ticketNumber ?? ticket.id}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{ticket.subject}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className={statusBadgeClass(ticket.status)}>{formatLabel(ticket.status)}</Badge>
              <Badge className={priorityBadgeClass(ticket.priority)}>{formatLabel(ticket.priority)}</Badge>
              {ticket.escalation ? <Badge className="bg-rose-50 text-rose-700 ring-rose-200">Escalated</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isClosed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('CLOSED')}
                loading={statusMutation.isPending}
              >
                Close Ticket
              </Button>
            ) : null}
            {canReopen ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('OPEN')}
                loading={statusMutation.isPending}
              >
                Reopen Ticket
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Ticket Details</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{ticket.description}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <DetailRow label="Category" value={ticket.category ?? 'N/A'} />
              <DetailRow
                label="School"
                value={
                  ticket.school ? (
                    <span>
                      {ticket.school.name} <span className="text-slate-500">({ticket.school.code})</span>
                    </span>
                  ) : (
                    'N/A'
                  )
                }
              />
              <DetailRow
                label="Created by"
                value={
                  <span>
                    {ticket.createdBy?.name ?? 'N/A'}
                    <span className="ml-2 text-xs text-slate-500">{formatLabel(ticket.createdBy?.role)}</span>
                  </span>
                }
              />
              <DetailRow label="Assigned to" value={ticket.assignedTo?.name ?? 'Unassigned'} />
              <DetailRow label="Created" value={formatDateTime(ticket.createdAt)} />
              <DetailRow label="Last updated" value={formatDateTime(ticket.updatedAt)} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">Comments</h2>
                <p className="mt-1 text-sm text-slate-500">Public replies and internal notes for this ticket.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {comments.length}
              </span>
            </div>
            {comments.length ? (
              <div className="space-y-4">
                {comments.map((comment) => (
                  <article
                    key={comment.id}
                    className={`rounded-2xl border p-4 ${
                      comment.isInternal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{comment.author?.name ?? 'Unknown user'}</p>
                        <p className="text-xs text-slate-500">{formatLabel(comment.author?.role)} - {formatDateTime(comment.createdAt)}</p>
                      </div>
                      {comment.isInternal ? (
                        <Badge className="bg-amber-100 text-amber-800 ring-amber-200">Internal note</Badge>
                      ) : (
                        <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Public reply</Badge>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="No comments yet." />
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Actions</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  value={ticket.status}
                  onChange={(event) => statusMutation.mutate(event.target.value as TicketStatus)}
                  disabled={statusMutation.isPending}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {ticketStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(event) => priorityMutation.mutate(event.target.value as TicketPriority)}
                  disabled={priorityMutation.isPending}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {ticketPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {formatLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>
              {isSuperAdmin ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Assign to</label>
                  <select
                    value={ticket.assignedTo?.id ?? ''}
                    onChange={(event) => assignMutation.mutate(event.target.value || null)}
                    disabled={assignMutation.isPending}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers?.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Add Reply</h2>
            <div className="mt-4 space-y-4">
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                rows={6}
                placeholder="Write a reply or internal note"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              {isSuperAdmin ? (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(event) => setIsInternal(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  Internal note only
                </label>
              ) : null}
              {commentError ? <p className="text-sm font-medium text-rose-600">{commentError}</p> : null}
              {commentMutation.isError ? (
                <p className="text-sm font-medium text-rose-600">Unable to save comment. Please try again.</p>
              ) : null}
              <Button
                fullWidth
                onClick={submitComment}
                loading={commentMutation.isPending}
                disabled={commentMutation.isPending}
              >
                Submit
              </Button>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
