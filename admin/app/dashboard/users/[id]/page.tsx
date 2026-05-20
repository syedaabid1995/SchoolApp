'use client';

import Link from 'next/link';
import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { getSession } from '../../../../services/auth.service';
import {
  getAdminUserActivity,
  getAdminUserById,
  getAdminUserSessions,
} from '../../../../services/admin-user.service';

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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--shell-text)]">{value}</p>
    </div>
  );
}

export default function AdminUserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = use(params).id;
  const router = useRouter();

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

  const { data: user, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => getAdminUserById(userId),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  const { data: sessions } = useQuery({
    queryKey: ['admin-user-sessions', userId],
    queryFn: () => getAdminUserSessions(userId),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  const { data: activity } = useQuery({
    queryKey: ['admin-user-activity', userId],
    queryFn: () => getAdminUserActivity(userId),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  if (isLoading) {
    return <FullPageLoader label="Loading user..." />;
  }

  if (isError || !user) {
    return (
      <div className="space-y-4">
        <PageHeader title="User Details" subtitle="Unable to load this user." />
        <button
          type="button"
          onClick={() => refetch()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title={user.name ?? user.email} subtitle="Safe Super Admin view of user profile, sessions, and activity." />
        <Link
          href="/dashboard/users"
          className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)] shadow-sm hover:bg-[var(--shell-hover)]"
        >
          Back to Users
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Email" value={user.email} />
        <InfoCard label="Role" value={formatLabel(user.role)} />
        <InfoCard label="Status" value={formatLabel(user.status)} />
        <InfoCard label="School" value={user.schoolName ?? 'Platform'} />
        <InfoCard label="MFA" value={user.mfaEnabled ? formatLabel(user.mfaMethod ?? 'Enabled') : 'Disabled'} />
        <InfoCard label="Locked" value={user.isLocked ? 'Yes' : 'No'} />
        <InfoCard label="Must Change Password" value={user.mustChangePassword ? 'Yes' : 'No'} />
        <InfoCard label="Created" value={formatDateTime(user.createdAt)} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--shell-text)]">Active Sessions</h2>
          <div className="mt-4 space-y-3">
            {(sessions?.items ?? []).length === 0 ? (
              <p className="text-sm text-[var(--shell-muted)]">No active sessions found.</p>
            ) : (
              sessions?.items.map((sessionItem) => (
                <div key={sessionItem.id} className="rounded-xl bg-[var(--shell-subtle)] p-4">
                  <p className="font-semibold text-[var(--shell-text)]">{sessionItem.deviceName ?? 'Unknown device'}</p>
                  <p className="text-xs text-[var(--shell-muted)]">{sessionItem.ipAddress ?? 'IP masked'} - {sessionItem.userAgent ?? 'Unknown browser'}</p>
                  <p className="mt-1 text-xs text-[var(--shell-muted)]">Expires: {formatDateTime(sessionItem.expiresAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--shell-text)]">Recent Activity</h2>
          <div className="mt-4 space-y-3">
            {(activity?.items ?? []).length === 0 ? (
              <p className="text-sm text-[var(--shell-muted)]">No recent activity found.</p>
            ) : (
              activity?.items.map((item) => (
                <div key={item.id} className="rounded-xl bg-[var(--shell-subtle)] p-4">
                  <p className="font-semibold text-[var(--shell-text)]">{formatLabel(item.event)}</p>
                  <p className="text-xs text-[var(--shell-muted)]">{formatDateTime(item.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
