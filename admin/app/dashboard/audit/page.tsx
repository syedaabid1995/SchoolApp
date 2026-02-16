'use client';

import Link from 'next/link';
import PageHeader from '../../../components/PageHeader';
import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../components/Button';
import { listAuditLogs } from '../../../services/audit.service';
import { getSession } from '../../../services/auth.service';

export default function AuditPage() {
  const [filters, setFilters] = useState({
    entityType: '',
    actorRole: '',
    action: '',
    page: 1,
  });

  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });

  const roleOptions = useMemo(() => {
    if (session?.role === 'TEACHER') {
      return [{ value: 'TEACHER', label: 'Teacher' }];
    }
    if (session?.role === 'SCHOOL_ADMIN') {
      return [
        { value: 'SCHOOL_ADMIN', label: 'School Admin' },
        { value: 'TEACHER', label: 'Teacher' },
      ];
    }
    return [
      { value: 'SUPER_ADMIN', label: 'Super Admin' },
      { value: 'SCHOOL_ADMIN', label: 'School Admin' },
      { value: 'TEACHER', label: 'Teacher' },
      { value: 'PARENT', label: 'Parent' },
    ];
  }, [session?.role]);

  useEffect(() => {
    if (!session?.role) return;
    setFilters((prev) => {
      if (session.role === 'TEACHER') {
        return prev.actorRole === 'TEACHER' ? prev : { ...prev, actorRole: 'TEACHER', page: 1 };
      }
      if (session.role === 'SCHOOL_ADMIN') {
        if (prev.actorRole && !['SCHOOL_ADMIN', 'TEACHER'].includes(prev.actorRole)) {
          return { ...prev, actorRole: '', page: 1 };
        }
      }
      return prev;
    });
  }, [session?.role]);

  const { data } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      listAuditLogs({
        entityType: filters.entityType || undefined,
        actorRole: filters.actorRole || undefined,
        action: filters.action || undefined,
        page: filters.page,
      }),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="Audit Logs"
          subtitle="Monitor system activities, track user actions, and maintain comprehensive audit trails for compliance."
        />
        {/* Audit Logs Table */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Activity Timeline</h2>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Entity Type</label>
              <select
                value={filters.entityType}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
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
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">User Role</label>
              <select
                value={filters.actorRole}
                onChange={(e) => setFilters({ ...filters, actorRole: e.target.value, page: 1 })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                disabled={session?.role === 'TEACHER'}
              >
                <option value="">All roles</option>
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Action</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
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
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Timestamp</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entity</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.items.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                          <svg className="h-4 w-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <Link
                        href={
                          log.actor?.teacherProfile?.id
                            ? `/dashboard/teachers/${log.actor.teacherProfile.id}`
                            : log.actor?.parentProfiles?.[0]?.id
                              ? `/dashboard/parents/${log.actor.parentProfiles[0].id}`
                              : log.entityType === 'STUDENT'
                                ? `/dashboard/students/${log.entityId}`
                                : `/dashboard/users/${log.actorId}`
                        }
                        className="font-medium text-gray-900 hover:text-gray-600 transition-colors"
                      >
                        {log.actor?.teacherProfile
                          ? `${log.actor.teacherProfile.firstName} ${log.actor.teacherProfile.lastName}`
                          : log.actor?.parentProfiles?.[0]
                            ? `${log.actor.parentProfiles[0].firstName} ${log.actor.parentProfiles[0].lastName}`
                            : log.actor?.email ?? log.actorId}
                      </Link>
                      <div className="text-xs text-gray-500">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          log.actorRole === 'SUPER_ADMIN' ? 'bg-red-100 text-red-800' :
                          log.actorRole === 'SCHOOL_ADMIN' ? 'bg-blue-100 text-blue-800' :
                          log.actorRole === 'TEACHER' ? 'bg-purple-100 text-purple-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {log.actorRole.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800">
                        {log.entityType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.items.length && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
                        <p className="mt-1 text-sm text-gray-500">Try adjusting your filters to see more results.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {data?.page ?? filters.page} of {data?.pages ?? 1}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ ...filters, page: (data?.page ?? 1) + 1 })}
                disabled={(data?.page ?? 1) >= (data?.pages ?? 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
