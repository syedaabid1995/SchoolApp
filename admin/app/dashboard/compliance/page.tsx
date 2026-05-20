'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/Button';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import {
  approveDeletionRequest,
  approveExportRequest,
  getComplianceJobs,
  getComplianceSummary,
  getConsentRecords,
  getDeletionRequests,
  getExportRequests,
  rejectDeletionRequest,
  rejectExportRequest,
  type ComplianceJob,
  type ConsentRecord,
  type DataDeletionRequest,
  type DataExportRequest,
} from '../../../services/compliance.service';

type TabKey = 'overview' | 'exports' | 'deletions' | 'consents' | 'jobs';
type RequestItem = DataExportRequest | DataDeletionRequest;

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'exports', label: 'Data Exports' },
  { key: 'deletions', label: 'Deletion Requests' },
  { key: 'consents', label: 'Consents' },
  { key: 'jobs', label: 'Jobs' },
];

const statusOptions = ['REQUESTED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED'];

const formatNumber = (value: unknown) => {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(numeric) ? numeric : 0);
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

const statusBadgeClass = (status?: string | null) => {
  const normalized = (status ?? '').toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'GRANTED' || normalized === 'ACTIVE') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  }
  if (normalized === 'RUNNING' || normalized === 'REQUESTED' || normalized === 'PENDING') {
    return 'bg-sky-50 text-sky-700 ring-sky-200';
  }
  if (normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'REVOKED' || normalized === 'WITHDRAWN') {
    return 'bg-rose-50 text-rose-700 ring-rose-200';
  }
  if (normalized === 'NOT_IMPLEMENTED' || normalized === 'CANCELLED') {
    return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
  return 'bg-amber-50 text-amber-700 ring-amber-200';
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
  return data?.error?.message || data?.message || fallback;
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function SummaryCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-950">{formatNumber(value)}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
    </article>
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

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'N/A'}</div>
    </div>
  );
}

function RequestDetailModal({
  request,
  type,
  onClose,
}: {
  request: RequestItem;
  type: 'export' | 'deletion';
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {type === 'export' ? 'Data Export Request' : 'Data Deletion Request'}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">{request.requestNumber ?? request.id}</h2>
          </div>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <DetailRow label="Request ID" value={request.id} />
          <DetailRow label="Status" value={<Badge className={statusBadgeClass(request.status)}>{formatLabel(request.status)}</Badge>} />
          <DetailRow label="School" value={`${request.schoolName ?? 'N/A'}${request.schoolCode ? ` (${request.schoolCode})` : ''}`} />
          <DetailRow label="Requested by" value={request.requestedBy ? `${request.requestedBy.name} (${request.requestedBy.email ?? 'no email'})` : 'N/A'} />
          <DetailRow label="Subject type" value={request.subjectType ?? 'SCHOOL'} />
          <DetailRow label="Subject ID" value={request.subjectId ?? 'N/A'} />
          <DetailRow label="Requested at" value={formatDateTime(request.requestedAt)} />
          <DetailRow label="Approved by" value={request.approvedBy?.name ?? 'N/A'} />
          <DetailRow label="Approved at" value={formatDateTime(request.approvedAt)} />
          <DetailRow label="Completed at" value={formatDateTime(request.completedAt)} />
          <DetailRow label="Reason" value={request.reason ?? 'N/A'} />
          <DetailRow label="Rejection reason" value={request.rejectionReason ?? 'N/A'} />
        </div>
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [filters, setFilters] = useState({ query: '', status: '', schoolId: '' });
  const [selectedRequest, setSelectedRequest] = useState<{ type: 'export' | 'deletion'; item: RequestItem } | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const schoolsQuery = useQuery({
    queryKey: ['compliance-schools'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const queryParams = useMemo(
    () => ({
      query: filters.query,
      status: filters.status,
      schoolId: filters.schoolId,
      limit: 50,
    }),
    [filters],
  );

  const summaryQuery = useQuery({
    queryKey: ['compliance-summary'],
    queryFn: getComplianceSummary,
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const exportsQuery = useQuery({
    queryKey: ['compliance-export-requests', queryParams],
    queryFn: () => getExportRequests(queryParams),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const deletionsQuery = useQuery({
    queryKey: ['compliance-deletion-requests', queryParams],
    queryFn: () => getDeletionRequests(queryParams),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const consentsQuery = useQuery({
    queryKey: ['compliance-consents', queryParams],
    queryFn: () => getConsentRecords(queryParams),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const jobsQuery = useQuery({
    queryKey: ['compliance-jobs', queryParams],
    queryFn: () => getComplianceJobs(queryParams),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (summaryQuery.data || exportsQuery.data || deletionsQuery.data || consentsQuery.data || jobsQuery.data) {
      setLastUpdated(new Date());
    }
  }, [summaryQuery.data, exportsQuery.data, deletionsQuery.data, consentsQuery.data, jobsQuery.data]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['compliance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-export-requests'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-deletion-requests'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-consents'] });
    queryClient.invalidateQueries({ queryKey: ['compliance-jobs'] });
  };

  const approveExportMutation = useMutation({
    mutationFn: (id: string) => approveExportRequest(id),
    onSuccess: () => {
      setMessage('Export request approved.');
      setError('');
      refreshAll();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Unable to approve export request.')),
  });

  const rejectExportMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectExportRequest(id, { reason }),
    onSuccess: () => {
      setMessage('Export request rejected.');
      setError('');
      refreshAll();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Unable to reject export request.')),
  });

  const approveDeletionMutation = useMutation({
    mutationFn: (id: string) => approveDeletionRequest(id),
    onSuccess: () => {
      setMessage('Deletion request approved. Deletion execution is separate and remains controlled by backend workflow.');
      setError('');
      refreshAll();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Unable to approve deletion request.')),
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectDeletionRequest(id, { reason }),
    onSuccess: () => {
      setMessage('Deletion request rejected.');
      setError('');
      refreshAll();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Unable to reject deletion request.')),
  });

  const approveExport = (request: DataExportRequest) => {
    if (!window.confirm('Approve this data export request?')) return;
    approveExportMutation.mutate(request.id);
  };

  const rejectExport = (request: DataExportRequest) => {
    const reason = window.prompt('Enter rejection reason');
    if (!reason?.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    rejectExportMutation.mutate({ id: request.id, reason: reason.trim() });
  };

  const approveDeletion = (request: DataDeletionRequest) => {
    const confirmation = window.prompt(
      'Approving deletion can permanently remove or anonymize data. Type DELETE to confirm.',
    );
    if (confirmation !== 'DELETE') {
      setError('Deletion approval requires typing DELETE.');
      return;
    }
    approveDeletionMutation.mutate(request.id);
  };

  const rejectDeletion = (request: DataDeletionRequest) => {
    const reason = window.prompt('Enter rejection reason');
    if (!reason?.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    rejectDeletionMutation.mutate({ id: request.id, reason: reason.trim() });
  };

  if (isSessionLoading) return <FullPageLoader label="Loading compliance..." />;
  if (!isSuperAdmin) return null;

  const summary = summaryQuery.data;
  const isBusy =
    approveExportMutation.isPending ||
    rejectExportMutation.isPending ||
    approveDeletionMutation.isPending ||
    rejectDeletionMutation.isPending;

  const renderExportTable = () => {
    if (exportsQuery.isLoading) return <SkeletonRows />;
    if (exportsQuery.isError) return <EmptyState message="Unable to load export requests." />;
    const items = exportsQuery.data?.items ?? [];
    if (!items.length) return <EmptyState message="No export requests found." />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Request</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Requested by</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Requested</th>
              <th className="px-3 py-3">Completed</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((request) => (
              <tr key={request.id} className="align-top">
                <td className="px-3 py-3 font-semibold text-slate-950">{request.requestNumber ?? request.id}</td>
                <td className="px-3 py-3 text-slate-600">{request.schoolName ?? 'N/A'}</td>
                <td className="px-3 py-3 text-slate-600">{request.requestedBy?.name ?? 'N/A'}</td>
                <td className="px-3 py-3 text-slate-600">{request.subjectType ?? 'SCHOOL'}</td>
                <td className="px-3 py-3"><Badge className={statusBadgeClass(request.status)}>{formatLabel(request.status)}</Badge></td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(request.requestedAt)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(request.completedAt)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedRequest({ type: 'export', item: request })}>View</button>
                    <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => approveExport(request)}>Approve</button>
                    <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => rejectExport(request)}>Reject</button>
                    <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-400" disabled>
                      {request.downloadAvailable ? 'Download' : 'No download'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDeletionTable = () => {
    if (deletionsQuery.isLoading) return <SkeletonRows />;
    if (deletionsQuery.isError) return <EmptyState message="Unable to load deletion requests." />;
    const items = deletionsQuery.data?.items ?? [];
    if (!items.length) return <EmptyState message="No deletion requests found." />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Request</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Requested by</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Requested</th>
              <th className="px-3 py-3">Approved by</th>
              <th className="px-3 py-3">Completed</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((request) => (
              <tr key={request.id} className="align-top">
                <td className="px-3 py-3 font-semibold text-slate-950">{request.requestNumber ?? request.id}</td>
                <td className="px-3 py-3 text-slate-600">{request.schoolName ?? 'N/A'}</td>
                <td className="px-3 py-3 text-slate-600">{request.requestedBy?.name ?? 'N/A'}</td>
                <td className="px-3 py-3"><Badge className={statusBadgeClass(request.status)}>{formatLabel(request.status)}</Badge></td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(request.requestedAt)}</td>
                <td className="px-3 py-3 text-slate-600">{request.approvedBy?.name ?? 'N/A'}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(request.completedAt)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSelectedRequest({ type: 'deletion', item: request })}>View</button>
                    <button className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => approveDeletion(request)}>Approve</button>
                    <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => rejectDeletion(request)}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderConsentsTable = () => {
    if (consentsQuery.isLoading) return <SkeletonRows />;
    if (consentsQuery.isError) return <EmptyState message="Unable to load consent records." />;
    const items = consentsQuery.data?.items ?? [];
    if (!items.length) return <EmptyState message="No consent records found." />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Consent type</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Given</th>
              <th className="px-3 py-3">Revoked</th>
              <th className="px-3 py-3">Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((record: ConsentRecord) => (
              <tr key={record.id}>
                <td className="px-3 py-3 font-semibold text-slate-950">{record.schoolName ?? 'N/A'}</td>
                <td className="px-3 py-3 text-slate-600">{record.subjectType ?? 'PARENT'}</td>
                <td className="px-3 py-3 text-slate-600">{formatLabel(record.consentType)}</td>
                <td className="px-3 py-3"><Badge className={statusBadgeClass(record.status)}>{formatLabel(record.status)}</Badge></td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(record.givenAt)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(record.revokedAt)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(record.expiresAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderJobsTable = () => {
    if (jobsQuery.isLoading) return <SkeletonRows />;
    if (jobsQuery.isError) return <EmptyState message="Unable to load compliance jobs." />;
    const items = jobsQuery.data?.items ?? [];
    if (!items.length) return <EmptyState message="No compliance jobs found." />;
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Job ID</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3">School</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Started</th>
              <th className="px-3 py-3">Completed</th>
              <th className="px-3 py-3">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((job: ComplianceJob) => (
              <tr key={`${job.type}-${job.id}`}>
                <td className="px-3 py-3 font-semibold text-slate-950">{job.id}</td>
                <td className="px-3 py-3 text-slate-600">{formatLabel(job.type)}</td>
                <td className="px-3 py-3 text-slate-600">{job.schoolName ?? 'N/A'}</td>
                <td className="px-3 py-3"><Badge className={statusBadgeClass(job.status)}>{formatLabel(job.status)}</Badge></td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(job.startedAt)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDateTime(job.completedAt)}</td>
                <td className="px-3 py-3 text-slate-600">{job.errorMessage ?? 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {isBusy ? <FullPageLoader label="Updating compliance request..." /> : null}
      <PageHeader title="Compliance" subtitle="Manage data exports, deletion requests, consent records, and compliance jobs." />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-sm">
        <p className="font-semibold">Compliance actions can expose or modify sensitive data.</p>
        <p className="mt-1">Review requests carefully before approval. Export approval/rejection and deletion rejection are not implemented by the current backend workflow, so the API reports that honestly.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Filters</h2>
            <p className="mt-1 text-sm text-slate-500">Search by request ID, school, or requester.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search"
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
            </select>
            <select
              value={filters.schoolId}
              onChange={(event) => setFilters((current) => ({ ...current, schoolId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">All schools</option>
              {schoolsQuery.data?.items.map((school) => (
                <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
              ))}
            </select>
            <Button variant="outline" onClick={refreshAll}>Refresh</Button>
          </div>
        </div>
        {lastUpdated ? <p className="mt-3 text-xs text-slate-500">Last updated: {formatDateTime(lastUpdated.toISOString())}</p> : null}
        {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard label="Pending exports" value={summary?.exportRequests.pending ?? 0} helper="Export requests awaiting workflow support." />
        <SummaryCard label="Pending deletions" value={summary?.deletionRequests.pending ?? 0} helper="Deletion requests awaiting approval." />
        <SummaryCard label="Active consents" value={summary?.consents.active ?? 0} helper="Granted or active consent records." />
        <SummaryCard label="Failed jobs" value={summary?.jobs.failed ?? 0} helper="Export and deletion jobs that failed." />
        <SummaryCard label="Completed exports" value={summary?.exportRequests.completed ?? 0} helper="Finished export jobs." />
        <SummaryCard label="Completed deletions" value={summary?.deletionRequests.completed ?? 0} helper="Finished deletion jobs." />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === 'overview' ? (
            <div className="grid gap-5 xl:grid-cols-2">
              <div>
                <h3 className="mb-3 text-base font-bold text-slate-950">Latest export requests</h3>
                {renderExportTable()}
              </div>
              <div>
                <h3 className="mb-3 text-base font-bold text-slate-950">Latest deletion requests</h3>
                {renderDeletionTable()}
              </div>
            </div>
          ) : null}
          {activeTab === 'exports' ? renderExportTable() : null}
          {activeTab === 'deletions' ? renderDeletionTable() : null}
          {activeTab === 'consents' ? renderConsentsTable() : null}
          {activeTab === 'jobs' ? renderJobsTable() : null}
        </div>
      </section>

      {selectedRequest ? (
        <RequestDetailModal
          request={selectedRequest.item}
          type={selectedRequest.type}
          onClose={() => setSelectedRequest(null)}
        />
      ) : null}
    </div>
  );
}
