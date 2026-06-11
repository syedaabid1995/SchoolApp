'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { deleteStaff, listStaff, type Staff } from '../../../services/staff.service';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];
const pageSizeOptions = [10, 20, 50];

type IconName = 'eye' | 'edit' | 'trash' | 'left' | 'right';

const iconPaths: Record<IconName, string> = {
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm12-15 4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 16h10l1-16M9 7V4h6v3',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 6l6 6-6 6',
};

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={iconPaths[name]} />
    </svg>
  );
}

function ActionLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
    >
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </Link>
  );
}

function ActionButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
    >
      <Icon name={icon} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

const formatMoney = (value?: string | number | null) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value ?? 0));

const employeeName = (staff: Staff) => staff.fullName ?? `${staff.firstName} ${staff.lastName}`.trim();

const roleClass = (role?: string | null) => {
  const key = String(role ?? '').toUpperCase();
  if (key === 'TEACHER') return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
  if (key === 'ACCOUNTANT') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (key === 'LIBRARIAN') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (key === 'SCHOOL_ADMIN') return 'bg-slate-900 text-white ring-slate-900';
  return 'bg-violet-50 text-violet-700 ring-violet-100';
};

const exportRows = (rows: Staff[], format: 'csv' | 'xls') => {
  const headers = ['Staff No', 'Name', 'Login Role', 'Department', 'Designation', 'Salary', 'Mobile', 'Email'];
  const lines = rows.map((staff) => [
    staff.employeeNo ?? '',
    employeeName(staff),
    staff.role ?? staff.roleName ?? '',
    staff.department?.name ?? '',
    staff.designation?.name ?? '',
    staff.payrollInfo?.basicSalary ?? '',
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewStaff = hasPermission('staff.view');
  const canCreateStaff = hasPermission('staff.create');
  const canEditStaff = hasPermission('staff.edit');
  const canDeleteStaff = hasPermission('staff.delete');

  const staffQuery = useQuery({
    queryKey: ['staff', filters, page, limit],
    queryFn: () => listStaff({ page, limit, role: filters.role || undefined, staffId: filters.staffId || undefined, search: filters.search || undefined }),
    enabled: canViewStaff,
  });

  const rows = useMemo(() => staffQuery.data?.items ?? [], [staffQuery.data]);
  const pages = Math.max(1, staffQuery.data?.pages ?? 1);
  const total = staffQuery.data?.total ?? 0;
  const showingFrom = total ? (page - 1) * limit + 1 : 0;
  const showingTo = total ? Math.min(total, (page - 1) * limit + rows.length) : 0;

  useEffect(() => {
    if (staffQuery.data && page > pages) setPage(pages);
  }, [staffQuery.data, page, pages]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const visiblePages = useMemo(() => {
    const maxButtons = 5;
    const start = Math.max(1, Math.min(page - 2, pages - maxButtons + 1));
    const end = Math.min(pages, start + maxButtons - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pages]);

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: () => {
      notify.success('Staff deleted', 'Staff profile was removed.');
      if (rows.length === 1 && page > 1) setPage((current) => current - 1);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error: any) => notify.error('Delete failed', error?.response?.data?.error?.message ?? 'Unable to delete staff.'),
  });

  const stats = useMemo(() => {
    const roleCounts = rows.reduce<Record<string, number>>((sum, staff) => {
      const key = String(staff.role ?? staff.roleName ?? 'STAFF');
      sum[key] = (sum[key] ?? 0) + 1;
      return sum;
    }, {});
    const monthlySalary = rows.reduce((sum, staff) => sum + Number(staff.payrollInfo?.basicSalary ?? 0), 0);
    const payrollReady = rows.filter((staff) => Number(staff.payrollInfo?.basicSalary ?? 0) > 0).length;
    return { roleCounts, monthlySalary, payrollReady };
  }, [rows]);

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking staff access..." />;
  if (!canViewStaff) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Staff directory is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-8">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <PageHeader
          title="Employee List"
          subtitle="Manage employee profiles, payroll readiness, documents, and staff login roles."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees' }]}
          actions={canCreateStaff ? <Link href="/dashboard/staff/add?type=teacher" className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)]">Add Teacher</Link> : null}
        />

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4 lg:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Employees</h2>
                <p className="mt-1 text-sm text-slate-500">Showing {showingFrom} to {showingTo} of {total} employees.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => staffQuery.refetch()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Refresh</button>
                <button onClick={() => exportRows(rows, 'csv')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">CSV</button>
                <button onClick={() => exportRows(rows, 'xls')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Excel</button>
                <button onClick={() => window.print()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Print</button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[170px_170px_minmax(220px,1fr)_130px]">
              <select value={filters.role} onChange={(event) => updateFilter('role', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="">All Roles</option>
                {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
              </select>
              <input value={filters.staffId} onChange={(event) => updateFilter('staffId', event.target.value)} placeholder="Employee No" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search name, mobile, department, designation, email" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select
                value={limit}
                onChange={(event) => {
                  setPage(1);
                  setLimit(Number(event.target.value));
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size} / page</option>)}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{stats.payrollReady} payroll-ready</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{formatMoney(stats.monthlySalary)} page salary</span>
              {Object.entries(stats.roleCounts).map(([role, count]) => (
                <span key={role} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{role.replace('_', ' ')} {count}</span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Salary</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="animate-pulse"><td colSpan={7} className="px-4 py-4"><div className="h-10 rounded bg-slate-100" /></td></tr>
                  ))
                ) : rows.length ? (
                  rows.map((staff) => {
                    const name = employeeName(staff);
                    const role = String(staff.role ?? staff.roleName ?? '');
                    return (
                      <tr key={staff.id} className="align-middle transition hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="flex min-w-[260px] items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                              {name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-black text-slate-950">{name}</p>
                              <p className="truncate text-xs font-semibold text-slate-500">{staff.employeeNo ?? '-'} · {staff.user?.email ?? '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${roleClass(role)}`}>{role.replace('_', ' ') || '-'}</span>
                        </td>
                        <td className="px-4 py-3">{staff.department?.name ?? '-'}</td>
                        <td className="px-4 py-3">{staff.designation?.name ?? '-'}</td>
                        <td className="px-4 py-3 font-semibold">{staff.payrollInfo?.basicSalary ? formatMoney(staff.payrollInfo.basicSalary) : '-'}</td>
                        <td className="px-4 py-3">{staff.phone ?? '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <ActionLink href={`/dashboard/staff/${staff.id}`} icon="eye" label="View employee" />
                            {canEditStaff ? <ActionLink href={`/dashboard/staff/add?id=${staff.id}`} icon="edit" label="Edit employee" /> : null}
                            {canDeleteStaff ? <ActionButton icon="trash" label="Delete employee" onClick={() => window.confirm('Delete this employee record?') && deleteMutation.mutate(staff.id)} /> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No employees found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-500">Page {page} of {pages}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <Icon name="left" />
              </button>
              {visiblePages.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={`h-10 min-w-10 rounded-xl px-3 text-sm font-black ${item === page ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)] shadow-sm' : 'border border-slate-200 bg-white text-slate-700'}`}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pages, current + 1))}
                disabled={page >= pages}
                className="inline-grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <Icon name="right" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
