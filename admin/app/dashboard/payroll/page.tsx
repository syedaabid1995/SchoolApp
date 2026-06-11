'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import {
  generatePayroll,
  listPayroll,
  listStaff,
  payPayroll,
  type Staff,
} from '../../../services/staff.service';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];

type AmountRow = { title: string; amount: number };
type PayrollListRow = Awaited<ReturnType<typeof listPayroll>>[number];

const formatMoney = (value?: string | number | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
};

const staffName = (staff?: Staff | null) => (staff ? staff.fullName ?? `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim() : '-');

const statusBadge = (status?: string | null) => {
  const key = String(status ?? '').toUpperCase();
  if (key === 'PAID') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (key === 'GENERATED') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (key === 'NOT_GENERATED') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-rose-200 bg-rose-50 text-rose-700';
};

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

const exportRows = (rows: PayrollListRow[], format: 'csv' | 'xls') => {
  const headers = ['Staff no', 'Name', 'Role', 'Department', 'Designation', 'Mobile', 'Status', 'Net salary'];
  const body = rows.map((row) => [
    row.staff.employeeNo ?? row.staff.staffNo ?? '',
    staffName(row.staff),
    row.staff.role ?? row.staff.roleName ?? '',
    row.staff.department?.name ?? '',
    row.staff.designation?.name ?? '',
    row.staff.phone ?? '',
    row.status,
    row.payroll?.netSalary ?? '',
  ]);
  if (format === 'csv') {
    const csv = [headers, ...body].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'staff-payroll.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
  const html = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${body.map((line) => `<tr>${line.map((value) => `<td>${String(value).replace(/[<>&]/g, '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'staff-payroll.xls';
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function PayrollPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState({
    role: '',
    staffId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [selected, setSelected] = useState<PayrollListRow | null>(null);
  const [payForm, setPayForm] = useState({ method: 'Cash', reference: '', paidAt: new Date().toISOString().slice(0, 10) });
  const [form, setForm] = useState({
    basicSalary: 0,
    tax: 0,
    paymentMode: 'Bank Transfer',
    earnings: [{ title: 'Allowance', amount: 0 }] as AmountRow[],
    deductions: [{ title: 'Deduction', amount: 0 }] as AmountRow[],
  });

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewPayroll = hasPermission('payroll.view');
  const canGeneratePayroll = hasPermission('payroll.generate');
  const canPayPayroll = hasPermission('payroll.pay');
  const canViewPayrollReport = hasPermission('payroll.report');
  const staffQuery = useQuery({ queryKey: ['staff-options-payroll', criteria.role], queryFn: () => listStaff({ limit: 100, role: criteria.role || undefined }), enabled: canViewPayroll });
  const payrollQuery = useQuery({
    queryKey: ['staff-payroll', criteria],
    queryFn: () => listPayroll({ role: criteria.role || undefined, staffId: criteria.staffId || undefined, month: criteria.month, year: criteria.year }),
    enabled: canViewPayroll,
  });

  const rows = useMemo(() => payrollQuery.data ?? [], [payrollQuery.data]);
  const staffOptions = staffQuery.data?.items ?? [];
  const earningTotal = form.earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const deductionTotal = form.deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gross = Number(form.basicSalary || 0) + earningTotal;
  const net = Math.max(0, gross - deductionTotal - Number(form.tax || 0));

  const openGenerate = (row: PayrollListRow) => {
    setSelected(row);
    setForm({
      basicSalary: Number(row.payroll?.basicSalary ?? row.staff.payrollInfo?.basicSalary ?? 0),
      tax: Number(row.payroll?.tax ?? 0),
      paymentMode: row.payroll?.paymentMode ?? row.staff.payrollInfo?.paymentMode ?? 'Bank Transfer',
      earnings: row.payroll?.earningRows?.length ? row.payroll.earningRows.map((item) => ({ title: item.title, amount: Number(item.amount) })) : [{ title: 'Allowance', amount: 0 }],
      deductions: row.payroll?.deductionRows?.length ? row.payroll.deductionRows.map((item) => ({ title: item.title, amount: Number(item.amount) })) : [{ title: 'Deduction', amount: 0 }],
    });
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('Select staff first.');
      return generatePayroll({
        staffId: selected.staff.id,
        month: criteria.month,
        year: criteria.year,
        basicSalary: Number(form.basicSalary || 0),
        tax: Number(form.tax || 0),
        paymentMode: form.paymentMode,
        earnings: form.earnings.filter((item) => item.title.trim()).map((item) => ({ title: item.title.trim(), amount: Number(item.amount || 0) })),
        deductions: form.deductions.filter((item) => item.title.trim()).map((item) => ({ title: item.title.trim(), amount: Number(item.amount || 0) })),
      });
    },
    onSuccess: () => {
      notify.success('Payroll generated', 'Payslip was saved for the selected staff.');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
    },
    onError: (error: any) => notify.error('Unable to generate payroll', error?.response?.data?.error?.message ?? error.message ?? 'Please try again.'),
  });

  const payMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => payPayroll(id, payForm),
    onSuccess: () => {
      notify.success('Payment recorded', 'Payroll status was updated to paid.');
      queryClient.invalidateQueries({ queryKey: ['staff-payroll'] });
    },
    onError: (error: any) => notify.error('Unable to record payment', error?.response?.data?.error?.message ?? 'Please try again.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking payroll access..." />;
  if (!canViewPayroll) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Payroll is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Payroll"
          subtitle="Generate monthly payroll, calculate earnings and deductions, and record payments."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payroll' }]}
          actions={canViewPayrollReport ? <Link href="/dashboard/payroll/report" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Payroll Report</Link> : null}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
              <p className="text-sm text-slate-500">Search payroll by role, staff member, month, and year.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ShellButton onClick={() => payrollQuery.refetch()} disabled={payrollQuery.isFetching}>Refresh</ShellButton>
              <ShellButton onClick={() => exportRows(rows, 'csv')}>CSV</ShellButton>
              <ShellButton onClick={() => exportRows(rows, 'xls')}>Excel</ShellButton>
              <ShellButton onClick={() => window.print()}>PDF / Print</ShellButton>
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
            <h2 className="text-lg font-bold text-slate-950">Staff Payroll List</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{rows.length} records</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Staff no</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Mobile</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrollQuery.isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={8} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={row.staff.id}>
                      <td className="px-4 py-3 font-semibold">{row.staff.employeeNo ?? row.staff.staffNo ?? '-'}</td>
                      <td className="px-4 py-3">{staffName(row.staff)}</td>
                      <td className="px-4 py-3">{String(row.staff.role ?? row.staff.roleName ?? '').replace('_', ' ')}</td>
                      <td className="px-4 py-3">{row.staff.department?.name ?? '-'}</td>
                      <td className="px-4 py-3">{row.staff.designation?.name ?? '-'}</td>
                      <td className="px-4 py-3">{row.staff.phone ?? '-'}</td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge(row.status)}`}>{String(row.status).replace('_', ' ')}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          {canGeneratePayroll ? <button onClick={() => openGenerate(row)} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">{row.payroll ? 'Regenerate' : 'Generate Payroll'}</button> : null}
                          {row.payroll && row.payroll.status !== 'PAID' ? (
                            canPayPayroll ? <button onClick={() => window.confirm('Proceed to pay this payroll?') && payMutation.mutate({ id: row.payroll!.id })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Proceed To Pay</button> : null
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No staff payroll rows found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selected ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
            <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Generate Payroll</h2>
                  <p className="text-sm text-slate-500">{staffName(selected.staff)} - {criteria.month}/{criteria.year}</p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">Close</button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <input type="number" value={form.basicSalary} onChange={(event) => setForm({ ...form, basicSalary: Number(event.target.value) })} placeholder="Basic salary" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input type="number" value={form.tax} onChange={(event) => setForm({ ...form, tax: Number(event.target.value) })} placeholder="Tax" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input value={form.paymentMode} onChange={(event) => setForm({ ...form, paymentMode: event.target.value })} placeholder="Payment mode" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Net salary</p>
                  <p className="font-bold text-slate-950">{formatMoney(net)}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-950">Earnings</h3>
                    <button onClick={() => setForm({ ...form, earnings: [...form.earnings, { title: '', amount: 0 }] })} className="text-sm font-bold text-violet-700">Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.earnings.map((item, index) => (
                      <div key={index} className="grid grid-cols-[1fr_120px_40px] gap-2">
                        <input value={item.title} onChange={(event) => setForm({ ...form, earnings: form.earnings.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <input type="number" value={item.amount} onChange={(event) => setForm({ ...form, earnings: form.earnings.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Number(event.target.value) } : row) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <button onClick={() => setForm({ ...form, earnings: form.earnings.filter((_, rowIndex) => rowIndex !== index) })} className="rounded-xl border text-sm font-bold">X</button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-950">Deductions</h3>
                    <button onClick={() => setForm({ ...form, deductions: [...form.deductions, { title: '', amount: 0 }] })} className="text-sm font-bold text-violet-700">Add</button>
                  </div>
                  <div className="space-y-2">
                    {form.deductions.map((item, index) => (
                      <div key={index} className="grid grid-cols-[1fr_120px_40px] gap-2">
                        <input value={item.title} onChange={(event) => setForm({ ...form, deductions: form.deductions.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <input type="number" value={item.amount} onChange={(event) => setForm({ ...form, deductions: form.deductions.map((row, rowIndex) => rowIndex === index ? { ...row, amount: Number(event.target.value) } : row) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        <button onClick={() => setForm({ ...form, deductions: form.deductions.filter((_, rowIndex) => rowIndex !== index) })} className="rounded-xl border text-sm font-bold">X</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-5">
                <div><p className="text-xs font-bold uppercase text-slate-500">Basic</p><p className="font-bold">{formatMoney(form.basicSalary)}</p></div>
                <div><p className="text-xs font-bold uppercase text-slate-500">Earnings</p><p className="font-bold">{formatMoney(earningTotal)}</p></div>
                <div><p className="text-xs font-bold uppercase text-slate-500">Deductions</p><p className="font-bold">{formatMoney(deductionTotal)}</p></div>
                <div><p className="text-xs font-bold uppercase text-slate-500">Gross</p><p className="font-bold">{formatMoney(gross)}</p></div>
                <div><p className="text-xs font-bold uppercase text-slate-500">Net</p><p className="font-bold">{formatMoney(net)}</p></div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <ShellButton onClick={() => setSelected(null)}>Cancel</ShellButton>
                <ShellButton active onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>{generateMutation.isPending ? 'Saving...' : 'Save Payroll'}</ShellButton>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
