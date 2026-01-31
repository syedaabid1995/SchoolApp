'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { acceptTransferRequest, listIncomingTransferRequests, rejectTransferRequest } from '../../../../services/student.service';
import { getSession } from '../../../../services/auth.service';

export default function IncomingTransfersPage() {
  const [decision, setDecision] = useState({ requestId: '', action: 'accept' as 'accept' | 'reject', reason: '' });
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: incomingTransfers } = useQuery({
    queryKey: ['transfer-requests', schoolId],
    queryFn: () => listIncomingTransferRequests({ schoolId }),
    enabled: Boolean(schoolId),
  });

  const decisionMutation = useMutation({
    mutationFn: () =>
      decision.action === 'accept'
        ? acceptTransferRequest(decision.requestId, { reason: decision.reason || undefined, schoolId })
        : rejectTransferRequest(decision.requestId, { reason: decision.reason || undefined, schoolId }),
    onSuccess: () => setDecision({ requestId: '', action: 'accept', reason: '' }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Incoming Transfer Requests</h1>
        <p className="text-sm text-slate">Review and manage transfer requests.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Student</th>
                <th>Admission No</th>
                <th>From School</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {incomingTransfers?.map((request) => (
                <tr key={request.id} className="border-t border-slate/10">
                  <td className="py-3">
                    {request.student.firstName} {request.student.lastName}
                  </td>
                  <td>{request.student.admissionNo}</td>
                  <td>
                    {request.fromSchool.name} ({request.fromSchool.code})
                  </td>
                  <td>{request.status}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => setDecision({ requestId: request.id, action: 'accept', reason: '' })}
                      >
                        Accept
                      </button>
                      <button
                        className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                        onClick={() => setDecision({ requestId: request.id, action: 'reject', reason: '' })}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!incomingTransfers?.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No incoming requests.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {decision.requestId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold text-ink">
              {decision.action === 'accept' ? 'Accept Transfer' : 'Reject Transfer'}
            </h3>
            <p className="mt-1 text-sm text-slate">Optional reason for this decision.</p>
            <input
              value={decision.reason}
              onChange={(e) => setDecision({ ...decision, reason: e.target.value })}
              placeholder="Reason (optional)"
              className="mt-4 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setDecision({ requestId: '', action: 'accept', reason: '' })}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => decisionMutation.mutate()}
                disabled={decisionMutation.isPending}
              >
                {decisionMutation.isPending ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
