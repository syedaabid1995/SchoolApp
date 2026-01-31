'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createTransferRequest, listStudents, listTransferTargets } from '../../../services/student.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function StudentsPage() {
  const [schoolId, setSchoolId] = useState('');
  const [transfer, setTransfer] = useState({ open: false, studentId: '', toSchoolId: '', reason: '' });
  const [transferError, setTransferError] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: students } = useQuery({
    queryKey: ['students', effectiveSchoolId],
    queryFn: () => listStudents({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: transferTargets } = useQuery({
    queryKey: ['transfer-targets', effectiveSchoolId],
    queryFn: () => listTransferTargets({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      createTransferRequest(transfer.studentId, {
        toSchoolId: transfer.toSchoolId,
        reason: transfer.reason || undefined,
        schoolId: effectiveSchoolId,
      }),
    onSuccess: () => {
      setTransferError('');
      setTransfer({ open: false, studentId: '', toSchoolId: '', reason: '' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message ?? error?.message ?? 'Unable to create transfer request.';
      setTransferError(message);
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Students</h1>
        <p className="text-sm text-slate">Student roster with parent contact details.</p>
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

        <h2 className="text-lg font-semibold">Student List</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Admission No</th>
                <th>Class</th>
                <th>Section</th>
                <th>Parent Name</th>
                <th>Parent Contact</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students?.map((student) => {
                const primaryParent = student.parentLinks?.[0]?.parent;
                return (
                  <tr key={student.id} className="border-t border-slate/10">
                    <td className="py-3">
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="text-ink underline-offset-2 hover:underline font-medium"
                      >
                        {student.firstName} {student.lastName}
                      </Link>
                    </td>
                    <td>{student.admissionNo}</td>
                    <td>{student.class?.name ?? '—'}</td>
                    <td>{student.section?.name ?? '—'}</td>
                    <td>
                      {primaryParent ? (
                        <Link
                          href={`/dashboard/parents/${primaryParent.id}`}
                          className="text-ink underline-offset-2 hover:underline"
                        >
                          {primaryParent.firstName} {primaryParent.lastName}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{primaryParent?.phone ?? '—'}</td>
                    <td>{student.status}</td>
                    <td className="text-right">
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() =>
                          setTransfer({ open: true, studentId: student.id, toSchoolId: '', reason: '' })
                        }
                      >
                        Transfer
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!students?.length ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate">
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {transfer.open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-ink">Transfer Student</h3>
            <p className="mt-1 text-sm text-slate">Select the destination school to create a transfer request.</p>
            <div className="mt-4 space-y-3">
              <select
                value={transfer.toSchoolId}
                onChange={(e) => setTransfer({ ...transfer, toSchoolId: e.target.value })}
                className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select destination school</option>
                {transferTargets?.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} ({school.code})
                  </option>
                ))}
              </select>
              <input
                value={transfer.reason}
                onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })}
                placeholder="Reason (optional)"
                className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              {transferError ? <p className="text-sm font-semibold text-rose-600">{transferError}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setTransfer({ open: false, studentId: '', toSchoolId: '', reason: '' })}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => transferMutation.mutate()}
                disabled={!transfer.toSchoolId || transferMutation.isPending}
              >
                {transferMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
