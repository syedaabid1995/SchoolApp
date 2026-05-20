'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
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
  getAdminUsersSummary,
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

function StatCard({ label, value, helper }: { label: string; value: number | string; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[var(--shell-text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--shell-muted)]">{helper}</p>
    </div>
  );
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

export default function GlobalUsersPage() {
  const router = useRouter();
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

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['admin-users-summary'],
    queryFn: getAdminUsersSummary,
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
      queryClient.invalidateQueries({ queryKey: ['admin-users-summary'] });
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
  const busy = isUsersLoading || isSummaryLoading || actionMutation.isPending;

  return (
    <div className="space-y-6 pb-12">
      {busy ? <FullPageLoader label="Loading users..." /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Users"
          subtitle="Manage platform users, school admins, staff, parents, and account security status."
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)] shadow-sm hover:bg-[var(--shell-hover)]"
          >
            Refresh
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Users" value={summary?.total ?? 0} helper="All platform accounts" />
        <StatCard label="School Admins" value={summary?.schoolAdmins ?? 0} helper="Tenant admin users" />
        <StatCard label="Teachers" value={summary?.teachers ?? 0} helper="Employee accounts" />
        <StatCard label="Locked Users" value={summary?.lockedUsers ?? 0} helper="Mapped to suspended status" />
        <StatCard label="Super Admins" value={summary?.superAdmins ?? 0} helper="Platform administrators" />
        <StatCard label="Parents" value={summary?.parents ?? 0} helper="Parent portal accounts" />
        <StatCard label="Students" value={summary?.students ?? 0} helper="No student role in current schema" />
        <StatCard label="MFA Admins" value={summary?.mfaEnabledAdmins ?? 0} helper="Admin accounts with MFA enabled" />
      </section>

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Name, email, phone, school"
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Role</span>
            <select
              value={filters.role}
              onChange={(event) => setFilter('role', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
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
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setFilter('status', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
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
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">MFA</span>
            <select
              value={filters.mfaEnabled}
              onChange={(event) => setFilter('mfaEnabled', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Locked</span>
            <select
              value={filters.locked}
              onChange={(event) => setFilter('locked', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Any</option>
              <option value="true">Locked</option>
              <option value="false">Not locked</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">School</span>
            <select
              value={filters.schoolId}
              onChange={(event) => setFilter('schoolId', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
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
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Sort</span>
            <select
              value={filters.sortBy}
              onChange={(event) => setFilter('sortBy', event.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt">Created date</option>
              <option value="email">Email</option>
              <option value="status">Status</option>
              <option value="name">Name</option>
              <option value="role">Role</option>
              <option value="schoolName">School</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Order</span>
            <select
              value={filters.sortOrder}
              onChange={(event) => setFilter('sortOrder', event.target.value as 'asc' | 'desc')}
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--shell-text)]">Global Users</h2>
            <p className="text-sm text-[var(--shell-muted)]">
              {pagination ? `${pagination.total} users found` : 'Search and manage platform accounts'}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--shell-muted)]">
            Rows
            <select
              value={filters.limit}
              onChange={(event) => setFilter('limit', Number(event.target.value))}
              className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-2 py-1 text-sm text-[var(--shell-text)]"
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
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
            <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">MFA</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {rows.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--shell-hover)]">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-[var(--shell-text)]">{user.name || user.email}</div>
                      <div className="text-xs text-[var(--shell-muted)]">{user.email}</div>
                      {user.phone ? <div className="text-xs text-[var(--shell-muted)]">{user.phone}</div> : null}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={roleBadgeClass(user.role)}>{formatLabel(user.role)}</Badge>
                    </td>
                    <td className="px-5 py-4 text-[var(--shell-muted)]">{user.schoolName ?? 'Platform'}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <Badge className={statusBadgeClass(user.status)}>{formatLabel(user.status)}</Badge>
                        {user.isLocked ? <span className="text-xs font-semibold text-rose-600">Locked</span> : null}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={user.mfaEnabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}>
                        {user.mfaEnabled ? formatLabel(user.mfaMethod ?? 'Enabled') : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-[var(--shell-muted)]">{formatDateTime(user.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                        >
                          View
                        </button>
                        {user.status === 'ACTIVE' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => runAction(user, 'deactivate')}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              onClick={() => runAction(user, 'lock')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                            >
                              Lock
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => runAction(user, user.status === 'SUSPENDED' ? 'unlock' : 'activate')}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
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

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-5 py-4 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Page {filters.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => setFilter('page', Math.max(1, filters.page - 1))}
              className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => setFilter('page', filters.page + 1)}
              className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40"
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
