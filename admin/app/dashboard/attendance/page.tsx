'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAttendanceSummary,
  listAttendanceSessions,
  approveSession,
  rejectSession,
  type AttendanceSession,
} from '../../../services/attendance.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';
import { listAuditLogs } from '../../../services/audit.service';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState({ from: '', to: '' });
  const [schoolId, setSchoolId] = useState('');
  const [filters, setFilters] = useState({ approval: '', status: '' });
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;
  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });
  const [reject, setReject] = useState({ sessionId: '', reason: '' });

  const { data: summary } = useQuery({
    queryKey: ['attendance-summary', range, effectiveSchoolId],
    queryFn: () =>
      getAttendanceSummary({
        dateFrom: range.from || undefined,
        dateTo: range.to || undefined,
        schoolId: effectiveSchoolId,
      }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: sessions } = useQuery({
    queryKey: ['attendance-sessions', range, effectiveSchoolId],
    queryFn: () =>
      listAttendanceSessions({
        dateFrom: range.from || undefined,
        dateTo: range.to || undefined,
        schoolId: effectiveSchoolId,
      }),
    enabled: Boolean(effectiveSchoolId),
  });

  const approveMutation = useMutation({
    mutationFn: (sessionId: string) => approveSession(sessionId, effectiveSchoolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectSession(reject.sessionId, reject.reason, effectiveSchoolId),
    onSuccess: () => {
      setReject({ sessionId: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    },
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['attendance-audits', effectiveSchoolId],
    queryFn: () =>
      listAuditLogs({
        limit: 5,
        schoolId: effectiveSchoolId,
      }),
    enabled: Boolean(effectiveSchoolId),
  });

  const filteredSessions = (sessions ?? []).filter((session) => {
    const approvalMatch = !filters.approval || session.approvalStatus === filters.approval;
    const statusMatch = !filters.status || session.status === filters.status;
    return approvalMatch && statusMatch;
  });

  const selectedSchoolName = isSuperAdmin
    ? schools?.items.find((school) => school.id === schoolId)?.name ?? 'All Schools'
    : session?.schoolName ?? 'My School';

  const dateLabel =
    range.from && range.to ? `${range.from} to ${range.to}` : range.from || range.to || 'Today';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-blue-50/40">
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Attendance Review
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Daily Attendance</h1>
              <p className="max-w-2xl text-lg text-blue-100">
                {`Review attendance for ${selectedSchoolName} (${dateLabel}), approve sessions, and inspect audits.`}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-4 backdrop-blur-sm">
              <div className="text-right">
                <p className="text-xs uppercase text-blue-100">Pending Approvals</p>
                <p className="text-2xl font-semibold">{summary?.approvals.pending ?? 0}</p>
              </div>
              <div className="h-10 w-px bg-white/30" />
              <div className="text-right">
                <p className="text-xs uppercase text-blue-100">Total Records</p>
                <p className="text-2xl font-semibold">{summary?.totals.total ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            {isSuperAdmin ? (
              <select
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select school</option>
                {schools?.items.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
            ) : null}
            <input
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              placeholder="From (YYYY-MM-DD)"
              type="date"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <input
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              placeholder="To (YYYY-MM-DD)"
              type="date"
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <select
              value={filters.approval}
              onChange={(e) => setFilters({ ...filters, approval: e.target.value })}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All approvals</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
            <button
              onClick={() => setFilters({ approval: '', status: '' })}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold hover:bg-gray-50"
            >
              Clear filters
            </button>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
              <p className="text-blue-100 text-xs uppercase">Total Records</p>
              <p className="mt-2 text-2xl font-semibold">{summary?.totals.total ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
              <p className="text-emerald-100 text-xs uppercase">Present</p>
              <p className="mt-2 text-2xl font-semibold">{summary?.totals.present ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg">
              <p className="text-amber-100 text-xs uppercase">Absent</p>
              <p className="mt-2 text-2xl font-semibold">{summary?.totals.absent ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
              <p className="text-purple-100 text-xs uppercase">Pending Approvals</p>
              <p className="mt-2 text-2xl font-semibold">{summary?.approvals.pending ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[2.2fr_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Attendance Sessions</h2>
              <span className="text-sm text-gray-500">{filteredSessions.length} sessions</span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Period</th>
                    <th>Status</th>
                    <th>Approval</th>
                    <th>Records</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session: AttendanceSession) => (
                    <tr key={session.id} className="border-t border-slate/10">
                      <td className="py-3">{new Date(session.date).toLocaleDateString()}</td>
                      <td>{session.period?.name ?? '—'}</td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {session.status}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            session.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : session.approvalStatus === 'REJECTED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {session.approvalStatus}
                        </span>
                      </td>
                      <td>{session._count?.records ?? 0}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                            onClick={() => approveMutation.mutate(session.id)}
                            disabled={approveMutation.isPending || session.approvalStatus === 'APPROVED'}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                            onClick={() => setReject({ sessionId: session.id, reason: '' })}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filteredSessions.length ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate">
                        No sessions found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Recent Audit Logs</h3>
              <p className="text-sm text-gray-500">Latest attendance actions</p>
              <div className="mt-4 space-y-3">
                {(auditLogs?.items ?? []).map((log: any) => (
                  <div key={log.id} className="rounded-xl border border-slate/10 p-3">
                    <div className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</div>
                    <div className="text-sm font-semibold text-gray-900">{log.entityType}</div>
                    <div className="text-xs text-slate-600">{log.action}</div>
                  </div>
                ))}
                {!auditLogs?.items?.length ? (
                  <div className="rounded-xl border border-dashed border-slate/200 p-4 text-center text-sm text-slate-500">
                    No recent audit activity.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Quick Tips</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Approve sessions to lock daily attendance.</li>
                <li>Reject sessions with a clear reason for transparency.</li>
                <li>Use filters to focus on pending approvals.</li>
              </ul>
            </div>
          </div>
        </section>

        {reject.sessionId ? (
          <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Reject Session</h2>
            <input
              value={reject.reason}
              onChange={(e) => setReject({ ...reject, reason: e.target.value })}
              placeholder="Rejection reason"
              className="mt-3 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => rejectMutation.mutate()}
                disabled={!reject.reason || rejectMutation.isPending}
              >
                Submit Rejection
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setReject({ sessionId: '', reason: '' })}
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
