'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import { getSession } from '../../../services/auth.service';
import {
  createBackup,
  getBackupJobs,
  getRestoreJobs,
  requestRestore,
  approveRestore,
  rejectRestore,
  type BackupJob,
  type BackupServiceStatus,
  type RestoreJob,
} from '../../../services/backup.service';
import { listSchools } from '../../../services/school.service';

const backupStatuses = ['REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED'] as const;
const backupTypes = ['SCHOOL_DATA', 'FULL_DATABASE', 'DATABASE_ONLY', 'FILES_ONLY'] as const;

const defaultServiceStatus: BackupServiceStatus = {
  backupExecutionImplemented: false,
  restoreExecutionImplemented: false,
  downloadImplemented: false,
  deleteImplemented: false,
  rejectRestoreImplemented: false,
};

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

const formatFileSize = (value?: number | null) => {
  if (!value) return 'N/A';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const statusBadgeClass = (status?: string | null) => {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (normalized === 'RUNNING' || normalized === 'REQUESTED') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (normalized === 'FAILED' || normalized === 'REJECTED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (normalized === 'CANCELLED' || normalized === 'NOT_IMPLEMENTED') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const formatNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numeric) ? numeric : 0);
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function SummaryCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'N/A'}</div>
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

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function BackupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', status: '', schoolId: '' });
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [restoreBackupJob, setRestoreBackupJob] = useState<BackupJob | null>(null);
  const [selectedBackupJob, setSelectedBackupJob] = useState<BackupJob | null>(null);
  const [selectedRestoreJob, setSelectedRestoreJob] = useState<RestoreJob | null>(null);
  const [backupForm, setBackupForm] = useState({
    type: 'SCHOOL_DATA',
    scope: 'SCHOOL',
    schoolId: '',
    reason: '',
  });
  const [restoreForm, setRestoreForm] = useState({
    reason: '',
    confirmed: false,
  });
  const [formError, setFormError] = useState('');

  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const isSuperAdmin = session?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!isSessionLoading && session?.role && session.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
    }
  }, [isSessionLoading, router, session?.role]);

  const { data: schools } = useQuery({
    queryKey: ['backup-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const {
    data: backups,
    isLoading: isBackupsLoading,
    isError: isBackupsError,
    refetch: refetchBackups,
  } = useQuery({
    queryKey: ['backup-jobs', filters.status, filters.schoolId],
    queryFn: () =>
      getBackupJobs({
        status: filters.status,
        schoolId: filters.schoolId,
      }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const {
    data: restores,
    isLoading: isRestoresLoading,
    isError: isRestoresError,
    refetch: refetchRestores,
  } = useQuery({
    queryKey: ['restore-jobs', filters.schoolId],
    queryFn: () => getRestoreJobs({ schoolId: filters.schoolId }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const serviceStatus = backups?.serviceStatus ?? restores?.serviceStatus ?? defaultServiceStatus;
  const backupItems = backups?.items ?? [];
  const restoreItems = restores?.items ?? [];

  const visibleBackups = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return backupItems;
    return backupItems.filter((backup) => {
      return (
        backup.id.toLowerCase().includes(search) ||
        String(backup.status).toLowerCase().includes(search) ||
        (backup.schoolName ?? '').toLowerCase().includes(search) ||
        (backup.schoolCode ?? '').toLowerCase().includes(search)
      );
    });
  }, [backupItems, filters.search]);

  const visibleRestores = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    if (!search) return restoreItems;
    return restoreItems.filter((restore) => {
      return (
        restore.id.toLowerCase().includes(search) ||
        restore.backupId.toLowerCase().includes(search) ||
        String(restore.status).toLowerCase().includes(search) ||
        (restore.schoolName ?? '').toLowerCase().includes(search) ||
        (restore.schoolCode ?? '').toLowerCase().includes(search)
      );
    });
  }, [filters.search, restoreItems]);

  const summary = useMemo(() => {
    const completed = backupItems.filter((backup) => backup.status === 'COMPLETED');
    const running = backupItems.filter((backup) => backup.status === 'RUNNING');
    const failed = backupItems.filter((backup) => backup.status === 'FAILED');
    const lastSuccessful = completed
      .slice()
      .sort((a, b) => new Date(b.completedAt ?? b.createdAt ?? 0).getTime() - new Date(a.completedAt ?? a.createdAt ?? 0).getTime())[0];

    return {
      total: backupItems.length,
      completed: completed.length,
      running: running.length,
      failed: failed.length,
      lastSuccessful: lastSuccessful?.completedAt ?? lastSuccessful?.createdAt ?? null,
    };
  }, [backupItems]);

  const createBackupMutation = useMutation({
    mutationFn: createBackup,
    onSuccess: () => {
      setIsBackupModalOpen(false);
      setBackupForm({ type: 'SCHOOL_DATA', scope: 'SCHOOL', schoolId: '', reason: '' });
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['backup-jobs'] });
    },
    onError: () => setFormError('Backup service is not implemented yet.'),
  });

  const requestRestoreMutation = useMutation({
    mutationFn: requestRestore,
    onSuccess: () => {
      setRestoreBackupJob(null);
      setRestoreForm({ reason: '', confirmed: false });
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['restore-jobs'] });
    },
    onError: () => setFormError('Restore service is not implemented yet.'),
  });

  const approveRestoreMutation = useMutation({
    mutationFn: approveRestore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restore-jobs'] }),
  });

  const rejectRestoreMutation = useMutation({
    mutationFn: rejectRestore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restore-jobs'] }),
  });

  const refreshAll = () => {
    refetchBackups();
    refetchRestores();
  };

  const submitBackup = () => {
    if (!serviceStatus.backupExecutionImplemented) {
      setFormError('Backup execution is not implemented yet on the backend.');
      return;
    }
    if (!backupForm.schoolId) {
      setFormError('School is required for the current backup model.');
      return;
    }
    createBackupMutation.mutate({
      type: backupForm.type,
      scope: backupForm.scope,
      schoolId: backupForm.schoolId,
      reason: backupForm.reason.trim() || undefined,
    });
  };

  const submitRestore = () => {
    if (!restoreBackupJob) return;
    if (!serviceStatus.restoreExecutionImplemented) {
      setFormError('Restore execution is not implemented yet.');
      return;
    }
    if (!restoreForm.confirmed) {
      setFormError('Restore confirmation is required.');
      return;
    }
    requestRestoreMutation.mutate({
      backupId: restoreBackupJob.id,
      schoolId: restoreBackupJob.schoolId ?? undefined,
      reason: restoreForm.reason.trim() || undefined,
      confirmed: restoreForm.confirmed,
    });
  };

  if (isSessionLoading) {
    return <FullPageLoader label="Loading backups..." />;
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Super Admin</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">Backups & Restore</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage platform and school backup jobs, restore requests, and backup history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setFormError('');
                setIsBackupModalOpen(true);
              }}
            >
              Create Backup
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
        <p className="font-semibold">Backup and restore operations are sensitive. Only Super Admins can perform these actions.</p>
        {!serviceStatus.backupExecutionImplemented || !serviceStatus.restoreExecutionImplemented ? (
          <p className="mt-1">
            Backup and restore execution is currently not implemented. This page displays records and readiness status only.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Total backups" value={formatNumber(summary.total)} helper="All backup request records." />
        <SummaryCard label="Completed" value={formatNumber(summary.completed)} helper="Backups marked completed." />
        <SummaryCard label="Running" value={formatNumber(summary.running)} helper="Backups currently running." />
        <SummaryCard label="Failed" value={formatNumber(summary.failed)} helper="Backups marked failed." />
        <SummaryCard label="Last success" value={formatDateTime(summary.lastSuccessful)} helper="Latest successful backup." />
        <SummaryCard label="Restore requests" value={formatNumber(restoreItems.length)} helper="All restore request records." />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_180px_220px_auto] lg:items-end">
          <div>
            <label htmlFor="backup-search" className="mb-2 block text-sm font-medium text-slate-700">
              Search
            </label>
            <input
              id="backup-search"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search by ID, school, status"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div>
            <label htmlFor="backup-status" className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </label>
            <select
              id="backup-status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">All</option>
              {backupStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="backup-school" className="mb-2 block text-sm font-medium text-slate-700">
              School
            </label>
            <select
              id="backup-school"
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ search: '', status: '', schoolId: '' })}
          >
            Clear
          </Button>
        </div>
      </section>

      {isBackupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Create Backup</h2>
                <p className="mt-1 text-sm text-slate-500">Current backend model supports school-scoped backup records.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsBackupModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Backup execution is not implemented yet on the backend. The submit action is disabled to avoid fake success.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Backup type</label>
                <select
                  value={backupForm.type}
                  onChange={(event) => setBackupForm((prev) => ({ ...prev, type: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                >
                  {backupTypes.map((type) => (
                    <option key={type} value={type} disabled={type !== 'SCHOOL_DATA'}>
                      {formatLabel(type)}{type !== 'SCHOOL_DATA' ? ' (not supported yet)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">School</label>
                <select
                  value={backupForm.schoolId}
                  onChange={(event) => setBackupForm((prev) => ({ ...prev, schoolId: event.target.value }))}
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
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
                <textarea
                  value={backupForm.reason}
                  onChange={(event) => setBackupForm((prev) => ({ ...prev, reason: event.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Manual backup before deployment"
                />
              </div>
            </div>
            {formError ? <p className="mt-4 text-sm font-medium text-rose-600">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsBackupModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitBackup} loading={createBackupMutation.isPending} disabled={!serviceStatus.backupExecutionImplemented}>
                Request Backup
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {restoreBackupJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Request Restore</h2>
                <p className="mt-1 text-sm text-slate-500">Restore is destructive and must be confirmed.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setRestoreBackupJob(null)}>
                Close
              </Button>
            </div>
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              Restore execution is not implemented yet. The submit action is disabled to avoid fake success.
            </div>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-950">{restoreBackupJob.id}</p>
                <p className="text-slate-500">{restoreBackupJob.schoolName ?? 'Unknown school'}</p>
              </div>
              <textarea
                value={restoreForm.reason}
                onChange={(event) => setRestoreForm((prev) => ({ ...prev, reason: event.target.value }))}
                rows={4}
                placeholder="Reason for restore request"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <label className="flex items-start gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={restoreForm.confirmed}
                  onChange={(event) => setRestoreForm((prev) => ({ ...prev, confirmed: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                I understand restore can overwrite existing data.
              </label>
            </div>
            {formError ? <p className="mt-4 text-sm font-medium text-rose-600">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRestoreBackupJob(null)}>
                Cancel
              </Button>
              <Button onClick={submitRestore} loading={requestRestoreMutation.isPending} disabled={!serviceStatus.restoreExecutionImplemented}>
                Request Restore
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {selectedBackupJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Backup Details</h2>
                <p className="mt-1 max-w-xl truncate text-sm text-slate-500">{selectedBackupJob.id}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedBackupJob(null)}>
                Close
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Status" value={<Badge className={statusBadgeClass(selectedBackupJob.status)}>{formatLabel(selectedBackupJob.status)}</Badge>} />
              <DetailRow label="Type" value={formatLabel(selectedBackupJob.type)} />
              <DetailRow label="Scope" value={formatLabel(selectedBackupJob.scope)} />
              <DetailRow label="School" value={`${selectedBackupJob.schoolName ?? 'N/A'} ${selectedBackupJob.schoolCode ? `(${selectedBackupJob.schoolCode})` : ''}`} />
              <DetailRow label="Created by" value={selectedBackupJob.createdBy?.name ?? 'N/A'} />
              <DetailRow label="File size" value={formatFileSize(selectedBackupJob.fileSize)} />
              <DetailRow label="Started" value={formatDateTime(selectedBackupJob.startedAt)} />
              <DetailRow label="Completed" value={formatDateTime(selectedBackupJob.completedAt)} />
              <div className="md:col-span-2">
                <DetailRow label="Reason / Error" value={selectedBackupJob.errorMessage ?? selectedBackupJob.reason ?? 'No details available'} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Storage paths and provider secrets are intentionally hidden.</p>
          </section>
        </div>
      ) : null}

      {selectedRestoreJob ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Restore Details</h2>
                <p className="mt-1 max-w-xl truncate text-sm text-slate-500">{selectedRestoreJob.id}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedRestoreJob(null)}>
                Close
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <DetailRow label="Status" value={<Badge className={statusBadgeClass(selectedRestoreJob.status)}>{formatLabel(selectedRestoreJob.status)}</Badge>} />
              <DetailRow label="Backup ID" value={selectedRestoreJob.backupId} />
              <DetailRow label="Scope" value={formatLabel(selectedRestoreJob.scope)} />
              <DetailRow label="School" value={`${selectedRestoreJob.schoolName ?? 'N/A'} ${selectedRestoreJob.schoolCode ? `(${selectedRestoreJob.schoolCode})` : ''}`} />
              <DetailRow label="Requested by" value={selectedRestoreJob.requestedBy?.name ?? 'N/A'} />
              <DetailRow label="Approved by" value={selectedRestoreJob.approvedBy?.name ?? 'N/A'} />
              <DetailRow label="Requested" value={formatDateTime(selectedRestoreJob.requestedAt)} />
              <DetailRow label="Completed" value={formatDateTime(selectedRestoreJob.completedAt)} />
              <div className="md:col-span-2">
                <DetailRow label="Reason / Error" value={selectedRestoreJob.errorMessage ?? selectedRestoreJob.reason ?? 'No details available'} />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Backup Jobs</h2>
            <p className="mt-1 text-sm text-slate-500">Safe backup records only. Storage paths are not exposed.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {visibleBackups.length} shown
          </span>
        </div>
        {isBackupsLoading ? (
          <SkeletonRows />
        ) : isBackupsError ? (
          <EmptyState message="Unable to load backup jobs." />
        ) : visibleBackups.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="whitespace-nowrap px-3 py-3">ID</th>
                  <th className="whitespace-nowrap px-3 py-3">Type</th>
                  <th className="whitespace-nowrap px-3 py-3">Scope</th>
                  <th className="whitespace-nowrap px-3 py-3">School</th>
                  <th className="whitespace-nowrap px-3 py-3">Status</th>
                  <th className="whitespace-nowrap px-3 py-3">Size</th>
                  <th className="whitespace-nowrap px-3 py-3">Created by</th>
                  <th className="whitespace-nowrap px-3 py-3">Started</th>
                  <th className="whitespace-nowrap px-3 py-3">Completed</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleBackups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-slate-50">
                    <td className="max-w-[180px] truncate px-3 py-3 font-semibold text-slate-950">{backup.id}</td>
                    <td className="px-3 py-3 text-slate-700">{formatLabel(backup.type)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatLabel(backup.scope)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{backup.schoolName ?? 'N/A'}</p>
                      <p className="text-xs text-slate-500">{backup.schoolCode ?? ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={statusBadgeClass(backup.status)}>{formatLabel(backup.status)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatFileSize(backup.fileSize)}</td>
                    <td className="px-3 py-3 text-slate-700">{backup.createdBy?.name ?? 'N/A'}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(backup.startedAt)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(backup.completedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          onClick={() => setSelectedBackupJob(backup)}
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={!backup.downloadAvailable || !serviceStatus.downloadImplemented}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 disabled:cursor-not-allowed"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          disabled={!serviceStatus.restoreExecutionImplemented}
                          onClick={() => {
                            setFormError('');
                            setRestoreBackupJob(backup);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 disabled:cursor-not-allowed"
                        >
                          Restore
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No backup jobs found." />
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Restore Jobs</h2>
            <p className="mt-1 text-sm text-slate-500">Restore request records and approval status.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {visibleRestores.length} shown
          </span>
        </div>
        {isRestoresLoading ? (
          <SkeletonRows />
        ) : isRestoresError ? (
          <EmptyState message="Unable to load restore requests." />
        ) : visibleRestores.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="whitespace-nowrap px-3 py-3">Restore ID</th>
                  <th className="whitespace-nowrap px-3 py-3">Backup ID</th>
                  <th className="whitespace-nowrap px-3 py-3">Scope</th>
                  <th className="whitespace-nowrap px-3 py-3">School</th>
                  <th className="whitespace-nowrap px-3 py-3">Status</th>
                  <th className="whitespace-nowrap px-3 py-3">Requested by</th>
                  <th className="whitespace-nowrap px-3 py-3">Approved by</th>
                  <th className="whitespace-nowrap px-3 py-3">Requested</th>
                  <th className="whitespace-nowrap px-3 py-3">Completed</th>
                  <th className="whitespace-nowrap px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRestores.map((restore: RestoreJob) => (
                  <tr key={restore.id} className="hover:bg-slate-50">
                    <td className="max-w-[160px] truncate px-3 py-3 font-semibold text-slate-950">{restore.id}</td>
                    <td className="max-w-[160px] truncate px-3 py-3 text-slate-700">{restore.backupId}</td>
                    <td className="px-3 py-3 text-slate-700">{formatLabel(restore.scope)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{restore.schoolName ?? 'N/A'}</p>
                      <p className="text-xs text-slate-500">{restore.schoolCode ?? ''}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge className={statusBadgeClass(restore.status)}>{formatLabel(restore.status)}</Badge>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{restore.requestedBy?.name ?? 'N/A'}</td>
                    <td className="px-3 py-3 text-slate-700">{restore.approvedBy?.name ?? 'N/A'}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(restore.requestedAt)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDateTime(restore.completedAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRestoreJob(restore)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={restore.status !== 'REQUESTED'}
                          onClick={() => approveRestoreMutation.mutate(restore.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={!serviceStatus.rejectRestoreImplemented}
                          onClick={() => rejectRestoreMutation.mutate(restore.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No restore requests found." />
        )}
      </section>
    </div>
  );
}
