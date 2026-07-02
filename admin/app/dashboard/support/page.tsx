'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardPageContainer from '../../../components/DashboardPageContainer';
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
const pageSizes = [10, 20, 50, 100];

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
    <div className="p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

type TableIconName = 'copy' | 'file' | 'print' | 'refresh' | 'chevron';

const TableIcon = ({ name, className = 'h-4 w-4' }: { name: TableIconName; className?: string }) => {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'copy') return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
  if (name === 'file') return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
  if (name === 'print') return <svg {...common}><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></svg>;
  if (name === 'refresh') return <svg {...common}><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></svg>;
  return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
};

const getPageItems = (currentPage: number, totalPages: number) => {
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right)
    .reduce<Array<number | string>>((result, page, index, list) => {
      if (index > 0 && page - list[index - 1] > 1) result.push(`ellipsis-${page}`);
      result.push(page);
      return result;
    }, []);
};

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  const totalRows = visibleTickets.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min(page * limit, totalRows);
  const pageRows = useMemo(() => visibleTickets.slice((page - 1) * limit, page * limit), [limit, page, visibleTickets]);
  const pageItems = useMemo(() => getPageItems(page, totalPages), [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [filters.assignedToId, filters.priority, filters.schoolId, filters.search, filters.status, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    <DashboardPageContainer maxWidthClassName="max-w-none" className="space-y-4">
      <header className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--shell-text)]">Support Tickets</h1>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">
              {isSuperAdmin ? 'Manage support tickets across all schools.' : 'Create and track support tickets for your school.'}
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--shell-muted)]">Dashboard / Support Tickets</span>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="border-b border-[var(--shell-border)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--shell-text)]">Select Criteria</h2>
        </div>
        <div className={`grid gap-3 p-4 ${isSuperAdmin ? 'xl:grid-cols-[minmax(220px,1fr)_160px_160px_220px_220px_auto]' : 'md:grid-cols-[minmax(220px,1fr)_160px_160px_auto]'} md:items-end`}>
          <label className="block" htmlFor="support-search">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Search</span>
            <input
              id="support-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Ticket, subject, school"
              className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block" htmlFor="support-status">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Status</span>
            <select
              id="support-status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {ticketStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="block" htmlFor="support-priority">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Priority</span>
            <select
              id="support-priority"
              value={filters.priority}
              onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))}
              className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All priorities</option>
              {ticketPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {formatLabel(priority)}
                </option>
              ))}
            </select>
          </label>
          {isSuperAdmin ? (
            <>
              <label className="block" htmlFor="support-school">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">School</span>
                <select
                  id="support-school"
                  value={filters.schoolId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, schoolId: event.target.value }))}
                  className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All schools</option>
                  {schools?.items.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block" htmlFor="support-assigned">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Assigned</span>
                <select
                  id="support-assigned"
                  value={filters.assignedToId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assignedToId: event.target.value }))}
                  className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Anyone</option>
                  {assignableUsers?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setFilters({ search: '', status: '', priority: '', schoolId: '', assignedToId: '' });
            }}
            className="h-10 rounded-md border border-[var(--shell-border)] bg-white px-4 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-subtle)]"
          >
            Reset
          </button>
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

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--shell-text)]">Support Ticket List</h2>
            <p className="mt-0.5 text-sm text-[var(--shell-muted)]">
              Showing {pageStart} to {pageEnd} of {totalRows} tickets
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Rows per page</span>
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="h-10 appearance-none rounded-md border border-[var(--shell-border)] bg-white pl-3 pr-9 text-sm font-semibold text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <TableIcon name="chevron" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--shell-muted)]" />
            </label>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] bg-white text-[var(--shell-muted)] hover:text-[var(--shell-text)]" title="Copy">
              <TableIcon name="copy" />
            </button>
            <button type="button" className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] bg-white text-[var(--shell-muted)] hover:text-[var(--shell-text)]" title="Export">
              <TableIcon name="file" />
            </button>
            <button type="button" onClick={() => window.print()} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] bg-white text-[var(--shell-muted)] hover:text-[var(--shell-text)]" title="Print">
              <TableIcon name="print" />
            </button>
            <button type="button" onClick={() => refetch()} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] bg-white text-[var(--shell-muted)] hover:text-[var(--shell-text)]" title="Refresh">
              <TableIcon name="refresh" />
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setIsCreateModalOpen(true);
              }}
              className="h-10 rounded-md bg-[var(--shell-primary)] px-4 text-sm font-bold text-white shadow-sm hover:opacity-90"
            >
              New Ticket
            </button>
          </div>
        </div>

        {isTicketsLoading ? (
          <SkeletonTable />
        ) : isTicketsError ? (
          <EmptyState message="Unable to load support tickets." />
        ) : pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)]">
                <tr className="text-left text-xs font-bold uppercase text-[var(--shell-muted)]">
                  <th className="whitespace-nowrap px-4 py-3">Ticket</th>
                  {isSuperAdmin ? <th className="whitespace-nowrap px-4 py-3">School</th> : null}
                  <th className="whitespace-nowrap px-4 py-3">Created By</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Priority</th>
                  <th className="whitespace-nowrap px-4 py-3">Assigned To</th>
                  <th className="whitespace-nowrap px-4 py-3">Created</th>
                  <th className="whitespace-nowrap px-4 py-3">Updated</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {pageRows.map((ticket: SupportTicket) => (
                  <tr key={ticket.id} className="align-top hover:bg-[var(--shell-subtle)]/70">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="font-semibold text-[var(--shell-text)]">{ticket.ticketNumber ?? ticket.id}</p>
                      <p className="mt-1 truncate text-[var(--shell-muted)]">{ticket.subject}</p>
                    </td>
                    {isSuperAdmin ? (
                      <td className="px-4 py-3 text-[var(--shell-muted)]">
                        <p className="font-medium text-[var(--shell-text)]">{ticket.school?.name ?? 'N/A'}</p>
                        <p className="text-xs">{ticket.school?.code ?? ''}</p>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 text-[var(--shell-muted)]">
                      <p>{ticket.createdBy?.name ?? 'N/A'}</p>
                      <p className="text-xs">{formatLabel(ticket.createdBy?.role)}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={statusBadgeClass(ticket.status)}>{formatLabel(ticket.status)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={priorityBadgeClass(ticket.priority)}>{formatLabel(ticket.priority)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{ticket.assignedTo?.name ?? 'Unassigned'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{formatDateTime(ticket.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{formatDateTime(ticket.updatedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link href={`/dashboard/support/${ticket.id}`} prefetch={false} className="inline-flex rounded-md bg-[var(--shell-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90">
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

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-4 py-3 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {pageStart} to {pageEnd} of {totalRows} entries
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-md border border-[var(--shell-border)] bg-white px-3 py-1.5 font-semibold text-[var(--shell-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            {pageItems.map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`h-8 min-w-8 rounded-md px-2 font-semibold ${
                    item === page ? 'bg-[var(--shell-primary)] text-white' : 'border border-[var(--shell-border)] bg-white text-[var(--shell-text)]'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="px-1">...</span>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[var(--shell-border)] bg-white px-3 py-1.5 font-semibold text-[var(--shell-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </DashboardPageContainer>
  );
}
