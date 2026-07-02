'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  disableUserMfa,
  forcePasswordReset,
  getAdminUserActivity,
  getAdminUserById,
  getAdminUserSessions,
  getAdminUsers,
  lockAdminUser,
  revokeUserSessions,
  unlockAdminUser,
  updateAdminUserStatus,
  type AdminUser,
} from '../../../services/admin-user.service';

const roleOptions = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF', 'PARENT', 'STUDENT'];
const statusOptions = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
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

const statusBadgeClass = (status?: string | null) => {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'SUSPENDED' || status === 'LOCKED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status === 'INACTIVE') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const roleBadgeClass = (role?: string | null) => {
  if (role === 'SUPER_ADMIN') return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (role === 'SCHOOL_ADMIN') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (role === 'TEACHER') return 'bg-cyan-50 text-cyan-700 ring-cyan-200';
  if (role === 'PARENT') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

type UserAction =
  | 'activate'
  | 'deactivate'
  | 'lock'
  | 'unlock'
  | 'force-password-reset'
  | 'revoke-sessions'
  | 'disable-mfa';

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

export default function GlobalUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    role: '',
    status: '',
    schoolId: '',
    mfaEnabled: '',
    locked: '',
    sortBy: 'createdAt',
    sortOrder: 'desc' as 'asc' | 'desc',
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
    if (urlSearch) {
      setFilters((current) => ({ ...current, search: urlSearch, page: 1 }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isSessionLoading && session?.role && !isSuperAdmin) {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, isSuperAdmin, router, session?.role]);

  const usersQueryParams = useMemo(() => {
    const mfaEnabled = filters.mfaEnabled === '' ? undefined : filters.mfaEnabled === 'true';
    const locked = filters.locked === '' ? undefined : filters.locked === 'true';
    return {
      page: filters.page,
      limit: filters.limit,
      search: filters.search.trim() || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      schoolId: filters.schoolId || undefined,
      mfaEnabled,
      locked,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
  }, [filters]);

  const {
    data: users,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch,
  } = useQuery({
    queryKey: ['admin-users', usersQueryParams],
    queryFn: () => getAdminUsers(usersQueryParams),
    enabled: isSuperAdmin,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: schools } = useQuery({
    queryKey: ['admin-user-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: selectedUser, isLoading: isSelectedUserLoading } = useQuery({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: () => getAdminUserById(selectedUserId as string),
    enabled: Boolean(selectedUserId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const { data: selectedActivity } = useQuery({
    queryKey: ['admin-user-activity', selectedUserId],
    queryFn: () => getAdminUserActivity(selectedUserId as string),
    enabled: Boolean(selectedUserId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const { data: selectedSessions } = useQuery({
    queryKey: ['admin-user-sessions', selectedUserId],
    queryFn: () => getAdminUserSessions(selectedUserId as string),
    enabled: Boolean(selectedUserId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { user: AdminUser; action: UserAction; reason?: string | null }) => {
      if (payload.action === 'activate') {
        return updateAdminUserStatus(payload.user.id, { status: 'ACTIVE', reason: payload.reason ?? null });
      }
      if (payload.action === 'deactivate') {
        return updateAdminUserStatus(payload.user.id, { status: 'INACTIVE', reason: payload.reason ?? null });
      }
      if (payload.action === 'lock') {
        return lockAdminUser(payload.user.id, { reason: payload.reason ?? null });
      }
      if (payload.action === 'unlock') {
        return unlockAdminUser(payload.user.id, { reason: payload.reason ?? null });
      }
      if (payload.action === 'force-password-reset') {
        return forcePasswordReset(payload.user.id, { reason: payload.reason ?? null });
      }
      if (payload.action === 'revoke-sessions') {
        return revokeUserSessions(payload.user.id, { reason: payload.reason ?? null });
      }
      return disableUserMfa(payload.user.id, { reason: payload.reason ?? null });
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', variables.user.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-activity', variables.user.id] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-sessions', variables.user.id] });
      notify.success('User updated', 'The security action was applied successfully.');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Unable to update user.';
      notify.error('Action failed', message);
    },
  });

  const setFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'page' ? {} : { page: 1 }),
    }));
  };

  const requestReason = (message: string, required = true) => {
    const reason = window.prompt(message);
    if (reason === null) return null;
    const trimmed = reason.trim();
    if (required && !trimmed) {
      notify.error('Reason required', 'Please enter a reason for this security action.');
      return null;
    }
    return trimmed || null;
  };

  const requestOptionalReason = (message: string) => {
    const reason = window.prompt(message);
    if (reason === null) return undefined;
    return reason.trim() || null;
  };

  const runAction = (user: AdminUser, action: UserAction) => {
    const name = user.name || user.email;

    if (action === 'activate') {
      const reason = requestOptionalReason(`Reactivate ${name}? Enter an optional reason:`);
      if (reason === undefined) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (action === 'deactivate') {
      if (!window.confirm(`Deactivate ${name}? They will no longer be able to log in.`)) return;
      const reason = requestReason('Reason for deactivation:');
      if (!reason) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (action === 'lock') {
      if (!window.confirm(`Lock ${name}? Active sessions will be revoked.`)) return;
      const reason = requestReason('Reason for account lock:');
      if (!reason) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (action === 'unlock') {
      const reason = requestOptionalReason(`Unlock ${name}? Enter an optional reason:`);
      if (reason === undefined) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (action === 'force-password-reset') {
      if (!window.confirm(`Force password reset for ${name}? Active sessions will be revoked.`)) return;
      const reason = requestReason('Reason for password reset:');
      if (!reason) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (action === 'revoke-sessions') {
      if (!window.confirm(`Log ${name} out from all devices?`)) return;
      const reason = requestReason('Reason for session revocation:');
      if (!reason) return;
      actionMutation.mutate({ user, action, reason });
      return;
    }

    if (!window.confirm(`Disable MFA for ${name}? Use this only after identity verification.`)) return;
    const reason = requestReason('Reason for disabling MFA:');
    if (!reason) return;
    actionMutation.mutate({ user, action, reason });
  };

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  const rows = users?.items ?? [];
  const pagination = users?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const busy = actionMutation.isPending;
  const totalItems = pagination?.total ?? 0;
  const firstItem = totalItems === 0 ? 0 : (filters.page - 1) * filters.limit + 1;
  const lastItem = Math.min(filters.page * filters.limit, totalItems);
  const pageItems = getPageItems(filters.page, totalPages);

  const userTableRows = rows.map((user) => ({
    name: user.name || user.email,
    email: user.email,
    role: formatLabel(user.role),
    school: user.schoolName ?? 'Platform',
    status: `${formatLabel(user.status)}${user.isLocked ? ' (Locked)' : ''}`,
    mfa: user.mfaEnabled ? formatLabel(user.mfaMethod ?? 'Enabled') : 'Disabled',
    created: formatDateTime(user.createdAt),
  }));

  const toCsv = (items: typeof userTableRows) => {
    const headers = ['Name', 'Email', 'Role', 'School', 'Status', 'MFA', 'Created'];
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    return [headers, ...items.map((item) => [item.name, item.email, item.role, item.school, item.status, item.mfa, item.created])]
      .map((line) => line.map(escapeCell).join(','))
      .join('\n');
  };

  const copyVisibleUsers = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(userTableRows));
      notify.success('Copied', 'Visible users copied to clipboard.');
    } catch {
      notify.error('Copy failed', 'Unable to copy visible users.');
    }
  };

  const exportVisibleUsers = () => {
    const blob = new Blob([toCsv(userTableRows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global-users-page-${filters.page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printVisibleUsers = () => {
    const printWindow = window.open('', '_blank', 'width=1100,height=720');
    if (!printWindow) {
      notify.error('Print blocked', 'Allow popups to print the users table.');
      return;
    }
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const rowsHtml = userTableRows
      .map(
        (user) => `
          <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.role)}</td>
            <td>${escapeHtml(user.school)}</td>
            <td>${escapeHtml(user.status)}</td>
            <td>${escapeHtml(user.mfa)}</td>
            <td>${escapeHtml(user.created)}</td>
          </tr>
        `,
      )
      .join('');
    printWindow.document.write(`
      <html>
        <head>
          <title>Global Users</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { font-size: 20px; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Global Users</h1>
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>School</th><th>Status</th><th>MFA</th><th>Created</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-4 pb-8">
      {busy ? <FullPageLoader label="Loading users..." /> : null}

      <header className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--shell-text)]">Users</h1>
            <p className="mt-0.5 text-sm text-[var(--shell-muted)]">Manage global users and account access from one list.</p>
          </div>
          <div className="text-sm font-semibold text-[var(--shell-muted)]">
            Dashboard <span className="px-1 text-[var(--shell-muted)]">/</span> <span className="text-[var(--shell-text)]">Users</span>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="shrink-0 xl:w-40">
            <h2 className="text-lg font-semibold text-[var(--shell-text)]">Select Criteria</h2>
          </div>
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="text-xs font-semibold text-[var(--shell-text)]">Role</span>
              <select
                value={filters.role}
                onChange={(event) => setFilter('role', event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--shell-text)]">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilter('status', event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--shell-text)]">School</span>
              <select
                value={filters.schoolId}
                onChange={(event) => setFilter('schoolId', event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All schools</option>
                {(schools?.items ?? []).map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--shell-text)]">Locked</span>
              <select
                value={filters.locked}
                onChange={(event) => setFilter('locked', event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Any</option>
                <option value="true">Locked</option>
                <option value="false">Not locked</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <TableIcon name="search" />
            Search
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="border-b border-[var(--shell-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--shell-text)]">Global Users</h2>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Search"
            className="h-10 w-full rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm text-[var(--shell-text)] outline-none placeholder:text-[var(--shell-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <label className="relative">
              <select
                value={filters.limit}
                onChange={(event) => setFilter('limit', Number(event.target.value))}
                className="h-10 appearance-none rounded-md border border-[var(--shell-border)] bg-[var(--shell-card)] pl-3 pr-8 text-sm font-medium text-[var(--shell-text)] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                aria-label="Rows per page"
              >
                {pageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <TableIcon name="chevron" className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-[var(--shell-muted)]" />
            </label>
            <button type="button" onClick={copyVisibleUsers} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]" title="Copy visible users">
              <TableIcon name="copy" />
            </button>
            <button type="button" onClick={exportVisibleUsers} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]" title="Export CSV">
              <TableIcon name="file" />
            </button>
            <button type="button" onClick={printVisibleUsers} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]" title="Print">
              <TableIcon name="print" />
            </button>
            <button type="button" onClick={() => refetch()} className="grid h-10 w-10 place-items-center rounded-md border border-[var(--shell-border)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]" title="Refresh">
              <TableIcon name="refresh" />
            </button>
          </div>
        </div>

        {isUsersLoading ? (
          <SkeletonRows />
        ) : isUsersError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load users.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--shell-muted)]">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-y border-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-sm font-semibold text-[var(--shell-text)]">
                <tr>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">User Name</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">Email</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">Role</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">School</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">Status</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">MFA</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3">Created</th>
                  <th className="whitespace-nowrap border-b border-[var(--shell-border)] px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--shell-border)] hover:bg-[var(--shell-hover)]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="font-medium text-[var(--shell-text)]">{user.name || user.email}</div>
                      {user.phone ? <div className="text-xs text-[var(--shell-muted)]">{user.phone}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{user.email}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={roleBadgeClass(user.role)}>{formatLabel(user.role)}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{user.schoolName ?? 'Platform'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={statusBadgeClass(user.status)}>{formatLabel(user.status)}</Badge>
                        {user.isLocked ? <span className="text-xs font-semibold text-rose-600">Locked</span> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge className={user.mfaEnabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                        {user.mfaEnabled ? formatLabel(user.mfaMethod ?? 'Enabled') : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--shell-muted)]">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-nowrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          View
                        </button>
                        {user.status === 'ACTIVE' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => runAction(user, 'deactivate')}
                              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => runAction(user, 'lock')}
                              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                            >
                              Lock
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => runAction(user, user.status === 'SUSPENDED' ? 'unlock' : 'activate')}
                            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                          >
                            {user.status === 'SUSPENDED' ? 'Unlock' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 px-5 py-4 text-sm text-[var(--shell-muted)] lg:flex-row lg:items-center lg:justify-between">
          <span>
            Showing {firstItem} to {lastItem} of {totalItems} entries
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', Math.max(1, filters.page - 1))}
              className="rounded-md border border-[var(--shell-border)] px-3 py-1.5 font-semibold text-[var(--shell-text)] disabled:opacity-40"
            >
              Previous
            </button>
            {pageItems.map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter('page', item)}
                  className={`min-w-9 rounded-md border px-3 py-1.5 font-semibold ${
                    item === filters.page
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-[var(--shell-border)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="px-2">
                  ...
                </span>
              ),
            )}
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
              className="rounded-md border border-[var(--shell-border)] px-3 py-1.5 font-semibold text-[var(--shell-text)] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedUserId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            aria-label="Close user detail"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedUserId(null)}
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">User detail</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">
                  {selectedUser?.name ?? 'Loading user...'}
                </h2>
                <p className="text-sm text-[var(--shell-muted)]">{selectedUser?.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]"
              >
                Close
              </button>
            </div>

            {isSelectedUserLoading || !selectedUser ? (
              <SkeletonRows />
            ) : (
              <div className="space-y-5 py-5">
                <section className="grid gap-3 sm:grid-cols-2">
                  <InfoItem label="Role" value={formatLabel(selectedUser.role)} />
                  <InfoItem label="Status" value={formatLabel(selectedUser.status)} />
                  <InfoItem label="School" value={selectedUser.schoolName ?? 'Platform'} />
                  <InfoItem label="MFA" value={selectedUser.mfaEnabled ? formatLabel(selectedUser.mfaMethod ?? 'Enabled') : 'Disabled'} />
                  <InfoItem label="Must Change Password" value={selectedUser.mustChangePassword ? 'Yes' : 'No'} />
                  <InfoItem label="Created" value={formatDateTime(selectedUser.createdAt)} />
                </section>

                <section className="rounded-2xl border border-[var(--shell-border)] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Security actions</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedUser.status === 'ACTIVE' ? (
                      <>
                        <ActionButton onClick={() => runAction(selectedUser, 'deactivate')}>Deactivate</ActionButton>
                        <ActionButton danger onClick={() => runAction(selectedUser, 'lock')}>Lock</ActionButton>
                      </>
                    ) : (
                      <ActionButton onClick={() => runAction(selectedUser, selectedUser.status === 'SUSPENDED' ? 'unlock' : 'activate')}>
                        {selectedUser.status === 'SUSPENDED' ? 'Unlock' : 'Activate'}
                      </ActionButton>
                    )}
                    <ActionButton onClick={() => runAction(selectedUser, 'force-password-reset')}>Force password reset</ActionButton>
                    <ActionButton onClick={() => runAction(selectedUser, 'revoke-sessions')}>Revoke sessions</ActionButton>
                    {selectedUser.mfaEnabled ? (
                      <ActionButton danger onClick={() => runAction(selectedUser, 'disable-mfa')}>Disable MFA</ActionButton>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--shell-border)] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Active sessions</h3>
                  <div className="mt-3 space-y-2">
                    {(selectedSessions?.items ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--shell-muted)]">No active sessions found.</p>
                    ) : (
                      selectedSessions?.items.map((sessionItem) => (
                        <div key={sessionItem.id} className="rounded-xl bg-[var(--shell-subtle)] p-3">
                          <p className="text-sm font-semibold text-[var(--shell-text)]">{sessionItem.deviceName ?? 'Unknown device'}</p>
                          <p className="text-xs text-[var(--shell-muted)]">{sessionItem.ipAddress ?? 'IP masked'} - {sessionItem.userAgent ?? 'Unknown browser'}</p>
                          <p className="mt-1 text-xs text-[var(--shell-muted)]">Last used: {formatDateTime(sessionItem.lastUsedAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-[var(--shell-border)] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Recent activity</h3>
                  <div className="mt-3 space-y-2">
                    {(selectedActivity?.items ?? []).length === 0 ? (
                      <p className="text-sm text-[var(--shell-muted)]">No recent activity found.</p>
                    ) : (
                      selectedActivity?.items.map((activity) => (
                        <div key={activity.id} className="rounded-xl bg-[var(--shell-subtle)] p-3">
                          <p className="text-sm font-semibold text-[var(--shell-text)]">{formatLabel(activity.event)}</p>
                          <p className="text-xs text-[var(--shell-muted)]">{formatDateTime(activity.createdAt)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--shell-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--shell-text)]">{value}</p>
    </div>
  );
}

function ActionButton({ children, onClick, danger = false }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-[var(--shell-border)] bg-[var(--shell-subtle)] text-[var(--shell-text)] hover:bg-[var(--shell-hover)]'
      }`}
    >
      {children}
    </button>
  );
}
