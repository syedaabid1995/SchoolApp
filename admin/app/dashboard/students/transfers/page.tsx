'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { acceptTransferRequest, listIncomingTransferRequests, rejectTransferRequest } from '../../../../services/student.service';
import { getSession } from '../../../../services/auth.service';
import { useNotify } from '../../../../components/NotificationProvider';
import FullPageLoader from '../../../../components/FullPageLoader';

export default function IncomingTransfersPage() {
  const notify = useNotify();
  const [decision, setDecision] = useState({ requestId: '', action: 'accept' as 'accept' | 'reject', reason: '' });
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;

  const { data: incomingTransfers, isLoading } = useQuery({
    queryKey: ['transfer-requests', schoolId],
    queryFn: () => listIncomingTransferRequests({ schoolId }),
    enabled: Boolean(schoolId),
  });

  const decisionMutation = useMutation({
    mutationFn: () => {
      return decision.action === 'accept'
        ? acceptTransferRequest(decision.requestId, { reason: decision.reason || undefined, schoolId })
        : rejectTransferRequest(decision.requestId, { reason: decision.reason || undefined, schoolId });
    },
    onSuccess: () => {
      const action = decision.action === 'accept' ? 'accepted' : 'rejected';
      notify.success(`Transfer ${action}!`, `Transfer request has been ${action} successfully`);
      setDecision({ requestId: '', action: 'accept', reason: '' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to process transfer request';
      notify.error('Transfer processing failed', message);
    },
  });

  const stats = {
    total: incomingTransfers?.length || 0,
    pending: incomingTransfers?.filter(r => r.status === 'PENDING').length || 0,
    accepted: incomingTransfers?.filter(r => r.status === 'ACCEPTED').length || 0,
    rejected: incomingTransfers?.filter(r => r.status === 'REJECTED').length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-red-50/40">
      {isLoading || decisionMutation.isPending ? <FullPageLoader label="Loading transfers..." /> : null}
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-pink-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl text-center">
          <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            Transfer Management
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Incoming Transfer Requests
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-orange-100">
            Review and manage student transfer requests from other schools. Accept or reject applications with detailed reasoning.
          </p>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 right-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Requests</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100">Pending</p>
                <p className="text-3xl font-bold">{stats.pending}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Accepted</p>
                <p className="text-3xl font-bold">{stats.accepted}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100">Rejected</p>
                <p className="text-3xl font-bold">{stats.rejected}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Requests Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {incomingTransfers?.map((request) => (
            <div
              key={request.id}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200 transition-all hover:shadow-xl hover:scale-105"
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  request.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : request.status === 'ACCEPTED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  <span className={`mr-1.5 h-2 w-2 rounded-full ${
                    request.status === 'PENDING'
                      ? 'bg-amber-400'
                      : request.status === 'ACCEPTED'
                      ? 'bg-emerald-400'
                      : 'bg-red-400'
                  }`}></span>
                  {request.status}
                </span>
              </div>

              {/* Student Info */}
              <div className="mb-4">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-2xl font-bold text-white">
                  {request.student.firstName.charAt(0)}{request.student.lastName.charAt(0)}
                </div>
                
                <h3 className="text-lg font-bold text-gray-900">
                  {request.student.firstName} {request.student.lastName}
                </h3>
                
                <p className="text-sm text-gray-600">Admission: {request.student.admissionNo}</p>
              </div>

              {/* Transfer Details */}
              <div className="mb-4 space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">From School</p>
                  <p className="text-sm font-medium text-gray-700">
                    {request.fromSchool.name}
                  </p>
                  <p className="text-xs text-gray-500">({request.fromSchool.code})</p>
                </div>
                
                {request.reason && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reason</p>
                    <p className="text-sm text-gray-700">{request.reason}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {request.status === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setDecision({ requestId: request.id, action: 'accept', reason: '' })}
                    className="flex-1 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-200"
                  >
                    Accept
                  </button>
                  
                  <button
                    onClick={() => setDecision({ requestId: request.id, action: 'reject', reason: '' })}
                    className="flex-1 rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-200"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {incomingTransfers?.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-lg">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No transfer requests</h3>
            <p className="text-gray-600">
              There are currently no incoming transfer requests to review.
            </p>
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {decision.requestId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {decision.action === 'accept' ? 'Accept Transfer Request' : 'Reject Transfer Request'}
            </h3>
            <p className="text-gray-600 mb-6">
              {decision.action === 'accept' 
                ? 'Provide an optional reason for accepting this transfer request.'
                : 'Please provide a reason for rejecting this transfer request.'
              }
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason {decision.action === 'reject' ? '(Required)' : '(Optional)'}
              </label>
              <textarea
                value={decision.reason}
                onChange={(e) => setDecision({ ...decision, reason: e.target.value })}
                placeholder={decision.action === 'accept' 
                  ? 'Enter reason for acceptance (optional)'
                  : 'Enter reason for rejection'
                }
                rows={3}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={() => setDecision({ requestId: '', action: 'accept', reason: '' })}
              >
                Cancel
              </button>
              <button
                className={`rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl disabled:opacity-50 ${
                  decision.action === 'accept'
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700'
                    : 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700'
                }`}
                onClick={() => decisionMutation.mutate()}
                disabled={decisionMutation.isPending || (decision.action === 'reject' && !decision.reason.trim())}
              >
                {decisionMutation.isPending ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  `${decision.action === 'accept' ? 'Accept' : 'Reject'} Request`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
