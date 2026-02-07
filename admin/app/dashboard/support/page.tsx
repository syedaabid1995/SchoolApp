'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTickets, createTicket, updateTicket, type SupportTicket } from '../../../services/support.service';

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM' });
  const [formError, setFormError] = useState('');

  const { data: tickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: listTickets,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: () => {
      setForm({ subject: '', description: '', priority: 'MEDIUM' });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateTicket(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const stats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === 'OPEN').length || 0,
    inProgress: tickets?.filter(t => t.status === 'IN_PROGRESS').length || 0,
    resolved: tickets?.filter(t => t.status === 'RESOLVED').length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/40">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Support Center
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                Help & Support
              </h1>
              <p className="max-w-2xl text-lg text-blue-100">
                Get assistance with technical issues, track support tickets, and access help resources.
              </p>
            </div>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Tickets</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100">Open</p>
                <p className="text-3xl font-bold">{stats.open}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">In Progress</p>
                <p className="text-3xl font-bold">{stats.inProgress}</p>
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
                <p className="text-emerald-100">Resolved</p>
                <p className="text-3xl font-bold">{stats.resolved}</p>
              </div>
              <div className="rounded-full bg-white/20 p-3">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Create Ticket Section */}
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Create Support Ticket</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Subject</label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of the issue"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description of the problem"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button
              className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-blue-700 hover:to-cyan-700 hover:shadow-xl disabled:opacity-50"
              onClick={() => {
                let error = '';
                if (!form.subject.trim()) error = 'Subject is required.';
                else if (!form.description.trim()) error = 'Description is required.';
                setFormError(error);
                if (error) return;
                createMutation.mutate(form);
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <div className="flex items-center">
                  <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </div>
              ) : (
                <div className="flex items-center">
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Ticket
                </div>
              )}
            </button>
            {formError && (
              <div className="flex items-center text-sm text-red-600">
                <svg className="mr-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {formError}
              </div>
            )}
          </div>
        </section>

        {/* Tickets Table */}
        <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Support Tickets</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ticket</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Priority</th>
                  <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {tickets?.map((ticket: SupportTicket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{ticket.subject}</div>
                          <div className="text-sm text-gray-500">{ticket.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        ticket.status === 'RESOLVED' 
                          ? 'bg-green-100 text-green-800' 
                          : ticket.status === 'IN_PROGRESS'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        ticket.priority === 'HIGH' 
                          ? 'bg-red-100 text-red-800' 
                          : ticket.priority === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      {ticket.status !== 'RESOLVED' && (
                        <button
                          className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                          onClick={() => updateMutation.mutate({ id: ticket.id, status: 'RESOLVED' })}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!tickets?.length && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No support tickets</h3>
                        <p className="mt-1 text-sm text-gray-500">Create your first support ticket above.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
