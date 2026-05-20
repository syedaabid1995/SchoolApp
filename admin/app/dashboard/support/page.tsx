'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  createTicket,
  getSupportAssignableUsers,
  listTickets,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
} from '../../../services/support.service';

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

const statusBadgeClass = (status: TicketStatus) => {
  if (status === 'OPEN') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'IN_PROGRESS') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'RESOLVED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const priorityBadgeClass = (priority: TicketPriority) => {
  if (priority === 'URGENT') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (priority === 'HIGH') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (priority === 'MEDIUM') return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function SkeletonTable() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
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

export default function SupportPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM' as TicketPriority,
    schoolId: '',
  });
  const [formError, setFormError] = useState('');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    schoolId: '',
    assignedToId: '',
  });

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? searchParams.get('query') ?? '';
    if (urlSearch) {
      setFilters((current) => ({ ...current, search: urlSearch }));
    }
    if (searchParams.get('action') === 'create') setIsCreateModalOpen(true);
  }, [searchParams]);

  const { data: schools } = useQuery({
    queryKey: ['support-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: assignableUsers } = useQuery({
    queryKey: ['support-assignable-users'],
    queryFn: getSupportAssignableUsers,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const serverFilters = useMemo(
    () => ({
      status: filters.status as TicketStatus | '',
      priority: filters.priority as TicketPriority | '',
      schoolId: isSuperAdmin ? filters.schoolId : '',
      assignedToId: isSuperAdmin ? filters.assignedToId : '',
    }),
    [filters.assignedToId, filters.priority, filters.schoolId, filters.status, isSuperAdmin],
  );

  const {
    data: tickets,
    isLoading: isTicketsLoading,
    isError: isTicketsError,
    refetch,
  } = useQuery({
    queryKey: ['tickets', isSuperAdmin, serverFilters],
    queryFn: () => listTickets(serverFilters, { admin: isSuperAdmin }),
    enabled: Boolean(session?.role),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const visibleTickets = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return tickets ?? [];
    return (tickets ?? []).filter((ticket) => {
      return (
        ticket.subject.toLowerCase().includes(search) ||
        ticket.description.toLowerCase().includes(search) ||
        (ticket.ticketNumber ?? '').toLowerCase().includes(search) ||
        ticket.id.toLowerCase().includes(search) ||
        (ticket.school?.name ?? '').toLowerCase().includes(search) ||
        (ticket.school?.code ?? '').toLowerCase().includes(search)
      );
    });
  }, [filters.search, tickets]);

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      setForm({ subject: '', description: '', priority: 'MEDIUM', schoolId: '' });
      setFormError('');
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const submitCreate = () => {
    let error = '';
    if (!form.subject.trim()) error = 'Subject is required.';
    else if (!form.description.trim()) error = 'Description is required.';
    else if (isSuperAdmin && !form.schoolId) error = 'School is required for Super Admin ticket creation.';

    setFormError(error);
    if (error) return;

    createMutation.mutate({
      subject: form.subject.trim(),
      description: form.description.trim(),
      priority: form.priority,
      schoolId: isSuperAdmin ? form.schoolId : undefined,
    });
  };

  if (isSessionLoading) {
    return <FullPageLoader label="Loading support..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        subtitle={isSuperAdmin ? 'Manage support tickets across all schools.' : 'Create and track support tickets for your school.'}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[1fr_180px_180px_220px_220px_auto] xl:items-end">
          <div>
            <label htmlFor="support-search" className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              id="support-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Ticket, subject, school"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label htmlFor="support-status" className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="support-status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">All</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="support-priority" className="mb-2 block text-sm font-medium text-slate-700">
              Priority
            </label>
            <select
              id="support-priority"
              value={filters.priority}
              onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">All</option>
              {ticketPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin ? (
            <>
              <div>
                <label htmlFor="support-school" className="mb-2 block text-sm font-medium text-slate-700">
                  School
                </label>
                <select
                  id="support-school"
                  value={filters.schoolId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, schoolId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">All schools</option>
                  {schools?.items.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="support-assigned" className="mb-2 block text-sm font-medium text-slate-700">
                  Assigned
                </label>
                <select
                  id="support-assigned"
                  value={filters.assignedToId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assignedToId: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Anyone</option>
                  {assignableUsers?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormError('');
                setIsCreateModalOpen(true);
              }}
            >
              New Ticket
            </Button>
          </div>
        </div>
      </section>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Create Support Ticket</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isSuperAdmin ? 'Create a ticket on behalf of a selected school.' : 'Send a support request to the platform team.'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {isSuperAdmin ? (
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">School</label>
                  <select
                    value={form.schoolId}
                    onChange={(event) => setForm((prev) => ({ ...prev, schoolId: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="">Select school</option>
                    {schools?.items.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name} ({school.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Subject</label>
                <input
                  value={form.subject}
                  onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Brief description"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Priority</label>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as TicketPriority }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {ticketPriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {formatLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={5}
                  placeholder="Detailed description of the issue"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>
            {formError ? <p className="mt-4 text-sm font-medium text-rose-600">{formError}</p> : null}
            <div className="mt-6 flex justify-end">
              <Button onClick={submitCreate} loading={createMutation.isPending} disabled={createMutation.isPending}>
                Create Ticket
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSuperAdmin ? 'All school tickets are visible to Super Admin users.' : 'Only your school tickets are shown.'}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {visibleTickets.length} shown
          </span>
        </div>

        {isTicketsLoading ? (
          <SkeletonTable />
        ) : isTicketsError ? (
          <EmptyState message="Unable to load support tickets." />
        ) : visibleTickets.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="whitespace-nowrap px-3 py-3">Ticket</th>
                  {isSuperAdmin ? <th className="whitespace-nowrap px-3 py-3">School</th> : null}
                  <th className="whitespace-nowrap px-3 py-3">Created by</th>
                  <th className="whitespace-nowrap px-3 py-3">Status</th>
                  <th className="whitespace-nowrap px-3 py-3">Priority</th>
                  <th className="whitespace-nowrap px-3 py-3">Assigned to</th>
                  <th className="whitespace-nowrap px-3 py-3">Created</th>
                  <th className="whitespace-nowrap px-3 py-3">Updated</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTickets.map((ticket: SupportTicket) => (
                  <tr key={ticket.id} className="align-top hover:bg-slate-50">
                    <td className="max-w-[260px] px-3 py-4">
                      <p className="font-semibold text-slate-950">{ticket.ticketNumber ?? ticket.id}</p>
                      <p className="mt-1 truncate text-slate-700">{ticket.subject}</p>
                    </td>
                    {isSuperAdmin ? (
                      <td className="px-3 py-4 text-slate-700">
                        <p className="font-medium">{ticket.school?.name ?? 'N/A'}</p>
                        <p className="text-xs text-slate-500">{ticket.school?.code ?? ''}</p>
                      </td>
                    ) : null}
                    <td className="px-3 py-4 text-slate-700">
                      <p>{ticket.createdBy?.name ?? 'N/A'}</p>
                      <p className="text-xs text-slate-500">{formatLabel(ticket.createdBy?.role)}</p>
                    </td>
                    <td className="px-3 py-4">
                      <Badge className={statusBadgeClass(ticket.status)}>{formatLabel(ticket.status)}</Badge>
                    </td>
                    <td className="px-3 py-4">
                      <Badge className={priorityBadgeClass(ticket.priority)}>{formatLabel(ticket.priority)}</Badge>
                    </td>
                    <td className="px-3 py-4 text-slate-700">{ticket.assignedTo?.name ?? 'Unassigned'}</td>
                    <td className="px-3 py-4 text-slate-600">{formatDateTime(ticket.createdAt)}</td>
                    <td className="px-3 py-4 text-slate-600">{formatDateTime(ticket.updatedAt)}</td>
                    <td className="px-3 py-4 text-right">
                      <Link href={`/dashboard/support/${ticket.id}`} prefetch={false} className="font-semibold text-sky-700 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No support tickets found." />
        )}
      </section>
    </div>
  );
}
