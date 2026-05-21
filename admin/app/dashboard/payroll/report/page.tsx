'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { getSession } from '../../../../services/auth.service';
import { getPayrollReport, listStaff, type Payroll, type Staff } from '../../../../services/staff.service';
import { SchoolAdminOnly } from '../../staff/_components/SchoolAdminOnly';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

const formatMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
};

const staffName = (staff?: Staff | null) => (staff ? staff.fullName ?? `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() : '-');

const ShellButton = ({ children, onClick, disabled, active }: { children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50 ${active ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]' : 'border border-slate-200 bg-white text-slate-700'}`}
  >
    {children}
  </button>
);

const exportRows = (rows: Array<Payroll & { staff: Staff }>, totals: Record<string, number>, format: 'csv' | 'xls') => {
  const headers = ['Staff name', 'Role', 'Description', 'Month-Year', 'Payslip #', 'Basic salary', 'Earnings', 'Deductions', 'Gross salary', 'Tax', 'Net salary'];
  const body = rows.map((row) => [
    staffName(row.staff),
    row.staff.role ?? row.staff.roleName ?? '',
    row.staff.designation?.name ?? '',
    `${row.month}/${row.year}`,
    row.payslipNo,
    row.basicSalary,
    row.earnings,
    row.deductions,
    row.grossSalary,
    row.tax,
    row.netSalary,
  ]);
  const totalRow = ['Grand Total', '', '', '', '', totals.basicSalary ?? 0, totals.earnings ?? 0, totals.deductions ?? 0, totals.grossSalary ?? 0, totals.tax ?? 0, totals.netSalary ?? 0];
  if (format === 'csv') {
    const csv = [headers, ...body, totalRow].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'payroll-report.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const html = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${[...body, totalRow].map((line) => `<tr>${line.map((value) => `<td>${String(value).replace(/[<>&]/g, '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'payroll-report.xls';
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function PayrollReportPage() {
  const [criteria, setCriteria] = useState({
    role: '',
    staffId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const staffQuery = useQuery({ queryKey: ['staff-options-payroll-report', criteria.role], queryFn: () => listStaff({ limit: 100, role: criteria.role || undefined }), enabled: isSchoolAdmin });
  const reportQuery = useQuery({
    queryKey: ['payroll-report', criteria],
    queryFn: () => getPayrollReport({ role: criteria.role || undefined, staffId: criteria.staffId || undefined, month: criteria.month, year: criteria.year }),
    enabled: false,
  });

  const rows = useMemo(() => reportQuery.data?.items ?? [], [reportQuery.data]);
  const totals = reportQuery.data?.totals ?? { basicSalary: 0, earnings: 0, deductions: 0, grossSalary: 0, tax: 0, netSalary: 0 };
  const staffOptions = staffQuery.data?.items ?? [];

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking payroll report access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="payroll report" />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Payroll Report"
          subtitle="Inspect generated payroll totals by role, staff member, month, and year."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payroll', href: '/dashboard/payroll' }, { label: 'Report' }]}
          actions={<ShellButton onClick={() => window.print()}>PDF / Print</ShellButton>}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <p className="text-sm text-slate-500">Choose filters and run the report.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShellButton active onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>Search</ShellButton>
              <ShellButton onClick={() => exportRows(rows, totals, 'csv')}>CSV</ShellButton>
              <ShellButton onClick={() => exportRows(rows, totals, 'xls')}>Excel</ShellButton>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <select value={criteria.role} onChange={(event) => setCriteria({ ...criteria, role: event.target.value, staffId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Roles</option>
              {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
            </select>
            <select value={criteria.staffId} onChange={(event) => setCriteria({ ...criteria, staffId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Staff</option>
              {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staffName(staff)} ({staff.employeeNo ?? '-'})</option>)}
            </select>
            <select value={criteria.month} onChange={(event) => setCriteria({ ...criteria, month: Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {Array.from({ length: 12 }).map((_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' })}</option>)}
            </select>
            <input type="number" value={criteria.year} onChange={(event) => setCriteria({ ...criteria, year: Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Report</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{rows.length} payslips</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Staff name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Month-Year</th>
                  <th className="px-4 py-3">Payslip #</th>
                  <th className="px-4 py-3">Basic salary</th>
                  <th className="px-4 py-3">Earnings</th>
                  <th className="px-4 py-3">Deductions</th>
                  <th className="px-4 py-3">Gross salary</th>
                  <th className="px-4 py-3">Tax</th>
                  <th className="px-4 py-3">Net salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportQuery.isFetching ? (
                  Array.from({ length: 6 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={11} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                ) : rows.length ? (
                  <>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold">{staffName(row.staff)}</td>
                        <td className="px-4 py-3">{String(row.staff.role ?? row.staff.roleName ?? '').replace('_', ' ')}</td>
                        <td className="px-4 py-3">{row.staff.designation?.name ?? '-'}</td>
                        <td className="px-4 py-3">{row.month}/{row.year}</td>
                        <td className="px-4 py-3">{row.payslipNo}</td>
                        <td className="px-4 py-3">{formatMoney(row.basicSalary)}</td>
                        <td className="px-4 py-3">{formatMoney(row.earnings)}</td>
                        <td className="px-4 py-3">{formatMoney(row.deductions)}</td>
                        <td className="px-4 py-3">{formatMoney(row.grossSalary)}</td>
                        <td className="px-4 py-3">{formatMoney(row.tax)}</td>
                        <td className="px-4 py-3 font-bold">{formatMoney(row.netSalary)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold text-slate-950">
                      <td className="px-4 py-3" colSpan={5}>Grand Total</td>
                      <td className="px-4 py-3">{formatMoney(totals.basicSalary)}</td>
                      <td className="px-4 py-3">{formatMoney(totals.earnings)}</td>
                      <td className="px-4 py-3">{formatMoney(totals.deductions)}</td>
                      <td className="px-4 py-3">{formatMoney(totals.grossSalary)}</td>
                      <td className="px-4 py-3">{formatMoney(totals.tax)}</td>
                      <td className="px-4 py-3">{formatMoney(totals.netSalary)}</td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">No payroll report found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
