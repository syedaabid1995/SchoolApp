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
import { useNotify } from '../../../components/NotificationProvider';

export default function SchoolsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    subscriptionPlan: 'STANDARD',
    adminEmail: '',
  });
  const [createdAdmin, setCreatedAdmin] = useState<{ email: string; tempPassword: string } | null>(null);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['schools', query],
    queryFn: () => listSchools({ query }),
  });

  const createMutation = useMutation({
    mutationFn: createSchool,
    onSuccess: (result) => {
      setForm({ name: '', code: '', subscriptionPlan: 'STANDARD', adminEmail: '' });
      if (result.adminUser && result.tempPassword) {
        setCreatedAdmin({ email: result.adminUser.email, tempPassword: result.tempPassword });
        notify.success('School created successfully!', `${form.name} has been created with admin account`);
      } else {
        setCreatedAdmin(null);
        notify.success('School created!', `${form.name} has been created successfully`);
      }
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create school';
      notify.error('School creation failed', message);
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'activate' | 'suspend' | 'delete' }) => {
      const actionText = payload.action === 'activate' ? 'Activating' : payload.action === 'suspend' ? 'Suspending' : 'Deleting';
      notify.info(`${actionText} school...`, 'Please wait while we process your request');
      
      if (payload.action === 'activate') return activateSchool(payload.id);
      if (payload.action === 'suspend') return suspendSchool(payload.id);
      return deleteSchool(payload.id);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      const actionText = variables.action === 'activate' ? 'activated' : variables.action === 'suspend' ? 'suspended' : 'deleted';
      notify.success(`School ${actionText}!`, `School has been ${actionText} successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to process school action';
      notify.error('Action failed', message);
    },
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
        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
          <select
            value={form.subscriptionPlan}
            onChange={(e) =>
              setForm({
                ...form,
                subscriptionPlan: e.target.value as 'STARTER' | 'STANDARD' | 'PREMIUM',
              })
            }
            className="rounded-lg border border-slate/20 bg-white px-3 py-2 text-sm"
          >
            <option value="STARTER">Starter</option>
            <option value="STANDARD">Standard</option>
            <option value="PREMIUM">Premium</option>
          </select>
          <input
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
            placeholder="Admin email (optional)"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            const trimmedName = form.name.trim();
            const trimmedCode = form.code.trim();
            const trimmedEmail = form.adminEmail.trim();
            let error = '';
            if (!trimmedName) error = 'School name is required.';
            else if (!trimmedCode) error = 'School code is required.';
            else if (!trimmedEmail) error = 'Admin email is required.';
            else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(trimmedEmail)) {
              error = 'Enter a valid admin email.';
            }
            setFormError(error);
            if (error) {
              notify.error('Validation error', error);
              return;
            }
            notify.info('Creating school...', 'Please wait while we set up your school');
            createMutation.mutate({
              ...form,
              name: trimmedName,
              code: trimmedCode,
              adminEmail: trimmedEmail,
            });
          }}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create School'}
        </button>
        {formError ? <p className="mt-2 text-sm font-semibold text-rose-600">{formError}</p> : null}
        {createdAdmin ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">School admin created</div>
            <div className="mt-1">Email: {createdAdmin.email}</div>
            <div className="mt-1">Temporary password: {createdAdmin.tempPassword}</div>
            <div className="mt-2 text-xs text-emerald-700">
              Share this once. It will not be shown again.
            </div>
          </div>
        ) : null}
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
                <th>Admin Email</th>
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
                    <td>{school.adminEmail ?? '—'}</td>
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
