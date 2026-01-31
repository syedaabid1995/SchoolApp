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

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState({ from: '', to: '' });
  const [schoolId, setSchoolId] = useState('');
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
        <p className="text-sm text-slate">Review daily attendance, approve sessions, and inspect audits.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        {isSuperAdmin ? (
          <div className="mb-4">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
            placeholder="From (YYYY-MM-DD)"
            type="date"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
            placeholder="To (YYYY-MM-DD)"
            type="date"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Total Records</p>
            <p className="mt-2 text-2xl font-semibold">{summary?.totals.total ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Present</p>
            <p className="mt-2 text-2xl font-semibold">{summary?.totals.present ?? 0}</p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Approval Pending</p>
            <p className="mt-2 text-2xl font-semibold">{summary?.approvals.pending ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Attendance Sessions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Date</th>
                <th>Period</th>
                <th>Status</th>
                <th>Approvals</th>
                <th>Records</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions?.map((session: AttendanceSession) => (
                <tr key={session.id} className="border-t border-slate/10">
                  <td className="py-3">{new Date(session.date).toLocaleDateString()}</td>
                  <td>{session.period?.name}</td>
                  <td>{session.status}</td>
                  <td>{session.approvalStatus}</td>
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
              {!sessions?.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate">
                    No sessions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {reject.sessionId ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Reject Session</h2>
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
  );
}
