'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listTickets, createTicket, updateTicket, type SupportTicket } from '../../../services/support.service';

export default function SupportPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM' });

  const { data: tickets } = useQuery({ queryKey: ['tickets'], queryFn: listTickets });

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Support</h1>
        <p className="text-sm text-slate">Track tickets, SLA status, and escalations.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create Ticket</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Subject"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Description"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createMutation.mutate(form)}
          disabled={createMutation.isPending}
        >
          Create Ticket
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Tickets</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Subject</th>
                <th>Status</th>
                <th>Priority</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets?.map((ticket: SupportTicket) => (
                <tr key={ticket.id} className="border-t border-slate/10">
                  <td className="py-3">{ticket.subject}</td>
                  <td>{ticket.status}</td>
                  <td>{ticket.priority}</td>
                  <td className="text-right">
                    <button
                      className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                      onClick={() => updateMutation.mutate({ id: ticket.id, status: 'RESOLVED' })}
                    >
                      Mark Resolved
                    </button>
                  </td>
                </tr>
              ))}
              {!tickets?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No tickets found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
