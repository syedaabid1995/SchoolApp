'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createSchoolAdmin,
  listSchoolAdmins,
  updateSchoolAdminStatus,
  type SchoolAdminsResponse,
} from '../../../../../services/school.service';
import { useNotify } from '../../../../../components/NotificationProvider';
import FullPageLoader from '../../../../../components/FullPageLoader';
import PageHeader from '../../../../../components/PageHeader';
import Button from '../../../../../components/Button';

type AdminRow = SchoolAdminsResponse['admins'][number];
type ToolbarAction = 'refresh' | 'export' | 'print' | 'pdf' | null;
type MoreAction = 'export-page' | 'export-all';

const pageSizes = [10, 20, 50, 100];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ToolbarButton({
  label,
  icon,
  onClick,
  loading = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusBadgeClass = (status: string) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'SUSPENDED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

export default function SchoolAdminsPage() {
  const params = useParams<{ id: string }>();
  const schoolId = params?.id ?? '';
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [adminEmail, setAdminEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState<{
    email: string;
    tempPassword: string;
    manualShareRequired?: boolean;
    manualShareUrl?: string | null;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [toolbarAction, setToolbarAction] = useState<ToolbarAction>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ admin: AdminRow; status: 'ACTIVE' | 'INACTIVE' } | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['school-admins', schoolId],
    queryFn: () => listSchoolAdmins(schoolId),
    enabled: Boolean(schoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const addAdminMutation = useMutation({
    mutationFn: () => createSchoolAdmin(schoolId, adminEmail.trim()),
    onSuccess: (result) => {
      setCreatedAdmin({
        email: result.adminUser.email,
        tempPassword: result.tempPassword,
        manualShareRequired: result.manualShareRequired,
        manualShareUrl: result.manualShareUrl,
      });
      setAdminEmail('');
      setEmailError('');
      queryClient.invalidateQueries({ queryKey: ['school-admins', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      notify.success('School admin added', `Added admin ${result.adminUser.email}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to add school admin';
      notify.error('Add admin failed', message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { adminId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      updateSchoolAdminStatus(schoolId, payload.adminId, payload.status),
    onSuccess: () => {
      setStatusTarget(null);
      queryClient.invalidateQueries({ queryKey: ['school-admins', schoolId] });
      notify.success('Status updated', 'School admin status updated');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update status';
      notify.error('Status update failed', message);
    },
  });

  const allRows = useMemo(() => data?.admins ?? [], [data]);
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return allRows.filter((admin) => {
      const matchesSearch =
        !search ||
        admin.email.toLowerCase().includes(search) ||
        (admin.createdBy ?? '').toLowerCase().includes(search);
      const matchesStatus = !statusFilter || admin.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allRows, query, statusFilter]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / limit));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min(page * limit, totalRows);
  const rows = useMemo(() => filteredRows.slice((page - 1) * limit, page * limit), [filteredRows, page, limit]);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const loaderLabel =
    toolbarAction === 'export'
      ? 'Preparing admin export...'
      : toolbarAction === 'refresh'
        ? 'Refreshing admins...'
        : 'Loading admins...';
  const isBusy =
    isLoading ||
    statusMutation.isPending ||
    toolbarAction === 'refresh' ||
    toolbarAction === 'export';

  const openAddDrawer = () => {
    setAdminEmail('');
    setEmailError('');
    setCreatedAdmin(null);
    setIsAddDrawerOpen(true);
  };

  const closeAddDrawer = () => {
    if (addAdminMutation.isPending) return;
    setIsAddDrawerOpen(false);
    setEmailError('');
    setCreatedAdmin(null);
  };

  const submitAddAdmin = () => {
    const email = adminEmail.trim();
    if (!email) {
      setEmailError('Admin email is required.');
      notify.error('Validation error', 'Admin email is required.');
      return;
    }
    if (!emailPattern.test(email)) {
      setEmailError('Enter a valid admin email address.');
      notify.error('Validation error', 'Enter a valid admin email address.');
      return;
    }
    addAdminMutation.mutate();
  };

  const refreshAdmins = async () => {
    setToolbarAction('refresh');
    setIsMoreOpen(false);
    try {
      await refetch();
      notify.success('Admins refreshed', 'The latest admin list has been loaded.');
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to refresh admins.';
      notify.error('Refresh failed', message);
    } finally {
      setToolbarAction(null);
    }
  };

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const downloadAdminsCsv = (items: AdminRow[], filename: string) => {
    const headers = ['Email', 'Status', 'Created By', 'Created At'];
    const body = items.map((admin) => [admin.email, admin.status, admin.createdBy ?? 'System', admin.createdAt]);
    const csv = [headers, ...body].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAdmins = (mode: MoreAction = 'export-all') => {
    setToolbarAction('export');
    setIsMoreOpen(false);
    try {
      const items = mode === 'export-page' ? rows : filteredRows;
      if (items.length === 0) {
        notify.warning('No admins to export', 'There are no rows for the current filter.');
        return;
      }
      const date = new Date().toISOString().slice(0, 10);
      downloadAdminsCsv(items, mode === 'export-page' ? `school-admins-page-${page}-${date}.csv` : `school-admins-all-${date}.csv`);
      notify.success('Export ready', `${items.length} admin rows exported.`);
    } finally {
      setToolbarAction(null);
    }
  };

  const printAdmins = (asPdf = false) => {
    setToolbarAction(asPdf ? 'pdf' : 'print');
    setIsMoreOpen(false);
    if (asPdf) notify.info('Save as PDF', 'Choose "Save as PDF" in the print dialog.');
    window.setTimeout(() => {
      window.print();
      setToolbarAction(null);
    }, 100);
  };

  const openStatusConfirmation = (admin: AdminRow) => {
    setStatusTarget({
      admin,
      status: admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {isBusy ? <FullPageLoader label={loaderLabel} /> : null}
      <PageHeader
        title="School Admins"
        subtitle={data?.school ? `${data.school.name} (${data.school.code})` : 'Manage multiple admins for this school.'}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Schools', href: '/dashboard/schools' },
          { label: 'Admins' },
        ]}
      />

      <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 p-3">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0Zm6 0a3 3 0 11-6 0 3 3 0 016 0Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Admins List</h2>
              <p className="text-sm text-gray-500">{totalRows} admins found</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={openAddDrawer}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              iconPosition="left"
            >
              Add Admin
            </Button>
            <Link
              href="/dashboard/schools"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 18-6-6 6-6" />
              </svg>
              Back
            </Link>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search admins by email or creator..."
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              Showing {pageStart}-{pageEnd}
            </span>{' '}
            of {totalRows} admins
            {isFetching && !isLoading ? <span className="ml-2 text-xs font-semibold text-indigo-600">Updating...</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToolbarButton
              label="Refresh"
              loading={toolbarAction === 'refresh'}
              onClick={refreshAdmins}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5M19 5h-5M5 19h5" />
                </svg>
              }
            />
            <ToolbarButton
              label="Export"
              loading={toolbarAction === 'export'}
              onClick={() => exportAdmins('export-all')}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
                </svg>
              }
            />
            <ToolbarButton
              label="Print"
              loading={toolbarAction === 'print'}
              onClick={() => printAdmins(false)}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6v-7z" />
                </svg>
              }
            />
            <ToolbarButton
              label="PDF"
              loading={toolbarAction === 'pdf'}
              onClick={() => printAdmins(true)}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13H7V3zM14 3v6h5M9 14h6M9 17h4" />
                </svg>
              }
            />
            <div className="relative">
              <ToolbarButton
                label="More"
                onClick={() => setIsMoreOpen((open) => !open)}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75h.01M12 12h.01M12 17.25h.01" />
                  </svg>
                }
              />
              {isMoreOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-2 text-sm shadow-xl">
                  <button
                    type="button"
                    onClick={() => exportAdmins('export-page')}
                    className="flex w-full items-center justify-between px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Export current page
                    <span className="text-xs text-gray-400">CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportAdmins('export-all')}
                    className="flex w-full items-center justify-between px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Export all pages
                    <span className="text-xs text-gray-400">CSV</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created By</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="mt-2 text-sm">Loading admins...</p>
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No school admins found.
                  </td>
                </tr>
              ) : (
                rows.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-sm font-bold text-white">
                          {admin.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-gray-900">{admin.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(admin.status)}`}>
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{admin.createdBy ?? 'System'}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(admin.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openStatusConfirmation(admin)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                          admin.status === 'ACTIVE'
                            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {admin.status === 'ACTIVE' ? (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                            </svg>
                            Deactivate
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Page <span className="font-semibold text-gray-900">{page}</span> of{' '}
              <span className="font-semibold text-gray-900">{totalPages}</span>
            </span>
            <label className="flex items-center gap-2">
              Rows
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
              First
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 18-6-6 6-6" />
              </svg>
              Prev
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`h-9 min-w-9 rounded-lg border px-3 font-semibold ${
                  pageNumber === page
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Last
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m13 17 5-5-5-5M6 17l5-5-5-5" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {statusTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-status-title">
          <button
            type="button"
            aria-label="Cancel status change"
            className="absolute inset-0 cursor-default"
            onClick={() => setStatusTarget(null)}
            disabled={statusMutation.isPending}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-amber-100 p-3 text-amber-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 4.3 2.7 18a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0Z" />
                </svg>
              </div>
              <div>
                <h2 id="admin-status-title" className="text-lg font-bold text-slate-950">
                  {statusTarget.status === 'ACTIVE' ? 'Activate admin?' : 'Deactivate admin?'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  This will set <span className="font-semibold text-slate-950">{statusTarget.admin.email}</span> to{' '}
                  <span className="font-semibold">{statusTarget.status}</span>.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" size="sm" type="button" onClick={() => setStatusTarget(null)} disabled={statusMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant={statusTarget.status === 'ACTIVE' ? 'success' : 'danger'}
                size="sm"
                type="button"
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    adminId: statusTarget.admin.id,
                    status: statusTarget.status,
                  })
                }
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddDrawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="add-admin-title">
          <button
            type="button"
            aria-label="Close add admin"
            className="absolute inset-0 cursor-default"
            onClick={closeAddDrawer}
            disabled={addAdminMutation.isPending}
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">School admin setup</p>
                <h2 id="add-admin-title" className="mt-1 text-2xl font-bold text-[var(--shell-text)]">
                  Add Admin
                </h2>
                <p className="text-sm text-[var(--shell-muted)]">Create an additional school admin account.</p>
              </div>
              <button
                type="button"
                onClick={closeAddDrawer}
                className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50"
                disabled={addAdminMutation.isPending}
              >
                Close
              </button>
            </div>

            <div className="space-y-5 py-5">
              {createdAdmin ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-emerald-500 p-2">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-950">School admin created successfully</h3>
                      <p className="mt-1 text-sm text-emerald-800">
                        Share these credentials once. The temporary password will not be shown again.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 rounded-lg bg-white/70 p-4 text-sm text-emerald-950 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">Email</p>
                      <p className="mt-1 break-all font-semibold">{createdAdmin.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">Temporary Password</p>
                      <code className="mt-1 inline-block rounded bg-emerald-100 px-2 py-1 font-mono text-sm">
                        {createdAdmin.tempPassword}
                      </code>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-3">
                    {createdAdmin.manualShareUrl ? (
                      <a
                        href={createdAdmin.manualShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Share via WhatsApp
                      </a>
                    ) : null}
                    <Button variant="outline" size="sm" type="button" onClick={closeAddDrawer}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAddAdmin();
                  }}
                >
                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--shell-text)]">Admin email</span>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(event) => {
                        setAdminEmail(event.target.value);
                        setEmailError('');
                      }}
                      placeholder="admin@school.com"
                      className={`mt-1 w-full rounded-xl border bg-[var(--shell-subtle)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 ${
                        emailError
                          ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                          : 'border-[var(--shell-border)] focus:border-indigo-500 focus:ring-indigo-100'
                      }`}
                    />
                    {emailError ? <p className="mt-1 text-xs font-semibold text-rose-600">{emailError}</p> : null}
                  </label>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    The new school admin receives a temporary password. Share it securely and ask them to change it after login.
                  </div>

                  <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--shell-border)] pt-5">
                    <Button variant="outline" size="sm" type="button" onClick={closeAddDrawer} disabled={addAdminMutation.isPending}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      loading={addAdminMutation.isPending}
                      icon={
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      }
                      iconPosition="left"
                    >
                      Add Admin
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
