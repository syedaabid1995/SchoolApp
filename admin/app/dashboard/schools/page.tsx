'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  listSchools,
  createSchool,
  activateSchool,
  suspendSchool,
  deleteSchool,
  restoreSchool,
  type School,
} from '../../../services/school.service';
import { listSubscriptionPlans, upsertSubscription } from '../../../services/subscription.service';
import { useNotify } from '../../../components/NotificationProvider';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';

type ToolbarAction = 'refresh' | 'export' | 'print' | 'pdf' | null;
type MoreAction = 'export-page' | 'export-all';

const pageSizes = [10, 20, 50, 100];

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

export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    subscriptionPlan: 'STANDARD',
    adminEmail: '',
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCodeAuto, setIsCodeAuto] = useState(true);
  const [createdAdmin, setCreatedAdmin] = useState<{
    email: string;
    tempPassword: string;
    manualShareRequired?: boolean;
    manualShareUrl?: string | null;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<'name' | 'code' | 'subscriptionPlan' | 'adminEmail', string>>>({});
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [toolbarAction, setToolbarAction] = useState<ToolbarAction>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, showDeleted, limit]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['schools', debouncedQuery, showDeleted, page, limit],
    queryFn: () => listSchools({ page, limit, query: debouncedQuery, includeDeleted: showDeleted }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: totalData, refetch: refetchTotal } = useQuery({
    queryKey: ['schools-total', showDeleted],
    queryFn: () => listSchools({ page: 1, limit: 1, includeDeleted: showDeleted }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => listSubscriptionPlans(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });
  const activePlans = plans?.filter((plan) => plan.status === 'ACTIVE') ?? [];


  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: (result) => {
      const createdSchoolName = form.name.trim();
      setForm({ name: '', code: '', subscriptionPlan: 'STANDARD', adminEmail: '' });
      setFormErrors({});
      setIsCodeAuto(true);
      if (result.adminUser && result.tempPassword) {
        setCreatedAdmin({
          email: result.adminUser.email,
          tempPassword: result.tempPassword,
          manualShareRequired: result.manualShareRequired,
          manualShareUrl: result.manualShareUrl,
        });
        notify.success('School created successfully!', `${createdSchoolName} has been created with admin account`);
      } else {
        setCreatedAdmin(null);
        setIsCreateModalOpen(false);
        notify.success('School created!', `${createdSchoolName} has been created successfully`);
      }
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['schools-total'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create school';
      notify.error('School creation failed', message);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'activate' | 'suspend' | 'delete' | 'restore' }) => {
      if (payload.action === 'activate') return activateSchool(payload.id);
      if (payload.action === 'suspend') return suspendSchool(payload.id);
      if (payload.action === 'restore') return restoreSchool(payload.id);
      return deleteSchool(payload.id);
    },
    onSuccess: (data, variables) => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      const actionText =
        variables.action === 'activate'
          ? 'activated'
          : variables.action === 'suspend'
            ? 'suspended'
            : variables.action === 'restore'
              ? 'restored'
              : 'deleted';
      notify.success(`School ${actionText}!`, `School has been ${actionText} successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to process school action';
      notify.error('Action failed', message);
    },
  });

  const planUpdateMutation = useMutation({
    mutationFn: async (payload: { schoolId: string; planId: string }) => {
      const plan = plans?.find((item) => item.id === payload.planId);
      if (!plan) {
        throw new Error('Plan not found');
      }
      return upsertSubscription({
        schoolId: payload.schoolId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      notify.success('Plan updated', 'Subscription plan updated for school');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update plan';
      notify.error('Plan update failed', message);
    },
  });

  const testExpiryMutation = useMutation({
    mutationFn: async (payload: { schoolId: string; endsAt: string }) => {
      const school = rows.find((item) => item.id === payload.schoolId);
      if (!school) throw new Error('School not found');
      const plan = plans?.find((item) => item.name === school.subscriptionPlan);
      if (!plan) throw new Error('Plan not found for this school');
      const endsAt = new Date(`${payload.endsAt}T23:59:59`);
      if (Number.isNaN(endsAt.getTime())) throw new Error('Invalid expiry date');
      return upsertSubscription({
        schoolId: payload.schoolId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
        endsAt: endsAt.toISOString(),
        paidAt: new Date().toISOString(),
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
      });
    },
    onSuccess: (_, variables) => {
      notify.success('Expiry date updated', 'Test subscription expiry date saved');
      setExpiryDates((prev) => ({ ...prev, [variables.schoolId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to set expiry date';
      notify.error('Expiry update failed', message);
    },
  });

  const rows = useMemo(() => data?.items ?? [], [data]);
  const totalSchools = totalData?.total ?? data?.total ?? 0;
  const totalRows = data?.total ?? 0;
  const totalPages = Math.max(1, data?.pages ?? Math.ceil(totalRows / limit));
  const pageStart = totalRows === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = totalRows === 0 ? 0 : Math.min(page * limit, totalRows);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);
  const loaderLabel =
    toolbarAction === 'export'
      ? 'Preparing school export...'
      : toolbarAction === 'refresh'
        ? 'Refreshing schools...'
        : 'Loading schools...';
  const isBusy =
    isLoading ||
    actionMutation.isPending ||
    planUpdateMutation.isPending ||
    testExpiryMutation.isPending ||
    toolbarAction === 'refresh' ||
    toolbarAction === 'export';

  const buildSchoolCode = (name: string, nextIndex: number) => {
    const prefix = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3);
    if (!prefix) return '';
    const suffix = String(nextIndex).padStart(5, '0');
    return `${prefix}_${suffix}`;
  };

  useEffect(() => {
    if (!isCodeAuto) return;
    const nextIndex = totalSchools + 1;
    const generated = buildSchoolCode(form.name, nextIndex);
    if (!generated) return;
    setForm((prev) => ({ ...prev, code: generated }));
  }, [form.name, totalSchools, isCodeAuto]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const openCreateModal = () => {
    setForm({ name: '', code: '', subscriptionPlan: 'STANDARD', adminEmail: '' });
    setFormErrors({});
    setCreatedAdmin(null);
    setIsCodeAuto(true);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createMutation.isPending) return;
    setIsCreateModalOpen(false);
    setFormErrors({});
    setCreatedAdmin(null);
  };

  const validateCreateForm = () => {
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim();
    const trimmedEmail = form.adminEmail.trim();
    const nextErrors: Partial<Record<'name' | 'code' | 'subscriptionPlan' | 'adminEmail', string>> = {};

    if (!trimmedName) nextErrors.name = 'School name is required.';
    else if (trimmedName.length < 2) nextErrors.name = 'School name must be at least 2 characters.';

    if (!trimmedCode) nextErrors.code = 'School code is required.';
    else if (!/^[A-Z0-9_-]{2,32}$/.test(trimmedCode)) {
      nextErrors.code = 'Use 2-32 uppercase letters, numbers, hyphen, or underscore.';
    }

    if (!form.subscriptionPlan) nextErrors.subscriptionPlan = 'Select a subscription plan.';

    if (!trimmedEmail) nextErrors.adminEmail = 'Admin email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.adminEmail = 'Enter a valid admin email address.';
    }

    setFormErrors(nextErrors);
    return { errors: nextErrors, isValid: Object.keys(nextErrors).length === 0, trimmedName, trimmedCode, trimmedEmail };
  };

  const submitCreateSchool = () => {
    const result = validateCreateForm();
    if (!result.isValid) {
      notify.error('Validation error', Object.values(result.errors)[0] || 'Please check the highlighted fields.');
      return;
    }
    createMutation.mutate({
      ...form,
      name: result.trimmedName,
      code: result.trimmedCode,
      adminEmail: result.trimmedEmail,
    });
  };

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const downloadSchoolsCsv = (items: typeof rows, filename: string) => {
    const headers = [
      'Name',
      'Code',
      'Status',
      'Plan',
      'Admin Email',
      'Active Users',
      'Last Login',
      'Deleted At',
      'Created At',
      'Updated At',
    ];
    const body = items.map((school) => [
      school.name,
      school.code,
      school.status,
      school.subscriptionPlan,
      school.adminEmail ?? school.adminEmails?.join('; ') ?? '',
      school.activeUsersCount,
      school.lastLoginAt ?? '',
      school.deletedAt ?? '',
      school.createdAt,
      school.updatedAt,
    ]);
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

  const exportSchools = async (mode: MoreAction = 'export-all') => {
    setToolbarAction('export');
    setIsMoreOpen(false);
    try {
      let items = rows;
      if (mode === 'export-all') {
        const exportLimit = 100;
        const exportPages = Math.max(1, Math.ceil(totalRows / exportLimit));
        const allRows: typeof rows = [];
        for (let pageNumber = 1; pageNumber <= exportPages; pageNumber += 1) {
          const result = await listSchools({
            page: pageNumber,
            limit: exportLimit,
            query: debouncedQuery,
            includeDeleted: showDeleted,
          });
          allRows.push(...result.items);
        }
        items = allRows;
      }

      if (items.length === 0) {
        notify.warning('No schools to export', 'There are no rows for the current filter.');
        return;
      }

      const date = new Date().toISOString().slice(0, 10);
      downloadSchoolsCsv(items, mode === 'export-page' ? `schools-page-${page}-${date}.csv` : `schools-all-${date}.csv`);
      notify.success('Export ready', `${items.length} school rows exported.`);
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to export schools.';
      notify.error('Export failed', message);
    } finally {
      setToolbarAction(null);
    }
  };

  const refreshSchools = async () => {
    setToolbarAction('refresh');
    setIsMoreOpen(false);
    try {
      await Promise.all([refetch(), refetchTotal()]);
      notify.success('Schools refreshed', 'The latest school list has been loaded.');
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to refresh schools.';
      notify.error('Refresh failed', message);
    } finally {
      setToolbarAction(null);
    }
  };

  const printSchools = (asPdf = false) => {
    setToolbarAction(asPdf ? 'pdf' : 'print');
    setIsMoreOpen(false);
    if (asPdf) {
      notify.info('Save as PDF', 'Choose "Save as PDF" in the print dialog.');
    }
    window.setTimeout(() => {
      window.print();
      setToolbarAction(null);
    }, 100);
  };

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label={loaderLabel} /> : null}
      <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
        <PageHeader title="Schools" subtitle="Manage tenant lifecycle, status, and subscription visibility." />


        {/* School Directory */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-br from-blue-100 to-purple-100 p-3">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">School Directory</h2>
                <p className="text-sm text-gray-500">{rows.length} schools registered</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
                iconPosition="left"
              >
                Add School
              </Button>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search schools..."
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                Show deleted
              </label>
            </div>
          </div>
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                Showing {pageStart}-{pageEnd}
              </span>{' '}
              of {totalRows} schools
              {isFetching && !isLoading ? <span className="ml-2 text-xs font-semibold text-indigo-600">Updating...</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToolbarButton
                label="Refresh"
                loading={toolbarAction === 'refresh'}
                onClick={refreshSchools}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0119 5M19 5h-5M5 19h5" />
                  </svg>
                }
              />
              <ToolbarButton
                label="Export"
                loading={toolbarAction === 'export'}
                onClick={() => exportSchools('export-all')}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />
                  </svg>
                }
              />
              <ToolbarButton
                label="Print"
                loading={toolbarAction === 'print'}
                onClick={() => printSchools(false)}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6v-7z" />
                  </svg>
                }
              />
              <ToolbarButton
                label="PDF"
                loading={toolbarAction === 'pdf'}
                onClick={() => printSchools(true)}
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
                      onClick={() => exportSchools('export-page')}
                      className="flex w-full items-center justify-between px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Export current page
                      <span className="text-xs text-gray-400">CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportSchools('export-all')}
                      className="flex w-full items-center justify-between px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Export all pages
                      <span className="text-xs text-gray-400">CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        setShowDeleted((current) => !current);
                      }}
                      className="flex w-full items-center justify-between px-4 py-2 text-left font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      {showDeleted ? 'Hide deleted' : 'Show deleted'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Deleted At</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Plan</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Test Expiry</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="mt-2 text-sm">Loading schools...</p>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center text-gray-400">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <p className="mt-2 text-sm font-medium text-gray-600">No schools found</p>
                        <p className="text-xs text-gray-500">Use Add School to create your first school.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold">
                            {school.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3 text-sm font-medium text-gray-900">{school.name}</div>
                          {school.deletedAt ? (
                            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              DELETED
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{school.code}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          aria-pressed={school.status === 'ACTIVE'}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            school.status === 'ACTIVE' ? 'bg-emerald-500 focus:ring-emerald-500' : 'bg-rose-500 focus:ring-rose-500'
                          }`}
                          disabled={Boolean(school.deletedAt)}
                          onClick={() =>
                            actionMutation.mutate({
                              id: school.id,
                              action: school.status === 'ACTIVE' ? 'suspend' : 'activate',
                            })
                          }
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              school.status === 'ACTIVE' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {school.deletedAt ? new Date(school.deletedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={plans?.find((plan) => plan.name === school.subscriptionPlan)?.id ?? ''}
                          onChange={(e) =>
                            planUpdateMutation.mutate({ schoolId: school.id, planId: e.target.value })
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                          disabled={Boolean(school.deletedAt)}
                        >
                          <option value="">Select plan</option>
                          {activePlans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={expiryDates[school.id] ?? ''}
                            onChange={(e) =>
                              setExpiryDates((prev) => ({ ...prev, [school.id]: e.target.value }))
                            }
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            disabled={Boolean(school.deletedAt)}
                          />
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            disabled={!expiryDates[school.id] || Boolean(school.deletedAt)}
                            onClick={() =>
                              testExpiryMutation.mutate({
                                schoolId: school.id,
                                endsAt: expiryDates[school.id],
                              })
                            }
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Set
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/dashboard/schools/${school.id}/admins`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m6-4a4 4 0 11-8 0 4 4 0 018 0Zm6 0a3 3 0 11-6 0 3 3 0 016 0Z" />
                            </svg>
                            Admins
                          </Link>
                          {school.deletedAt ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                              onClick={() =>
                                actionMutation.mutate({
                                  id: school.id,
                                  action: 'restore',
                                })
                              }
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h6V4M4 14a8 8 0 101.9-8.2L3 10" />
                              </svg>
                              Restore
                            </button>
                          ) : (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                              onClick={() => setDeleteTarget(school)}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 11v6M14 11v6M9 7l1-3h4l1 3M8 7h8l-1 13H9L8 7Z" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
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
        {deleteTarget ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-school-title">
            <button
              type="button"
              aria-label="Cancel delete school"
              className="absolute inset-0 cursor-default"
              onClick={() => setDeleteTarget(null)}
              disabled={actionMutation.isPending}
            />
            <div className="relative w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-rose-100 p-3 text-rose-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.3 4.3 2.7 18a2 2 0 001.7 3h15.2a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0Z" />
                  </svg>
                </div>
                <div>
                  <h2 id="delete-school-title" className="text-lg font-bold text-slate-950">
                    Delete school?
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    This will delete <span className="font-semibold text-slate-950">{deleteTarget.name}</span>. You can restore it later from the deleted list.
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-semibold">{deleteTarget.name}</div>
                <div className="text-xs text-slate-500">Code: {deleteTarget.code}</div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" size="sm" type="button" onClick={() => setDeleteTarget(null)} disabled={actionMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="button"
                  loading={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({
                      id: deleteTarget.id,
                      action: 'delete',
                    })
                  }
                  icon={
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M10 11v6M14 11v6M9 7l1-3h4l1 3M8 7h8l-1 13H9L8 7Z" />
                    </svg>
                  }
                  iconPosition="left"
                >
                  Delete School
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {isCreateModalOpen ? (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="add-school-title">
            <button
              type="button"
              aria-label="Close add school"
              className="absolute inset-0 cursor-default"
              onClick={closeCreateModal}
              disabled={createMutation.isPending}
            />
            <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">School setup</p>
                  <h2 id="add-school-title" className="mt-1 text-2xl font-bold text-[var(--shell-text)]">
                    Add School
                  </h2>
                  <p className="text-sm text-[var(--shell-muted)]">
                    Create a new school tenant and initial school admin account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)] disabled:opacity-50"
                  disabled={createMutation.isPending}
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
                      <Button variant="outline" size="sm" type="button" onClick={closeCreateModal}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitCreateSchool();
                    }}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--shell-text)]">School name</span>
                        <input
                          value={form.name}
                          onChange={(e) => {
                            setForm({ ...form, name: e.target.value.toUpperCase() });
                            setFormErrors((prev) => ({ ...prev, name: undefined }));
                            if (!isCodeAuto && !form.code) setIsCodeAuto(true);
                          }}
                          placeholder="ABC PUBLIC SCHOOL"
                          className={`mt-1 w-full rounded-xl border bg-[var(--shell-subtle)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 ${
                            formErrors.name
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                              : 'border-[var(--shell-border)] focus:border-indigo-500 focus:ring-indigo-100'
                          }`}
                        />
                        {formErrors.name ? <p className="mt-1 text-xs font-semibold text-rose-600">{formErrors.name}</p> : null}
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--shell-text)]">School code</span>
                        <input
                          value={form.code}
                          onChange={(e) => {
                            setIsCodeAuto(false);
                            setForm({ ...form, code: e.target.value.toUpperCase() });
                            setFormErrors((prev) => ({ ...prev, code: undefined }));
                          }}
                          placeholder="ABC_00001"
                          className={`mt-1 w-full rounded-xl border bg-[var(--shell-subtle)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 ${
                            formErrors.code
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                              : 'border-[var(--shell-border)] focus:border-indigo-500 focus:ring-indigo-100'
                          }`}
                        />
                        {formErrors.code ? <p className="mt-1 text-xs font-semibold text-rose-600">{formErrors.code}</p> : null}
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--shell-text)]">Subscription plan</span>
                        <select
                          value={form.subscriptionPlan}
                          onChange={(e) => {
                            setForm({ ...form, subscriptionPlan: e.target.value });
                            setFormErrors((prev) => ({ ...prev, subscriptionPlan: undefined }));
                          }}
                          className={`mt-1 w-full rounded-xl border bg-[var(--shell-subtle)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 ${
                            formErrors.subscriptionPlan
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                              : 'border-[var(--shell-border)] focus:border-indigo-500 focus:ring-indigo-100'
                          }`}
                        >
                          {activePlans.length ? (
                            activePlans.map((plan) => (
                              <option key={plan.id} value={plan.name}>
                                {plan.name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="STARTER">Starter</option>
                              <option value="STANDARD">Standard</option>
                              <option value="PREMIUM">Premium</option>
                            </>
                          )}
                        </select>
                        {formErrors.subscriptionPlan ? (
                          <p className="mt-1 text-xs font-semibold text-rose-600">{formErrors.subscriptionPlan}</p>
                        ) : null}
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--shell-text)]">Admin email</span>
                        <input
                          value={form.adminEmail}
                          onChange={(e) => {
                            setForm({ ...form, adminEmail: e.target.value });
                            setFormErrors((prev) => ({ ...prev, adminEmail: undefined }));
                          }}
                          placeholder="admin@school.com"
                          className={`mt-1 w-full rounded-xl border bg-[var(--shell-subtle)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none focus:ring-2 ${
                            formErrors.adminEmail
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100'
                              : 'border-[var(--shell-border)] focus:border-indigo-500 focus:ring-indigo-100'
                          }`}
                        />
                        {formErrors.adminEmail ? (
                          <p className="mt-1 text-xs font-semibold text-rose-600">{formErrors.adminEmail}</p>
                        ) : null}
                      </label>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      The first school admin receives a temporary password. Share it securely and ask them to change it after login.
                    </div>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--shell-border)] pt-5">
                      <Button variant="outline" size="sm" type="button" onClick={closeCreateModal} disabled={createMutation.isPending}>
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        type="submit"
                        loading={createMutation.isPending}
                        icon={
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        }
                        iconPosition="left"
                      >
                        Create School
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
