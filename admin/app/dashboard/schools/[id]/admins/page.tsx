'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createSchoolAdmin, listSchoolAdmins, updateSchoolAdminStatus } from '../../../../../services/school.service';
import { useNotify } from '../../../../../components/NotificationProvider';
import FullPageLoader from '../../../../../components/FullPageLoader';

export default function SchoolAdminsPage() {
  const params = useParams<{ id: string }>();
  const schoolId = params?.id ?? '';
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [adminEmail, setAdminEmail] = useState('');
  const [createdAdmin, setCreatedAdmin] = useState<{
    email: string;
    tempPassword: string;
    manualShareRequired?: boolean;
    manualShareUrl?: string | null;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['school-admins', schoolId],
    queryFn: () => listSchoolAdmins(schoolId),
    enabled: Boolean(schoolId),
  });

  const addAdminMutation = useMutation({
    mutationFn: () => createSchoolAdmin(schoolId, adminEmail.trim()),
    onSuccess: (result) => {
      setCreatedAdmin({
        email: result.adminUser.email,
        tempPassword: result.tempPassword,
        manualShareRequired: result.manualShareRequired,
        manualShareUrl: result.manualShareUrl,
      });
      setAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['school-admins', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      notify.success('School admin added', `Added admin ${result.adminUser.email}`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to add school admin';
      notify.error('Add admin failed', message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { adminId: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      updateSchoolAdminStatus(schoolId, payload.adminId, payload.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-admins', schoolId] });
      notify.success('Status updated', 'School admin status updated');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to update status';
      notify.error('Status update failed', message);
    },
  });

  return (
    <div className="space-y-6">
      {isLoading || addAdminMutation.isPending || statusMutation.isPending ? (
        <FullPageLoader label="Loading admins..." />
      ) : null}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">School Admins</h1>
          <p className="text-sm text-slate">
            {data?.school ? `${data.school.name} (${data.school.code})` : 'Manage multiple admins for this school.'}
          </p>
        </div>
        <Link href="/dashboard/schools" className="rounded-lg border border-slate/20 px-3 py-2 text-sm font-semibold">
          Back to Schools
        </Link>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Add School Admin</h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="Admin email"
            className="w-full max-w-sm rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <button
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!adminEmail.trim() || addAdminMutation.isPending}
            onClick={() => addAdminMutation.mutate()}
          >
            {addAdminMutation.isPending ? 'Adding...' : 'Add Admin'}
          </button>
        </div>
        {createdAdmin ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">School admin created</div>
            <div className="mt-1">Email: {createdAdmin.email}</div>
            <div className="mt-1">Temporary password: {createdAdmin.tempPassword}</div>
            {createdAdmin.manualShareUrl ? (
              <a
                href={createdAdmin.manualShareUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-800"
              >
                Share via WhatsApp
              </a>
            ) : null}
            <div className="mt-2 text-xs text-emerald-700">Share this once. It will not be shown again.</div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Admins List</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Email</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {!data?.admins?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate">
                    No school admins found.
                  </td>
                </tr>
              ) : (
                data.admins.map((admin) => (
                  <tr key={admin.id} className="border-t border-slate/10">
                    <td className="py-3">{admin.email}</td>
                    <td>
                      <button
                        type="button"
                        aria-pressed={admin.status === 'ACTIVE'}
                        className={`flex h-6 w-10 items-center rounded-full p-0.5 transition ${
                          admin.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                        onClick={() =>
                          statusMutation.mutate({
                            adminId: admin.id,
                            status: admin.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-white shadow transition ${
                            admin.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                    <td>{admin.createdBy ?? 'System'}</td>
                    <td>{new Date(admin.createdAt).toLocaleString()}</td>
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
