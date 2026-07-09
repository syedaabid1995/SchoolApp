import { api } from '../lib/api';

export type ExpensePaymentMode = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'UPI' | 'CARD' | 'OTHER';
export type ExpenseChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ExpenseChangeRequestType = 'UPDATE' | 'DELETE';

export type ExpenseCategory = {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isDefault: boolean;
  sortOrder: number;
  _count?: { expenses?: number };
};

export type Expense = {
  id: string;
  schoolId: string;
  categoryId: string;
  title: string;
  amount: string | number;
  expenseDate: string;
  paymentMode: ExpensePaymentMode;
  paidTo?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  receiptUrl?: string | null;
  receiptFileName?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  school?: { id: string; name: string; code: string };
  category?: Pick<ExpenseCategory, 'id' | 'name' | 'status'>;
  _count?: { changeRequests?: number };
};

export type ExpenseChangeRequest = {
  id: string;
  schoolId: string;
  expenseId: string;
  requestType: ExpenseChangeRequestType;
  proposedData?: Record<string, unknown> | null;
  reason?: string | null;
  status: ExpenseChangeRequestStatus;
  requestedById?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  expense?: Expense;
};

export type ExpenseListResponse = {
  items: Expense[];
  summary: { totalAmount: string | number; totalCount: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type ExpenseQueryParams = {
  schoolId?: string;
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  paymentMode?: ExpensePaymentMode | '';
  dateFrom?: string;
  dateTo?: string;
};

export type ExpensePayload = {
  schoolId?: string;
  categoryId: string;
  title: string;
  amount: number;
  expenseDate: string;
  paymentMode: ExpensePaymentMode;
  paidTo?: string | null;
  referenceNumber?: string | null;
  description?: string | null;
  reason?: string | null;
  receipt?: File | null;
};

const asFormData = (payload: ExpensePayload) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'receipt' && value instanceof File) {
      form.append('receipt', value);
      return;
    }
    if (key !== 'receipt') form.append(key, String(value));
  });
  return form;
};

const cleanParams = (params?: ExpenseQueryParams) => ({
  ...params,
  search: params?.search?.trim() || undefined,
  paymentMode: params?.paymentMode || undefined,
  categoryId: params?.categoryId || undefined,
  dateFrom: params?.dateFrom || undefined,
  dateTo: params?.dateTo || undefined,
});

export const getExpenseMetadata = async (schoolId?: string) => {
  const { data } = await api.get<{ paymentModes: ExpensePaymentMode[]; categories: ExpenseCategory[] }>('/expenses/metadata', {
    params: { schoolId },
  });
  return data;
};

export const listExpenseCategories = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<ExpenseCategory[]>('/expenses/categories', { params });
  return data;
};

export const createExpenseCategory = async (payload: Partial<ExpenseCategory> & { schoolId?: string; name: string }) => {
  const { data } = await api.post<ExpenseCategory>('/expenses/categories', payload);
  return data;
};

export const updateExpenseCategory = async (id: string, payload: Partial<ExpenseCategory> & { schoolId?: string }) => {
  const { data } = await api.patch<ExpenseCategory>(`/expenses/categories/${id}`, payload);
  return data;
};

export const deleteExpenseCategory = async (id: string, schoolId?: string) => {
  await api.delete(`/expenses/categories/${id}`, { params: { schoolId } });
};

export const listExpenses = async (params?: ExpenseQueryParams) => {
  const { data } = await api.get<ExpenseListResponse>('/expenses', { params: cleanParams(params) });
  return data;
};

export const createExpense = async (payload: ExpensePayload) => {
  const { data } = await api.post<Expense>('/expenses', asFormData(payload), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateExpense = async (id: string, payload: ExpensePayload) => {
  const { data } = await api.patch<Expense | { message: string; request: ExpenseChangeRequest }>(`/expenses/${id}`, asFormData(payload), {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteExpense = async (id: string, params?: { schoolId?: string; reason?: string }) => {
  const { data } = await api.delete<{ message?: string; request?: ExpenseChangeRequest } | undefined>(`/expenses/${id}`, {
    data: { reason: params?.reason },
    params: { schoolId: params?.schoolId },
  });
  return data;
};

export const listExpenseChangeRequests = async (params?: { schoolId?: string; status?: ExpenseChangeRequestStatus }) => {
  const { data } = await api.get<ExpenseChangeRequest[]>('/expenses/change-requests', { params });
  return data;
};

export const approveExpenseChangeRequest = async (id: string, note?: string) => {
  const { data } = await api.patch<ExpenseChangeRequest>(`/expenses/change-requests/${id}/approve`, { note });
  return data;
};

export const rejectExpenseChangeRequest = async (id: string, note?: string) => {
  const { data } = await api.patch<ExpenseChangeRequest>(`/expenses/change-requests/${id}/reject`, { note });
  return data;
};

export const exportExpenses = async (params?: ExpenseQueryParams & { format?: 'csv' | 'xlsx' }) => {
  const { data } = await api.get<Blob>('/expenses/export', {
    params: cleanParams(params),
    responseType: 'blob',
  });
  return data;
};
