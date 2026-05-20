'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import { getSession } from '../../../services/auth.service';
import {
  getSystemHealth,
  type HealthStatus,
  type ServiceHealth,
} from '../../../services/system-health.service';

const formatLabel = (value?: string | null) =>
  (value ?? 'unknown')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numeric) ? numeric : 0);
};

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

const formatDuration = (seconds?: number) => {
  const totalSeconds = Math.max(0, Number(seconds ?? 0));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getHealthBadgeClass = (status?: HealthStatus | string | null) => {
  const normalized = (status ?? 'unknown').toLowerCase();
  if (normalized === 'healthy') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (normalized === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200';
  if (normalized === 'down') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (normalized === 'not_implemented') return 'bg-slate-100 text-slate-700 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const overallMessage = (status?: HealthStatus) => {
  if (status === 'healthy') return 'All critical services are responding.';
  if (status === 'warning') return 'One or more non-critical checks need attention.';
  if (status === 'down') return 'A critical service is unavailable.';
  return 'Health status could not be fully determined.';
};

function Badge({ status }: { status?: HealthStatus | string | null }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getHealthBadgeClass(status)}`}>
      {status === 'not_implemented' ? 'Not implemented' : formatLabel(status)}
    </span>
  );
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ServiceCard({
  title,
  service,
  description,
}: {
  title: string;
  service?: ServiceHealth;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{service?.description ?? description}</p>
        </div>
        <Badge status={service?.status ?? 'unknown'} />
      </div>
      <div className="mt-5 grid gap-3 text-sm">
        {service?.latencyMs !== undefined ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Latency</span>
            <span className="font-semibold text-slate-950">{formatNumber(service.latencyMs)} ms</span>
          </div>
        ) : null}
        {service?.uptimeSeconds !== undefined ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Uptime</span>
            <span className="font-semibold text-slate-950">{formatDuration(service.uptimeSeconds)}</span>
          </div>
        ) : null}
        {service?.provider ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Provider</span>
            <span className="font-semibold text-slate-950">{formatLabel(service.provider)}</span>
          </div>
        ) : null}
        {service?.version ? (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Version</span>
            <span className="font-semibold text-slate-950">{service.version}</span>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function SystemHealthPage() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    enabled: session?.role === 'SUPER_ADMIN',
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!isSessionLoading && session?.role && session.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, router, session?.role]);

  useEffect(() => {
    if (data?.generatedAt) {
      setLastUpdated(new Date(data.generatedAt));
    }
  }, [data?.generatedAt]);

  const serviceCards = useMemo(() => {
    const services = data?.services ?? {};
    return [
      { title: 'API', service: services.api, description: 'Backend API process and safe runtime information.' },
      { title: 'Database', service: services.database, description: 'PostgreSQL connectivity through Prisma.' },
      { title: 'Redis', service: services.redis, description: 'Redis connectivity for cache and queues.' },
      { title: 'Queues', service: services.queues, description: 'BullMQ queue count health summary.' },
      { title: 'Storage', service: services.storage, description: 'Configured file storage provider status.' },
      { title: 'Email', service: services.email, description: 'Email provider configuration status.' },
      { title: 'SMS', service: services.sms, description: 'SMS provider configuration status.' },
      {
        title: 'Backups',
        service: data?.backup ? { status: data.backup.status } : undefined,
        description: 'Backup job status from the backup jobs table.',
      },
    ];
  }, [data]);

  if (isSessionLoading) {
    return <FullPageLoader label="Loading system health..." />;
  }

  if (session?.role !== 'SUPER_ADMIN') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-36" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <SkeletonBlock key={index} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">Unable to load system health.</h1>
        <p className="mt-2 text-sm text-slate-500">The endpoint may be temporarily unavailable.</p>
        <div className="mt-5">
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </section>
    );
  }

  const queues = data.services.queues?.queues ?? [];
  const recentErrors = data.recentErrors ?? [];
  const backup = data.backup;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Super Admin</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">System Health</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Monitor platform services, queues, storage, and recent system issues.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" onClick={() => refetch()} loading={isFetching}>
              Refresh
            </Button>
            <span className="text-xs text-slate-500">
              Last updated: {lastUpdated ? formatDateTime(lastUpdated.toISOString()) : 'N/A'}
            </span>
          </div>
        </div>
      </section>

      <section className={`rounded-2xl border p-5 shadow-sm ${
        data.overallStatus === 'down'
          ? 'border-rose-200 bg-rose-50'
          : data.overallStatus === 'warning'
            ? 'border-amber-200 bg-amber-50'
            : 'border-emerald-200 bg-emerald-50'
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-700">Platform status</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{formatLabel(data.overallStatus)}</h2>
            <p className="mt-1 text-sm text-slate-600">{overallMessage(data.overallStatus)}</p>
          </div>
          <Badge status={data.overallStatus} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {serviceCards.map((card) => (
          <ServiceCard key={card.title} {...card} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Queue Status</h2>
              <p className="mt-1 text-sm text-slate-500">BullMQ queue counts without starting workers.</p>
            </div>
            <Badge status={data.services.queues?.status ?? 'unknown'} />
          </div>
          {queues.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="whitespace-nowrap px-3 py-3">Queue</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Waiting</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Active</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Delayed</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Completed</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Failed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queues.map((queue) => (
                    <tr key={queue.name} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-950">{queue.name}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(queue.waiting)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(queue.active)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(queue.delayed)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(queue.completed)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatNumber(queue.failed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No queue data available." />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Backup Status</h2>
            <Badge status={backup?.status ?? 'unknown'} />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Last backup</span>
              <span className="font-semibold text-slate-950">{formatDateTime(backup?.lastBackupAt)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Last status</span>
              <span className="font-semibold text-slate-950">{formatLabel(backup?.lastBackupStatus)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Failed jobs</span>
              <span className="font-semibold text-slate-950">{formatNumber(backup?.failedBackupJobs)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Running jobs</span>
              <span className="font-semibold text-slate-950">{formatNumber(backup?.runningBackupJobs)}</span>
            </div>
          </div>
          <Link
            href="/dashboard/backups"
            prefetch={false}
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Open Backups
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-950">Recent Errors</h2>
            <p className="mt-1 text-sm text-slate-500">Safe audit-derived system/error events only.</p>
          </div>
          {recentErrors.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="whitespace-nowrap px-3 py-3">Type</th>
                    <th className="whitespace-nowrap px-3 py-3">Message</th>
                    <th className="whitespace-nowrap px-3 py-3">Severity</th>
                    <th className="whitespace-nowrap px-3 py-3">School</th>
                    <th className="whitespace-nowrap px-3 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentErrors.map((error) => (
                    <tr key={error.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold text-slate-950">{error.type}</td>
                      <td className="max-w-[360px] truncate px-3 py-3 text-slate-700">{error.message}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {formatLabel(error.severity)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{error.schoolName ?? error.schoolId ?? 'N/A'}</td>
                      <td className="px-3 py-3 text-slate-600">{formatDateTime(error.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No recent system errors found." />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Safe Technical Info</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">API version</span>
              <span className="font-semibold text-slate-950">{data.services.api?.version ?? 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Environment</span>
              <span className="font-semibold text-slate-950">{formatLabel(data.services.api?.environment)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Uptime</span>
              <span className="font-semibold text-slate-950">{formatDuration(data.services.api?.uptimeSeconds)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-slate-500">Generated at</span>
              <span className="font-semibold text-slate-950">{formatDateTime(data.generatedAt)}</span>
            </div>
          </div>
          <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            Secrets, connection strings, bucket names, credentials, JWT settings, cookies, and raw stack traces are not shown.
          </p>
        </div>
      </section>
    </div>
  );
}
