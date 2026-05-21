'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { deleteStaff, listStaff, type Staff } from '../../../services/staff.service';
import { SchoolAdminOnly } from './_components/SchoolAdminOnly';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

const exportRows = (rows: Staff[], format: 'csv' | 'xls') => {
  const headers = ['Staff No', 'Name', 'Role', 'Department', 'Designation', 'Mobile', 'Email'];
  const lines = rows.map((staff) => [
    staff.employeeNo ?? '',
    staff.fullName ?? `${staff.firstName} ${staff.lastName}`,
    staff.role ?? staff.roleName ?? '',
    staff.department?.name ?? '',
    staff.designation?.name ?? '',
    staff.phone ?? '',
    staff.user?.email ?? '',
  ]);
  if (format === 'csv') {
    const csv = [headers, ...lines].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'staff-directory.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const html = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${lines
    .map((row) => `<tr>${row.map((value) => `<td>${String(value).replace(/[<>&]/g, '')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'staff-directory.xls';
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function StaffDirectoryPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ role: '', staffId: '', search: '' });
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';

  const staffQuery = useQuery({
    queryKey: ['staff', filters],
    queryFn: () => listStaff({ limit: 100, role: filters.role || undefined, staffId: filters.staffId || undefined, search: filters.search || undefined }),
    enabled: isSchoolAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      notify.success('Staff deleted', 'Staff profile was removed.');
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete staff.'),
  });

  const rows = useMemo(() => staffQuery.data?.items ?? [], [staffQuery.data]);

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="staff management" />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Staff Directory"
          subtitle="Manage school staff profiles, roles, departments, payroll information, documents, and timelines."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff' }]}
          actions={<Link href="/dashboard/staff/add" className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Add Staff</Link>}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <p className="text-sm text-slate-500">Search by role, staff number, name, mobile, or email.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => staffQuery.refetch()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Refresh</button>
              <button onClick={() => exportRows(rows, 'csv')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">CSV</button>
              <button onClick={() => exportRows(rows, 'xls')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Excel</button>
              <button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">PDF / Print</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Roles</option>
              {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
            </select>
            <input value={filters.staffId} onChange={(event) => setFilters({ ...filters, staffId: event.target.value })} placeholder="Staff ID" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Quick search" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Staff List</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{rows.length} records</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Staff No</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse"><td colSpan={8} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>
                  ))
                ) : rows.length ? (
                  rows.map((staff) => (
                    <tr key={staff.id}>
                      <td className="px-4 py-3 font-semibold">{staff.employeeNo ?? '-'}</td>
                      <td className="px-4 py-3">{staff.fullName ?? `${staff.firstName} ${staff.lastName}`}</td>
                      <td className="px-4 py-3">{String(staff.role ?? staff.roleName ?? '').replace('_', ' ')}</td>
                      <td className="px-4 py-3">{staff.department?.name ?? '-'}</td>
                      <td className="px-4 py-3">{staff.designation?.name ?? '-'}</td>
                      <td className="px-4 py-3">{staff.phone ?? '-'}</td>
                      <td className="px-4 py-3">{staff.user?.email ?? '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Link href={`/dashboard/staff/${staff.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">View</Link>
                          <Link href={`/dashboard/staff/add?id=${staff.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">Edit</Link>
                          <button onClick={() => window.confirm('Delete this staff record?') && deleteMutation.mutate(staff.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No staff found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
