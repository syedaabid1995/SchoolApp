'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listSchools,
  createSchool,
  activateSchool,
  suspendSchool,
  deleteSchool,
} from '../../../services/school.service';

export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ name: '', code: '', subscriptionPlan: 'STANDARD' });

  const { data, isLoading } = useQuery({
    queryKey: ['schools', query],
    queryFn: () => listSchools({ query }),
  });

  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: () => {
      setForm({ name: '', code: '', subscriptionPlan: 'STANDARD' });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'activate' | 'suspend' | 'delete' }) => {
      if (payload.action === 'activate') return activateSchool(payload.id);
      if (payload.action === 'suspend') return suspendSchool(payload.id);
      return deleteSchool(payload.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schools'] }),
  });

  const rows = useMemo(() => data?.items ?? [], [data]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Schools</h1>
        <p className="text-sm text-slate">Manage tenant lifecycle, status, and subscription visibility.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create School</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="School name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="School code"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={form.subscriptionPlan}
            onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}
            placeholder="Plan"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createMutation.mutate(form)}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create School'}
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">School Directory</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search schools"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Plan</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No schools found.
                  </td>
                </tr>
              ) : (
                rows.map((school) => (
                  <tr key={school.id} className="border-t border-slate/10">
                    <td className="py-3">{school.name}</td>
                    <td>{school.code}</td>
                    <td>{school.status}</td>
                    <td>{school.subscriptionPlan}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-lg border border-slate/20 px-3 py-1 text-xs"
                          onClick={() =>
                            actionMutation.mutate({
                              id: school.id,
                              action: school.status === 'ACTIVE' ? 'suspend' : 'activate',
                            })
                          }
                        >
                          {school.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600"
                          onClick={() => actionMutation.mutate({ id: school.id, action: 'delete' })}
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
