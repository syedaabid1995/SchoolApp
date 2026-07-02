'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DashboardPageContainer from '../../../components/DashboardPageContainer';
import { useNotify } from '../../../components/NotificationProvider';
import {
  approveDemoRequest,
  listDemoRequests,
  type DemoRequest,
  type DemoRequestStatus,
} from '../../../services/demo-request.service';

const pageSizes = [10, 20, 50, 100];

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

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-8 text-center text-sm text-[var(--shell-muted)]">
      {message}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
      ))}
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

export default function DemoRequestsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DemoRequestStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

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

  const requests = useMemo(() => query.data ?? [], [query.data]);
  const totalRows = requests.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min(page * limit, totalRows);
  const pageRows = useMemo(() => requests.slice((page - 1) * limit, page * limit), [limit, page, requests]);
  const pageItems = useMemo(() => getPageItems(page, totalPages), [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [status, search, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setStatus('');
    setSearch('');
  };

  return (
    <DashboardPageContainer maxWidthClassName="max-w-none" className="space-y-4">
      <header className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--shell-text)]">Demo Requests</h1>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">Review demo bookings and send approval links.</p>
          </div>
          <span className="text-sm font-semibold text-[var(--shell-muted)]">Dashboard / Demo Requests</span>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="border-b border-[var(--shell-border)] px-4 py-3">
          <h2 className="text-base font-bold text-[var(--shell-text)]">Select Criteria</h2>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_220px_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, or school"
              className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-[var(--shell-text)]">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as DemoRequestStatus | '')}
              className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-white px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[var(--shell-primary)] focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="h-10 rounded-md border border-[var(--shell-border)] bg-white px-4 text-sm font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-subtle)]"
          >
            Reset
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--shell-text)]">Demo Request List</h2>
            <p className="mt-0.5 text-sm text-[var(--shell-muted)]">
              Showing {formatNumber(pageStart)} to {formatNumber(pageEnd)} of {formatNumber(totalRows)} requests
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
            <button type="button" onClick={() => query.refetch()} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] bg-white text-[var(--shell-muted)] hover:text-[var(--shell-text)]" title="Refresh">
              <TableIcon name="refresh" />
            </button>
          </div>
        </div>

        {query.isLoading ? (
          <SkeletonRows />
        ) : query.isError ? (
          <EmptyState message="Unable to load demo requests." />
        ) : pageRows.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)]">
                <tr className="text-left text-xs font-bold uppercase text-[var(--shell-muted)]">
                  <th className="whitespace-nowrap px-4 py-3">School</th>
                  <th className="whitespace-nowrap px-4 py-3">Contact</th>
                  <th className="whitespace-nowrap px-4 py-3">Students</th>
                  <th className="whitespace-nowrap px-4 py-3">Staff</th>
                  <th className="whitespace-nowrap px-4 py-3">Submitted</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Approval</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {pageRows.map((request: DemoRequest) => (
                  <tr key={request.id} className="align-top hover:bg-[var(--shell-subtle)]/70">
                    <td className="max-w-[280px] px-4 py-3">
                      <p className="font-semibold text-[var(--shell-text)]">{request.schoolName}</p>
                      {request.message ? <p className="mt-1 truncate text-xs text-[var(--shell-muted)]">{request.message}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-[var(--shell-muted)]">
                      <p className="font-medium text-[var(--shell-text)]">{request.name}</p>
                      <p>{request.email}</p>
                      {request.phone ? <p>{request.phone}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--shell-text)]">{formatNumber(request.studentCount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--shell-text)]">{formatNumber(request.staffCount)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{formatDateTime(request.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={statusClass(request.status)}>{request.status}</Badge>
                    </td>
                    <td className="min-w-[210px] px-4 py-3 text-[var(--shell-muted)]">
                      {request.status === 'APPROVED' ? (
                        <>
                          <p>By {request.approvedBy?.email ?? 'admin'}</p>
                          <p className="text-xs">Expires {formatDateTime(request.approvalTokenExpiresAt)}</p>
                          <p className="text-xs">Email {request.emailDeliveryStatus ?? 'N/A'}</p>
                        </>
                      ) : (
                        <span>Pending approval</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={request.status === 'APPROVED' || (approveMutation.isPending && approveMutation.variables === request.id)}
                        onClick={() => approveMutation.mutate(request.id)}
                        className="rounded-md bg-[var(--shell-primary)] px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {request.status === 'APPROVED' ? 'Approved' : approveMutation.isPending && approveMutation.variables === request.id ? 'Approving...' : 'Approve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No demo requests found." />
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-4 py-3 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {formatNumber(pageStart)} to {formatNumber(pageEnd)} of {formatNumber(totalRows)} entries
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
