'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listSchools } from '../../../../services/school.service';
import {
  approveExpenseChangeRequest,
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  exportExpenses,
  getExpenseMetadata,
  listExpenseChangeRequests,
  listExpenses,
  rejectExpenseChangeRequest,
  updateExpense,
  updateExpenseCategory,
  type Expense,
  type ExpenseCategory,
  type ExpensePaymentMode,
} from '../../../../services/expense.service';

const paymentLabels: Record<ExpensePaymentMode, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CHEQUE: 'Cheque',
  UPI: 'UPI',
  CARD: 'Card',
  OTHER: 'Other',
};

const inputClass = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50';
const buttonClass = 'inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryButtonClass = 'inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50';

type ExpenseFormState = {
  id?: string;
  categoryId: string;
  title: string;
  amount: string;
  expenseDate: string;
  paymentMode: ExpensePaymentMode;
  paidTo: string;
  referenceNumber: string;
  description: string;
  reason: string;
  receipt: File | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): ExpenseFormState => ({
  categoryId: '',
  title: '',
  amount: '',
  expenseDate: today(),
  paymentMode: 'CASH',
  paidTo: '',
  referenceNumber: '',
  description: '',
  reason: '',
  receipt: null,
});

const formatMoney = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0));

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default function ExpensesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ search: '', categoryId: '', paymentMode: '' as ExpensePaymentMode | '', dateFrom: '', dateTo: '' });
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', description: '', status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' });

  const sessionQuery = useQuery({ queryKey: ['session'], queryFn: getSession });
  const session = sessionQuery.data;
  const isPlatform = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = useMemo(() => new Set(session?.permissionCodes ?? []), [session?.permissionCodes]);
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.has(code);
  const activeSchoolId = isPlatform ? selectedSchoolId || undefined : session?.schoolId || undefined;

  const schoolsQuery = useQuery({
    queryKey: ['expense-schools'],
    queryFn: () => listSchools({ page: 1, limit: 200, status: 'ACTIVE' }),
    enabled: isPlatform,
  });

  const metadataQuery = useQuery({
    queryKey: ['expense-metadata', activeSchoolId],
    queryFn: () => getExpenseMetadata(activeSchoolId),
    enabled: !isPlatform || Boolean(activeSchoolId),
  });

  const expensesQuery = useQuery({
    queryKey: ['expenses', activeSchoolId, filters],
    queryFn: () => listExpenses({ schoolId: activeSchoolId, ...filters, page: 1, limit: 50 }),
    enabled: Boolean(session),
  });

  const requestsQuery = useQuery({
    queryKey: ['expense-change-requests', activeSchoolId],
    queryFn: () => listExpenseChangeRequests({ schoolId: activeSchoolId, status: 'PENDING' }),
    enabled: Boolean(activeSchoolId && hasPermission('expenses.approve')),
  });

  const categories = metadataQuery.data?.categories ?? [];
  const paymentModes = metadataQuery.data?.paymentModes ?? ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'];
  const expenses = expensesQuery.data?.items ?? [];
  const summary = expensesQuery.data?.summary;

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['expense-metadata'] }),
      queryClient.invalidateQueries({ queryKey: ['expense-change-requests'] }),
    ]);
  };

  const saveExpenseMutation = useMutation({
    mutationFn: () => {
      if (!form.categoryId || !form.title.trim() || !form.amount) throw new Error('Category, title, and amount are required.');
      const payload = {
        schoolId: activeSchoolId,
        categoryId: form.categoryId,
        title: form.title.trim(),
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        paymentMode: form.paymentMode,
        paidTo: form.paidTo || null,
        referenceNumber: form.referenceNumber || null,
        description: form.description || null,
        reason: form.reason || null,
        receipt: form.receipt,
      };
      return form.id ? updateExpense(form.id, payload) : createExpense(payload);
    },
    onSuccess: async (result: any) => {
      setForm(emptyForm());
      await refreshAll();
      notify.success('Expense saved', result?.message ?? 'Expense details were updated.');
    },
    onError: (error: any) => notify.error('Unable to save expense', error?.response?.data?.error?.message ?? error.message),
  });

  const saveCategoryMutation = useMutation({
    mutationFn: () => {
      if (!categoryForm.name.trim()) throw new Error('Category name is required.');
      const payload = {
        schoolId: activeSchoolId,
        name: categoryForm.name.trim(),
        description: categoryForm.description || null,
        status: categoryForm.status,
      };
      return categoryForm.id ? updateExpenseCategory(categoryForm.id, payload) : createExpenseCategory(payload);
    },
    onSuccess: async () => {
      setCategoryForm({ id: '', name: '', description: '', status: 'ACTIVE' });
      await refreshAll();
      notify.success('Category saved', 'Expense category is ready to use.');
    },
    onError: (error: any) => notify.error('Unable to save category', error?.response?.data?.error?.message ?? error.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: ({ expense, reason }: { expense: Expense; reason?: string }) => deleteExpense(expense.id, { schoolId: activeSchoolId, reason }),
    onSuccess: async (result: any) => {
      await refreshAll();
      notify.success('Expense deleted', result?.message ?? 'Expense was removed.');
    },
    onError: (error: any) => notify.error('Unable to delete expense', error?.response?.data?.error?.message ?? error.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveExpenseChangeRequest(id),
    onSuccess: async () => {
      await refreshAll();
      notify.success('Request approved', 'Expense change was applied.');
    },
    onError: (error: any) => notify.error('Unable to approve request', error?.response?.data?.error?.message ?? error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectExpenseChangeRequest(id),
    onSuccess: async () => {
      await refreshAll();
      notify.success('Request rejected', 'Expense change request was rejected.');
    },
    onError: (error: any) => notify.error('Unable to reject request', error?.response?.data?.error?.message ?? error.message),
  });

  const startEdit = (expense: Expense) => {
    setForm({
      id: expense.id,
      categoryId: expense.categoryId,
      title: expense.title,
      amount: String(expense.amount),
      expenseDate: expense.expenseDate.slice(0, 10),
      paymentMode: expense.paymentMode,
      paidTo: expense.paidTo ?? '',
      referenceNumber: expense.referenceNumber ?? '',
      description: expense.description ?? '',
      reason: '',
      receipt: null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportExpenses({ schoolId: activeSchoolId, ...filters, format });
      downloadBlob(blob, `expense-report-${today()}.${format}`);
    } catch (error: any) {
      notify.error('Export failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to export expenses.');
    }
  };

  const submitExpense = (event: FormEvent) => {
    event.preventDefault();
    saveExpenseMutation.mutate();
  };

  const submitCategory = (event: FormEvent) => {
    event.preventDefault();
    saveCategoryMutation.mutate();
  };

  const canManage = !isPlatform && hasPermission('expenses.create');
  const canEdit = !isPlatform && hasPermission('expenses.edit');
  const canDelete = !isPlatform && hasPermission('expenses.delete');
  const canManageCategories = !isPlatform && hasPermission('expenses.categories.create');

  if (sessionQuery.isLoading) {
    return <div className="p-8 text-sm text-slate-500">Loading expenses...</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isPlatform ? 'Expense Reports' : 'Expenses'}
        subtitle={isPlatform ? 'View and export school-wise expenses without editing school records.' : 'Track school expenses, receipts, categories, and approval requests.'}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Accounts' }, { label: isPlatform ? 'Expense Reports' : 'Expenses' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass} onClick={() => handleExport('csv')}>CSV</button>
            <button className={buttonClass} onClick={() => handleExport('xlsx')}>Excel</button>
          </div>
        }
      />

      {isPlatform ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">School</label>
          <select className={`${inputClass} mt-1 max-w-md`} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
            <option value="">All schools</option>
            {(schoolsQuery.data?.items ?? []).map((school) => (
              <option key={school.id} value={school.id}>{school.name} ({school.code})</option>
            ))}
          </select>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Expenses</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(summary?.totalAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entries</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{summary?.totalCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Approvals</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{requestsQuery.data?.length ?? 0}</p>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">{form.id ? 'Edit Expense' : 'Add Expense'}</h2>
            {form.id ? <button className={buttonClass} onClick={() => setForm(emptyForm())}>Cancel Edit</button> : null}
          </div>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={submitExpense}>
            <select className={inputClass} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
              <option value="">Category</option>
              {categories.filter((category) => category.status === 'ACTIVE').map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <input className={inputClass} value={form.title} placeholder="Title" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            <input className={inputClass} value={form.amount} type="number" min="0" step="0.01" placeholder="Amount" onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
            <input className={inputClass} value={form.expenseDate} type="date" onChange={(event) => setForm((current) => ({ ...current, expenseDate: event.target.value }))} />
            <select className={inputClass} value={form.paymentMode} onChange={(event) => setForm((current) => ({ ...current, paymentMode: event.target.value as ExpensePaymentMode }))}>
              {paymentModes.map((mode) => <option key={mode} value={mode}>{paymentLabels[mode]}</option>)}
            </select>
            <input className={inputClass} value={form.paidTo} placeholder="Paid to / Vendor" onChange={(event) => setForm((current) => ({ ...current, paidTo: event.target.value }))} />
            <input className={inputClass} value={form.referenceNumber} placeholder="Reference number" onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} />
            <input className={inputClass} type="file" accept="application/pdf,image/*,.doc,.docx" onChange={(event) => setForm((current) => ({ ...current, receipt: event.target.files?.[0] ?? null }))} />
            <textarea className={`${inputClass} md:col-span-2`} rows={3} value={form.description} placeholder="Description" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            {!isSchoolAdmin && form.id ? (
              <textarea className={`${inputClass} md:col-span-2`} rows={3} value={form.reason} placeholder="Reason for school admin approval" onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            ) : null}
            <div className="md:col-span-4">
              <button className={primaryButtonClass} type="submit" disabled={saveExpenseMutation.isPending}>{form.id && !isSchoolAdmin ? 'Send Approval Request' : 'Save Expense'}</button>
            </div>
          </form>
        </section>
      ) : null}

      {canManageCategories ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-950">Expense Categories</h2>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={submitCategory}>
            <input className={inputClass} value={categoryForm.name} placeholder="Category name" onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
            <input className={`${inputClass} md:col-span-2`} value={categoryForm.description} placeholder="Description" onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
            <select className={inputClass} value={categoryForm.status} onChange={(event) => setCategoryForm((current) => ({ ...current, status: event.target.value as 'ACTIVE' | 'INACTIVE' }))}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button className={primaryButtonClass} type="submit" disabled={saveCategoryMutation.isPending}>{categoryForm.id ? 'Update' : 'Add'}</button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((category: ExpenseCategory) => (
              <span key={category.id} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                <span className={category.status === 'ACTIVE' ? 'text-slate-900' : 'text-slate-400'}>{category.name}</span>
                <button className="font-semibold text-indigo-600" onClick={() => setCategoryForm({ id: category.id, name: category.name, description: category.description ?? '', status: category.status })}>Edit</button>
                <button
                  className="font-semibold text-rose-600"
                  onClick={() => {
                    if (!window.confirm(`Delete ${category.name}?`)) return;
                    deleteExpenseCategory(category.id, activeSchoolId)
                      .then(refreshAll)
                      .then(() => notify.success('Category deleted', 'Expense category was removed.'))
                      .catch((error: any) => notify.error('Unable to delete category', error?.response?.data?.error?.message ?? error.message));
                  }}
                >
                  Delete
                </button>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {requestsQuery.data?.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 text-base font-semibold text-amber-950">Pending Expense Requests</h2>
          <div className="space-y-2">
            {requestsQuery.data.map((request) => (
              <div key={request.id} className="flex flex-col gap-3 rounded-md border border-amber-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{request.requestType === 'UPDATE' ? 'Edit request' : 'Delete request'}: {request.expense?.title}</p>
                  <p className="text-sm text-slate-500">{request.reason || 'No reason provided'} · {new Date(request.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button className={buttonClass} onClick={() => rejectMutation.mutate(request.id)}>Reject</button>
                  <button className={primaryButtonClass} onClick={() => approveMutation.mutate(request.id)}>Approve</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-5">
          <input className={inputClass} value={filters.search} placeholder="Search expenses" onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          <select className={inputClass} value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className={inputClass} value={filters.paymentMode} onChange={(event) => setFilters((current) => ({ ...current, paymentMode: event.target.value as ExpensePaymentMode | '' }))}>
            <option value="">All modes</option>
            {paymentModes.map((mode) => <option key={mode} value={mode}>{paymentLabels[mode]}</option>)}
          </select>
          <input className={inputClass} type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
          <input className={inputClass} type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                {isPlatform ? <th className="px-4 py-3">School</th> : null}
                <th className="px-4 py-3">Expense</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Receipt</th>
                {!isPlatform ? <th className="px-4 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="align-top">
                  <td className="px-4 py-3 text-slate-600">{expense.expenseDate.slice(0, 10)}</td>
                  {isPlatform ? <td className="px-4 py-3 text-slate-700">{expense.school?.name ?? '-'}</td> : null}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-950">{expense.title}</p>
                    <p className="text-xs text-slate-500">{expense.paidTo || '-'} {expense.referenceNumber ? `· ${expense.referenceNumber}` : ''}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{expense.category?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{paymentLabels[expense.paymentMode]}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatMoney(expense.amount)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {expense.receiptFileName ? (
                      <a
                        className="font-semibold text-indigo-600 hover:text-indigo-800"
                        href={`/api/proxy/expenses/${expense.id}/receipt${activeSchoolId ? `?schoolId=${encodeURIComponent(activeSchoolId)}` : ''}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {expense.receiptFileName}
                      </a>
                    ) : '-'}
                  </td>
                  {!isPlatform ? (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canEdit ? <button className={buttonClass} onClick={() => startEdit(expense)}>Edit</button> : null}
                        {canDelete ? (
                          <button
                            className={buttonClass}
                            onClick={() => {
                              const reason = isSchoolAdmin ? '' : window.prompt('Reason for school admin approval') || '';
                              deleteExpenseMutation.mutate({ expense, reason });
                            }}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!expenses.length ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={isPlatform ? 8 : 7}>No expenses found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
