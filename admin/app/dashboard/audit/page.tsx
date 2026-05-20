'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import FullPageLoader from '../../../components/FullPageLoader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  downloadAuditExport,
  getAuditExports,
  getAuditLogById,
  getAuditLogs,
  getAuditLogSummary,
  getHighRiskAuditLogs,
  listAuditLogs,
  requestAuditExport,
  type AuditExportItem,
  type AuditLogItem,
} from '../../../services/audit.service';

const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const roleOptions = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF', 'PARENT', 'STUDENT'];

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

const severityClass = (severity?: string | null) => {
  if (severity === 'CRITICAL') return 'bg-rose-600 text-white ring-rose-700';
  if (severity === 'HIGH') return 'bg-red-50 text-red-700 ring-red-200';
  if (severity === 'MEDIUM') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

const exportStatusClass = (status?: string | null) => {
  if (status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'FAILED') return 'bg-rose-50 text-rose-700 ring-rose-200';
  if (status === 'RUNNING' || status === 'PENDING') return 'bg-blue-50 text-blue-700 ring-blue-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function StatCard({ label, value, helper }: { label: string; value: ReactNode; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-[var(--shell-text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--shell-muted)]">{helper}</p>
    </div>
  );
}

const defaultExportDates = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
};

export default function AuditPage() {
  const searchParams = useSearchParams();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    action: '',
    severity: '',
    schoolId: '',
    actorRole: '',
    targetType: '',
    targetId: '',
    ipAddress: '',
    dateFrom: '',
    dateTo: '',
  });
  const [exportForm, setExportForm] = useState({
    format: 'csv' as 'csv' | 'json',
    ...defaultExportDates(),
    action: '',
    severity: '',
    schoolId: '',
    reason: '',
    confirmed: false,
  });

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
      setFilters((current) => ({ ...current, search: urlSearch, page: 1 }));
    }
  }, [searchParams]);

  useEffect(() => {
    if (session?.role === 'TEACHER') {
      setFilters((current) => ({ ...current, actorRole: 'TEACHER' }));
    }
  }, [session?.role]);

  const queryParams = useMemo(
    () => ({
      page: filters.page,
      limit: filters.limit,
      search: filters.search.trim() || undefined,
      action: filters.action || undefined,
      event: filters.action || undefined,
      severity: isSuperAdmin ? filters.severity || undefined : undefined,
      schoolId: isSuperAdmin ? filters.schoolId || undefined : undefined,
      actorRole: filters.actorRole || undefined,
      targetType: filters.targetType || undefined,
      entityType: filters.targetType || undefined,
      targetId: filters.targetId || undefined,
      entityId: filters.targetId || undefined,
      ipAddress: isSuperAdmin ? filters.ipAddress || undefined : undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [filters, isSuperAdmin],
  );

  const {
    data: logs,
    isLoading: logsLoading,
    isError: logsError,
    refetch,
  } = useQuery({
    queryKey: ['audit-logs-advanced', isSuperAdmin, queryParams],
    queryFn: () => (isSuperAdmin ? getAuditLogs(queryParams) : listAuditLogs(queryParams)),
    enabled: Boolean(session?.role),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['audit-summary'],
    queryFn: getAuditLogSummary,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: highRisk } = useQuery({
    queryKey: ['audit-high-risk'],
    queryFn: () => getHighRiskAuditLogs({ limit: 8 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: exportsData } = useQuery({
    queryKey: ['audit-exports'],
    queryFn: () => getAuditExports({ limit: 8 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const { data: schools } = useQuery({
    queryKey: ['audit-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const { data: selectedLog, isLoading: selectedLogLoading } = useQuery({
    queryKey: ['audit-log-detail', selectedLogId],
    queryFn: () => getAuditLogById(selectedLogId as string),
    enabled: Boolean(selectedLogId) && isSuperAdmin,
    staleTime: 15_000,
  });

  const exportMutation = useMutation({
    mutationFn: () => {
      if (!exportForm.reason.trim()) throw new Error('Export reason is required.');
      if (!exportForm.confirmed) throw new Error('Confirm that you understand audit export sensitivity.');
      return requestAuditExport({
        format: exportForm.format,
        filters: {
          dateFrom: exportForm.dateFrom,
          dateTo: exportForm.dateTo,
          action: exportForm.action || undefined,
          event: exportForm.action || undefined,
          severity: exportForm.severity || undefined,
          schoolId: exportForm.schoolId || undefined,
        },
        reason: exportForm.reason.trim(),
      });
    },
    onSuccess: (result) => {
      notify.success('Audit export created', result.message);
      setExportOpen(false);
      setExportForm({ format: 'csv', ...defaultExportDates(), action: '', severity: '', schoolId: '', reason: '', confirmed: false });
      queryClient.invalidateQueries({ queryKey: ['audit-exports'] });
      queryClient.invalidateQueries({ queryKey: ['audit-summary'] });
    },
    onError: (error: any) => {
      notify.error('Export failed', error?.response?.data?.error?.message || error?.message || 'Unable to export audit logs.');
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (item: AuditExportItem) => {
      const blob = await downloadAuditExport(item.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-export-${item.id}.${item.format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => notify.success('Download started', 'The audit export download has started.'),
    onError: (error: any) => notify.error('Download failed', error?.response?.data?.error?.message || 'Download not available yet.'),
  });

  const setFilter = (key: keyof typeof filters, value: string | number) => {
    setFilters((current) => ({ ...current, [key]: value, ...(key === 'page' ? {} : { page: 1 }) }));
  };

  if (isSessionLoading || !session?.role) {
    return <FullPageLoader label="Loading audit logs..." />;
  }

  const rows = logs?.items ?? [];
  const pagination = logs?.pagination ?? {
    page: logs?.page ?? filters.page,
    limit: logs?.limit ?? filters.limit,
    total: logs?.total ?? 0,
    totalPages: logs?.pages ?? 1,
  };

  return (
    <div className="space-y-6 pb-12">
      {(logsLoading || summaryLoading) ? <FullPageLoader label="Loading audit logs..." /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Audit Logs"
          subtitle="Inspect platform activity, security events, and administrative actions."
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)] shadow-sm hover:bg-[var(--shell-hover)]"
          >
            Refresh
          </button>
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Export
            </button>
          ) : null}
        </div>
      </div>

      {isSuperAdmin ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Total" value={summary?.total ?? 0} helper="All audit logs" />
          <StatCard label="Today" value={summary?.today ?? 0} helper="Events today" />
          <StatCard label="High Risk" value={summary?.highRiskToday ?? 0} helper="High or critical today" />
          <StatCard label="Failed Logins" value={summary?.failedLoginsToday ?? 0} helper="Login failures today" />
          <StatCard label="Admin Actions" value={summary?.adminActionsToday ?? 0} helper="Platform actions today" />
          <StatCard label="Exports" value={summary?.exportsToday ?? 0} helper="Audit exports today" />
        </section>
      ) : null}

      <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <label className="lg:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Search</span>
            <input
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
              placeholder="Event, actor, target"
              className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <FilterInput label="Event" value={filters.action} onChange={(value) => setFilter('action', value)} placeholder="LOGIN_FAILED" />
          <FilterSelect label="Role" value={filters.actorRole} onChange={(value) => setFilter('actorRole', value)} disabled={session.role === 'TEACHER'}>
            <option value="">All roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>{formatLabel(role)}</option>
            ))}
          </FilterSelect>
          {isSuperAdmin ? (
            <FilterSelect label="Severity" value={filters.severity} onChange={(value) => setFilter('severity', value)}>
              <option value="">All severities</option>
              {severityOptions.map((severity) => (
                <option key={severity} value={severity}>{formatLabel(severity)}</option>
              ))}
            </FilterSelect>
          ) : null}
          <FilterInput label="Target Type" value={filters.targetType} onChange={(value) => setFilter('targetType', value)} placeholder="USER" />
          {isSuperAdmin ? (
            <FilterSelect label="School" value={filters.schoolId} onChange={(value) => setFilter('schoolId', value)}>
              <option value="">All schools</option>
              {(schools?.items ?? []).map((school) => (
                <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
              ))}
            </FilterSelect>
          ) : null}
          {isSuperAdmin ? <FilterInput label="IP Address" value={filters.ipAddress} onChange={(value) => setFilter('ipAddress', value)} placeholder="103." /> : null}
          <FilterInput label="Date From" type="date" value={filters.dateFrom} onChange={(value) => setFilter('dateFrom', value)} />
          <FilterInput label="Date To" type="date" value={filters.dateTo} onChange={(value) => setFilter('dateTo', value)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--shell-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--shell-text)]">Activity Timeline</h2>
            <p className="text-sm text-[var(--shell-muted)]">{pagination.total} records found</p>
          </div>
          <FilterSelect label="Rows" value={String(filters.limit)} onChange={(value) => setFilter('limit', Number(value))}>
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </FilterSelect>
        </div>

        {logsError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-rose-600">Unable to load audit logs.</p>
            <button type="button" onClick={() => refetch()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Retry</button>
          </div>
        ) : rows.length === 0 && !logsLoading ? (
          <div className="p-10 text-center text-sm text-[var(--shell-muted)]">No audit logs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--shell-border)] text-sm">
              <thead className="bg-[var(--shell-subtle)] text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">
                <tr>
                  <th className="px-5 py-3">Time</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">School</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--shell-border)]">
                {rows.map((log) => (
                  <AuditRow key={log.id} log={log} isSuperAdmin={isSuperAdmin} onView={() => setSelectedLogId(log.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--shell-border)] px-5 py-4 text-sm text-[var(--shell-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" disabled={filters.page <= 1} onClick={() => setFilter('page', Math.max(1, filters.page - 1))} className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
            <button type="button" disabled={filters.page >= pagination.totalPages} onClick={() => setFilter('page', filters.page + 1)} className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {isSuperAdmin ? (
        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="High-risk events">
            {(highRisk?.items ?? []).length === 0 ? (
              <EmptyText>No high-risk audit events found.</EmptyText>
            ) : (
              <div className="space-y-3">
                {highRisk?.items.map((log) => (
                  <div key={log.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--shell-text)]">{formatLabel(log.event ?? log.action)}</p>
                        <p className="text-xs text-[var(--shell-muted)]">{log.actor?.email ?? 'Unknown actor'} - {formatDateTime(log.createdAt)}</p>
                      </div>
                      <Badge className={severityClass(log.severity)}>{formatLabel(log.severity)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Audit export history">
            {(exportsData?.items ?? []).length === 0 ? (
              <EmptyText>No audit exports found.</EmptyText>
            ) : (
              <div className="space-y-3">
                {exportsData?.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--shell-text)]">{item.format.toUpperCase()} export</p>
                        <p className="text-xs text-[var(--shell-muted)]">{item.reason ?? 'No reason'} - {formatDateTime(item.createdAt)}</p>
                        <p className="mt-1 text-xs text-[var(--shell-muted)]">{item.rowCount ?? 0} rows</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={exportStatusClass(item.status)}>{formatLabel(item.status)}</Badge>
                        <button
                          type="button"
                          disabled={!item.downloadAvailable || downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate(item)}
                          className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)] disabled:opacity-40"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>
      ) : null}

      {selectedLogId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button type="button" aria-label="Close audit detail" className="absolute inset-0 cursor-default" onClick={() => setSelectedLogId(null)} />
          <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-[var(--shell-card)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Audit detail</p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{formatLabel(selectedLog?.event ?? selectedLog?.action)}</h2>
                <p className="text-sm text-[var(--shell-muted)]">{selectedLogId}</p>
              </div>
              <button type="button" onClick={() => setSelectedLogId(null)} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">Close</button>
            </div>
            {selectedLogLoading || !selectedLog ? (
              <div className="p-8 text-sm text-[var(--shell-muted)]">Loading detail...</div>
            ) : (
              <div className="space-y-5 py-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoBox label="Severity" value={<Badge className={severityClass(selectedLog.severity)}>{formatLabel(selectedLog.severity)}</Badge>} />
                  <InfoBox label="Time" value={formatDateTime(selectedLog.createdAt)} />
                  <InfoBox label="Actor" value={selectedLog.actor?.email ?? 'Unknown'} />
                  <InfoBox label="School" value={selectedLog.schoolName ?? selectedLog.school?.name ?? 'Global'} />
                  <InfoBox label="Target" value={`${selectedLog.targetType ?? selectedLog.entityType ?? 'N/A'} / ${selectedLog.targetId ?? selectedLog.entityId ?? 'N/A'}`} />
                  <InfoBox label="IP" value={selectedLog.ipAddress ?? 'N/A'} />
                </div>
                <section className="rounded-2xl border border-[var(--shell-border)] p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Sanitized metadata</h3>
                  <pre className="mt-3 max-h-[420px] overflow-auto rounded-xl bg-[var(--shell-subtle)] p-4 text-xs text-[var(--shell-text)]">
                    {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                  </pre>
                </section>
              </div>
            )}
          </aside>
        </div>
      ) : null}

      {exportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--shell-border)] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-muted)]">Audit export</p>
                <h2 className="mt-1 text-xl font-bold text-[var(--shell-text)]">Create safe audit export</h2>
              </div>
              <button type="button" onClick={() => setExportOpen(false)} className="rounded-xl border border-[var(--shell-border)] px-3 py-2 text-sm font-semibold text-[var(--shell-text)]">Close</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <FilterSelect label="Format" value={exportForm.format} onChange={(value) => setExportForm({ ...exportForm, format: value as 'csv' | 'json' })}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </FilterSelect>
              <FilterInput label="Event" value={exportForm.action} onChange={(value) => setExportForm({ ...exportForm, action: value })} placeholder="LOGIN_FAILED" />
              <FilterInput label="Date From" type="date" value={exportForm.dateFrom} onChange={(value) => setExportForm({ ...exportForm, dateFrom: value })} />
              <FilterInput label="Date To" type="date" value={exportForm.dateTo} onChange={(value) => setExportForm({ ...exportForm, dateTo: value })} />
              <FilterSelect label="Severity" value={exportForm.severity} onChange={(value) => setExportForm({ ...exportForm, severity: value })}>
                <option value="">Any severity</option>
                {severityOptions.map((severity) => <option key={severity} value={severity}>{formatLabel(severity)}</option>)}
              </FilterSelect>
              <FilterSelect label="School" value={exportForm.schoolId} onChange={(value) => setExportForm({ ...exportForm, schoolId: value })}>
                <option value="">All schools</option>
                {(schools?.items ?? []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
              </FilterSelect>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Reason</span>
                <textarea value={exportForm.reason} onChange={(event) => setExportForm({ ...exportForm, reason: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)]" />
              </label>
              <label className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <input type="checkbox" checked={exportForm.confirmed} onChange={(event) => setExportForm({ ...exportForm, confirmed: event.target.checked })} className="mr-2" />
                I understand audit exports may contain sensitive operational information.
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2 border-t border-[var(--shell-border)] pt-4">
              <button type="button" onClick={() => setExportOpen(false)} className="rounded-xl border border-[var(--shell-border)] px-4 py-2 text-sm font-semibold text-[var(--shell-text)]">Cancel</button>
              <button type="button" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {exportMutation.isPending ? 'Exporting...' : 'Create Export'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AuditRow({ log, isSuperAdmin, onView }: { log: AuditLogItem; isSuperAdmin: boolean; onView: () => void }) {
  const event = log.event ?? log.action;
  const targetType = log.targetType ?? log.entityType;
  const targetId = log.targetId ?? log.entityId;
  return (
    <tr className="hover:bg-[var(--shell-hover)]">
      <td className="px-5 py-4 text-[var(--shell-muted)]">{formatDateTime(log.createdAt)}</td>
      <td className="px-5 py-4">
        <div className="font-semibold text-[var(--shell-text)]">{formatLabel(event)}</div>
        {isSuperAdmin ? <Badge className={severityClass(log.severity)}>{formatLabel(log.severity)}</Badge> : null}
      </td>
      <td className="px-5 py-4">
        <div className="font-semibold text-[var(--shell-text)]">{log.actor?.name ?? log.actor?.email ?? log.actorId ?? 'Unknown'}</div>
        <div className="text-xs text-[var(--shell-muted)]">{formatLabel(log.actor?.role ?? log.actorRole)}</div>
      </td>
      <td className="px-5 py-4 text-[var(--shell-muted)]">{log.schoolName ?? 'Global'}</td>
      <td className="px-5 py-4 text-[var(--shell-muted)]">{targetType ?? 'N/A'} / {targetId ?? 'N/A'}</td>
      <td className="px-5 py-4 text-[var(--shell-muted)]">{log.ipAddress ?? 'N/A'}</td>
      <td className="max-w-[260px] truncate px-5 py-4 text-[var(--shell-muted)]">{log.metadataSummary ?? 'N/A'}</td>
      <td className="px-5 py-4 text-right">
        {isSuperAdmin ? (
          <button type="button" onClick={onView} className="rounded-lg border border-[var(--shell-border)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]">View</button>
        ) : (
          <span className="text-xs text-[var(--shell-muted)]">Scoped</span>
        )}
      </td>
    </tr>
  );
}

function FilterInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500" />
    </label>
  );
}

function FilterSelect({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] px-3 py-2 text-sm text-[var(--shell-text)] outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60">
        {children}
      </select>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--shell-text)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-[var(--shell-border)] p-6 text-center text-sm text-[var(--shell-muted)]">{children}</p>;
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--shell-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">{label}</p>
      <div className="mt-1 text-sm font-semibold text-[var(--shell-text)]">{value}</div>
    </div>
  );
}
