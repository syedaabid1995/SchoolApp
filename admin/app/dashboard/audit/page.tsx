'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogs } from '../../../services/audit.service';

export default function AuditPage() {
  const [filters, setFilters] = useState({
    entityType: '',
    actorRole: '',
    action: '',
    page: 1,
  });

  const { data } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      listAuditLogs({
        entityType: filters.entityType || undefined,
        actorRole: filters.actorRole || undefined,
        action: filters.action || undefined,
        page: filters.page,
      }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Audit Logs</h1>
        <p className="text-sm text-slate">Filter immutable logs by entity, action, or date.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">All entities</option>
            <option value="STUDENT">Student</option>
            <option value="PARENT">Parent</option>
            <option value="TEACHER">Teacher</option>
            <option value="EXAM">Exam</option>
            <option value="EXAM_PAPER">Exam Paper</option>
            <option value="MARKS">Marks Upload</option>
            <option value="MARK">Mark</option>
            <option value="ATTENDANCE_SESSION">Attendance Session</option>
            <option value="ATTENDANCE">Attendance Capture</option>
            <option value="ATTENDANCE_RECORD">Attendance Record</option>
            <option value="STUDENT_STATUS">Student Status</option>
            <option value="STUDENT_PARENT">Student-Parent Link</option>
            <option value="STUDENT_TRANSFER">Student Transfer</option>
          </select>
          <select
            value={filters.actorRole}
            onChange={(e) => setFilters({ ...filters, actorRole: e.target.value, page: 1 })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">All roles</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="SCHOOL_ADMIN">School Admin</option>
            <option value="TEACHER">Teacher</option>
            <option value="PARENT">Parent</option>
          </select>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="STATUS_CHANGE">Status Change</option>
            <option value="LINK">Link</option>
            <option value="UNLINK">Unlink</option>
            <option value="REQUEST">Request</option>
            <option value="ACCEPT">Accept</option>
            <option value="REJECT">Reject</option>
            <option value="START">Start</option>
            <option value="CAPTURE">Capture</option>
            <option value="CLOSE">Close</option>
            <option value="OVERRIDE">Override</option>
            <option value="UPLOAD">Upload</option>
            <option value="MODERATE">Moderate</option>
            <option value="REVALUATION_REQUEST">Revaluation Request</option>
            <option value="APPROVE">Approve</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Time</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((log) => (
                <tr key={log.id} className="border-t border-slate/10">
                  <td className="py-3">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <Link
                      href={`/dashboard/users/${log.actorId}`}
                      className="text-ink underline-offset-2 hover:underline"
                    >
                      {log.actor?.teacherProfile
                        ? `${log.actor.teacherProfile.firstName} ${log.actor.teacherProfile.lastName}`
                        : log.actor?.parentProfiles?.[0]
                          ? `${log.actor.parentProfiles[0].firstName} ${log.actor.parentProfiles[0].lastName}`
                          : log.actor?.email ?? log.actorId}
                    </Link>
                    <div className="text-xs text-slate">{log.actorRole}</div>
                  </td>
                  <td>{log.entityType}</td>
                  <td>{log.action}</td>
                </tr>
              ))}
              {!data?.items.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No logs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            className="rounded-lg border border-slate/20 px-3 py-1"
            onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
            disabled={filters.page <= 1}
          >
            Previous
          </button>
          <span>
            Page {data?.page ?? filters.page} of {data?.pages ?? 1}
          </span>
          <button
            className="rounded-lg border border-slate/20 px-3 py-1"
            onClick={() => setFilters({ ...filters, page: (data?.page ?? 1) + 1 })}
            disabled={(data?.page ?? 1) >= (data?.pages ?? 1)}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
