'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import {
  generateSubscriptionInvoice,
  getSchoolSubscriptionDetail,
  getSchoolSubscriptions,
  type SchoolSubscriptionListItem,
} from '../../../services/subscription.service';

const statusOptions = ['ACTIVE', 'TRIAL', 'PAUSED', 'CANCELLED', 'EXPIRED', 'OVERDUE', 'PENDING'];
const billingCycles = ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'YEARLY'];
const pageSizes = [10, 20, 50, 100];

const formatLabel = (value?: string | null) =>
  (value ?? 'N/A')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatCurrency = (value?: number | null, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const statusBadgeClass = (status?: string | null) => {
  if (status === 'ACTIVE' || status === 'PAID') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'TRIAL') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (status === 'PAUSED' || status === 'PENDING' || status === 'PARTIAL') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  if (status === 'EXPIRED' || status === 'OVERDUE' || status === 'UNPAID') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-violet-50 text-violet-700 ring-violet-200';
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

type TableIconName = 'copy' | 'file' | 'print' | 'search' | 'refresh' | 'chevron';

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
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
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

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    billingCycle: '',
  });

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  useEffect(() => {
    const urlSearch = searchParams.get('search') ?? searchParams.get('query') ?? '';
    if (urlSearch) setFilters((current) => ({ ...current, search: urlSearch, page: 1 }));
  }, [searchParams]);

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, isSuperAdmin, router, session?.role]);

  const queryParams = useMemo(() => ({
    page: filters.page,
    limit: filters.limit,
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    billingCycle: filters.billingCycle || undefined,
  }), [filters]);

  const {
    data: subscriptions,
    isLoading: isBillingLoading,
    isError: isBillingError,
    refetch,
  } = useQuery({
    queryKey: ['billing-subscriptions', queryParams],
    queryFn: () => getSchoolSubscriptions(queryParams),
    enabled: isSuperAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['billing-detail', selectedSchoolId],
    queryFn: () => getSchoolSubscriptionDetail(selectedSchoolId as string),
    enabled: Boolean(selectedSchoolId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const invoiceMutation = useMutation({
    mutationFn: (item: SchoolSubscriptionListItem) => generateSubscriptionInvoice(item.schoolId),
    onSuccess: () => {
      notify.success('Invoice generated', 'The billing record was generated for this subscription.');
      queryClient.invalidateQueries({ queryKey: ['billing-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['billing-detail'] });
      queryClient.invalidateQueries({ queryKey: ['school-subscriptions'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to generate invoice.';
      notify.error('Invoice failed', message);
    },
  });

  const rows = subscriptions?.items ?? [];
  const pagination = subscriptions?.pagination;
  const totalRows = pagination?.total ?? rows.length;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const pageStart = totalRows === 0 ? 0 : ((filters.page - 1) * filters.limit) + 1;
  const pageEnd = Math.min(filters.page * filters.limit, totalRows);

  const setFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'page' ? {} : { page: 1 }),
    }));
  };

  const exportRows = () => {
    const header = ['School', 'Plan', 'Billing Cycle', 'Amount', 'Current Period', 'Status'];
    const body = rows.map((item) => [
      item.schoolName,
      item.planName ?? 'No plan assigned',
      formatLabel(item.billingCycle),
      formatCurrency(item.price, item.currency),
      `${formatDate(item.currentPeriodStart)} to ${formatDate(item.currentPeriodEnd)}`,
      formatLabel(item.status),
    ]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-page-${filters.page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyRows = async () => {
    const text = rows
      .map((item) => `${item.schoolName}\t${item.planName ?? 'No plan assigned'}\t${formatLabel(item.billingCycle)}\t${formatCurrency(item.price, item.currency)}\t${formatLabel(item.status)}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    notify.success('Copied', 'Visible billing rows copied.');
  };

  const printRows = () => {
    const htmlRows = rows
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.schoolName)}</td>
          <td>${escapeHtml(item.planName ?? 'No plan assigned')}</td>
          <td>${escapeHtml(formatLabel(item.billingCycle))}</td>
          <td>${escapeHtml(formatCurrency(item.price, item.currency))}</td>
          <td>${escapeHtml(`${formatDate(item.currentPeriodStart)} to ${formatDate(item.currentPeriodEnd)}`)}</td>
          <td>${escapeHtml(formatLabel(item.status))}</td>
        </tr>
      `)
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Billing</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f6f8}</style></head>
        <body><h1>Billing</h1><table><thead><tr><th>School</th><th>Plan</th><th>Cycle</th><th>Amount</th><th>Period</th><th>Status</th></tr></thead><tbody>${htmlRows}</tbody></table></body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 pb-8">
      {isBillingLoading || invoiceMutation.isPending ? <FullPageLoader label="Loading billing..." /> : null}

      <header className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--shell-text)]">Billing</h1>
            <p className="mt-1 text-sm text-[var(--shell-muted)]">Review billing cycle, amount, period, invoice, and payment records.</p>
          </div>
          <span className="text-sm font-semibold text-[var(--shell-muted)]">Dashboard / Billing</span>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="border-b border-[var(--shell-border)] px-4 py-3">
          <h2 className="text-lg font-bold text-[var(--shell-text)]">Select Criteria</h2>
        </div>
        <div className="grid gap-3 px-4 py-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_auto] xl:items-end">
          <label>
            <span className="text-sm font-semibold text-[var(--shell-text)]">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="School name, code, plan"
              className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilter('status', value)}>
            <option value="">All statuses</option>
            {statusOptions.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
          </FilterSelect>
          <FilterSelect label="Billing Cycle" value={filters.billingCycle} onChange={(value) => setFilter('billingCycle', value)}>
            <option value="">Any cycle</option>
            {billingCycles.map((cycle) => <option key={cycle} value={cycle}>{formatLabel(cycle)}</option>)}
          </FilterSelect>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <TableIcon name="search" />
            Search
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--shell-text)]">Billing Details</h2>
            <p className="text-sm text-[var(--shell-muted)]">{totalRows} records found</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <select
                value={filters.limit}
                onChange={(event) => setFilter('limit', Number(event.target.value))}
                className="h-9 appearance-none rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 pr-8 text-sm font-semibold text-[var(--shell-text)] outline-none"
              >
                {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <TableIcon name="chevron" className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-[var(--shell-muted)]" />
            </label>
            <ToolbarButton label="Copy" onClick={copyRows}><TableIcon name="copy" /></ToolbarButton>
            <ToolbarButton label="Export CSV" onClick={exportRows}><TableIcon name="file" /></ToolbarButton>
            <ToolbarButton label="Print" onClick={printRows}><TableIcon name="print" /></ToolbarButton>
            <ToolbarButton label="Refresh" onClick={() => refetch()}><TableIcon name="refresh" /></ToolbarButton>
          </div>
        </div>

        {isBillingError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load billing details.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
              Retry
            </button>
          </div>
        ) : rows.length === 0 && !isBillingLoading ? (
          <div className="p-10 text-center text-sm text-[var(--shell-muted)]">No billing records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-y border-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-sm font-semibold text-[var(--shell-text)]">
                <tr>
                  <th className="px-4 py-3">School</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Billing Cycle</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Current Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {rows.map((item) => (
                  <tr key={item.schoolId} className="hover:bg-[var(--shell-hover)]">
                    <td className="min-w-[18rem] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold uppercase text-white">
                          {(item.schoolName || 'SC').slice(0, 2)}
                        </span>
                        <div>
                          <div className="font-semibold text-[var(--shell-text)]">{item.schoolName}</div>
                          <div className="mt-1 text-xs text-[var(--shell-muted)]">{item.schoolCode ?? 'No code'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[12rem] px-4 py-3 font-semibold text-[var(--shell-text)]">{item.planName ?? 'No plan assigned'}</td>
                    <td className="px-4 py-3 text-[var(--shell-muted)]">{formatLabel(item.billingCycle)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{formatCurrency(item.price, item.currency)}</td>
                    <td className="min-w-[14rem] px-4 py-3 text-[var(--shell-muted)]">
                      {formatDate(item.currentPeriodStart)} to {formatDate(item.currentPeriodEnd)}
                    </td>
                    <td className="px-4 py-3"><Badge className={statusBadgeClass(item.status)}>{formatLabel(item.status)}</Badge></td>
                    <td className="min-w-[12rem] px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => setSelectedSchoolId(item.schoolId)}>View</ActionButton>
                        <ActionButton onClick={() => invoiceMutation.mutate(item)}>Invoice</ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-4 py-3 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {pageStart} to {pageEnd} of {totalRows} entries</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', Math.max(1, filters.page - 1))}
              className="rounded-md border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            {getPageItems(filters.page, totalPages).map((item) => typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                onClick={() => setFilter('page', item)}
                className={`min-w-9 rounded-md border px-3 py-1.5 font-semibold ${
                  item === filters.page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-[var(--shell-border)] text-[var(--shell-text)]'
                }`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="px-1 py-1.5">...</span>
            ))}
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
              className="rounded-md border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedSchoolId ? (
        <BillingDetailDrawer
          detail={detail}
          loading={isDetailLoading}
          onClose={() => setSelectedSchoolId(null)}
        />
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="text-sm font-semibold text-[var(--shell-text)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
    </label>
  );
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--shell-border)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"
    >
      {children}
    </button>
  );
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-md border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-2.5 text-xs font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
    >
      {children}
    </button>
  );
}

function BillingDetailDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: Awaited<ReturnType<typeof getSchoolSubscriptionDetail>> | undefined;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <button type="button" aria-label="Close billing detail" className="absolute inset-0 cursor-default" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Billing detail</p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{detail?.school.name ?? 'Loading school...'}</h2>
            <p className="text-sm text-[var(--shell-muted)]">{detail?.school.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">
            Close
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-8 text-sm text-[var(--shell-muted)]">Loading billing detail...</div>
        ) : (
          <div className="space-y-4 py-5">
            <section className="grid gap-3 sm:grid-cols-3">
              <InfoBox label="Plan" value={detail.subscription?.plan?.name ?? 'No plan assigned'} />
              <InfoBox label="Billing Cycle" value={formatLabel(detail.subscription?.plan?.billingCycle)} />
              <InfoBox label="Current Period" value={`${formatDate(detail.subscription?.currentPeriodStart)} to ${formatDate(detail.subscription?.currentPeriodEnd)}`} />
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--shell-border)]">
              <div className="border-b border-[var(--shell-border)] px-4 py-3">
                <h3 className="text-sm font-bold text-[var(--shell-text)]">Invoices</h3>
              </div>
              {detail.invoices.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--shell-subtle)] text-left font-semibold text-[var(--shell-text)]">
                      <tr>
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Period</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Balance</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--shell-border)]">
                      {detail.invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{invoice.invoiceNumber}</td>
                          <td className="min-w-[12rem] px-4 py-3 text-[var(--shell-muted)]">{formatDate(invoice.billingPeriodStart)} to {formatDate(invoice.billingPeriodEnd)}</td>
                          <td className="px-4 py-3 text-[var(--shell-muted)]">{formatDate(invoice.dueDate)}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{formatCurrency(invoice.totalAmount)}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{formatCurrency(invoice.balanceAmount)}</td>
                          <td className="px-4 py-3"><Badge className={statusBadgeClass(invoice.status)}>{formatLabel(invoice.status)}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-sm text-[var(--shell-muted)]">{detail.billingMessage ?? 'No invoice records are available.'}</p>
              )}
            </section>

            <section className="overflow-hidden rounded-lg border border-[var(--shell-border)]">
              <div className="border-b border-[var(--shell-border)] px-4 py-3">
                <h3 className="text-sm font-bold text-[var(--shell-text)]">Payments</h3>
              </div>
              {detail.manualPayments.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[var(--shell-subtle)] text-left font-semibold text-[var(--shell-text)]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Mode</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Received By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--shell-border)]">
                      {detail.manualPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-4 py-3 text-[var(--shell-muted)]">{formatDate(payment.paymentDate)}</td>
                          <td className="px-4 py-3 text-[var(--shell-muted)]">{formatLabel(payment.paymentMode)}</td>
                          <td className="px-4 py-3 text-[var(--shell-muted)]">{payment.referenceNumber ?? 'N/A'}</td>
                          <td className="px-4 py-3 font-semibold text-[var(--shell-text)]">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-[var(--shell-muted)]">{payment.receivedByEmail ?? payment.receivedByUserId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-sm text-[var(--shell-muted)]">No payment records are available.</p>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-[var(--shell-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--shell-text)]">{value}</p>
    </div>
  );
}
