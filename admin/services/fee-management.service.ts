import { api } from '../lib/api';

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export type FeeRecordStatus = 'ACTIVE' | 'INACTIVE';
export type FeeParticularType = 'CHARGE' | 'DISCOUNT' | 'FINE' | 'PREVIOUS_BALANCE' | 'TRANSPORT' | 'HOSTEL';
export type FeeCollectionSchedule = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'ONE_TIME';
export type FeeStructureStatus = 'ACTIVE' | 'INACTIVE';
export type FeeInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type FeePaymentMode = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE_GATEWAY';
export type FeeDiscountType = 'SCHOLARSHIP' | 'SIBLING_DISCOUNT' | 'STAFF_CHILD_DISCOUNT' | 'SPECIAL_DISCOUNT';
export type FeeValueType = 'PERCENTAGE' | 'FIXED';
export type FeeApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'INACTIVE';
export type FeeFineType = 'FIXED' | 'DAILY' | 'MONTHLY';

export type FeePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type FeeListResponse<T> = {
  items: T[];
  pagination: FeePagination;
};

export type FeeOption = { id: string; name: string; isActive?: boolean };
export type FeeClassOption = { id: string; name: string };
export type FeeSectionOption = { id: string; name: string; classId: string };
export type FeeStudentOption = {
  id: string;
  admissionNo: string;
  fullName: string;
  classId?: string | null;
  sectionId?: string | null;
};
export type FeeTransportRouteOption = { id: string; title: string; fare: number | string };

export type FeeParticular = {
  id: string;
  schoolId: string;
  academicSessionId: string;
  name: string;
  code: string;
  description?: string | null;
  type: FeeParticularType;
  isMandatory: boolean;
  isSystemGenerated: boolean;
  status: FeeRecordStatus;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FeeType = {
  id: string;
  schoolId: string;
  academicSessionId: string;
  name: string;
  code: string;
  schedule: FeeCollectionSchedule;
  description?: string | null;
  status: FeeRecordStatus;
  sortOrder: number;
};

export type FeeStructureItem = {
  id?: string;
  feeStructureId?: string;
  particularId: string;
  amount: number | string;
  isOptional: boolean;
  sortOrder: number;
  particular?: Pick<FeeParticular, 'id' | 'name' | 'code' | 'type'>;
};

export type FeeStructure = {
  id: string;
  schoolId: string;
  academicSessionId: string;
  classId: string;
  sectionId?: string | null;
  feeTypeId: string;
  name: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status: FeeStructureStatus;
  class?: FeeClassOption;
  section?: FeeSectionOption | null;
  feeType?: Pick<FeeType, 'id' | 'name' | 'schedule'>;
  items: FeeStructureItem[];
  _count?: { assignments?: number; invoices?: number };
  createdAt?: string;
};

export type StudentFeeAssignment = {
  id: string;
  studentId: string;
  feeStructureId: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  assignedAt: string;
  notes?: string | null;
  student?: FeeStudentOption & {
    class?: FeeClassOption | null;
    section?: FeeSectionOption | null;
  };
  feeStructure?: FeeStructure;
};

export type FeeInvoiceItem = {
  id: string;
  particularId?: string | null;
  description: string;
  amount: number | string;
  discountAmount: number | string;
  fineAmount: number | string;
  netAmount: number | string;
  sortOrder: number;
};

export type FeePayment = {
  id: string;
  studentId: string;
  invoiceId: string;
  paymentNumber: string;
  paymentMode: FeePaymentMode;
  amount: number | string;
  transactionReference?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  paidAt: string;
  invoice?: { invoiceNumber: string };
  student?: { fullName: string; admissionNo: string };
  receipt?: FeeReceipt | null;
};

export type FeeReceipt = {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  receiptDate: string;
  amount: number | string;
};

export type FeeInvoice = {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  classId?: string | null;
  sectionId?: string | null;
  feeTypeId?: string | null;
  feeStructureId?: string | null;
  invoiceNumber: string;
  feeMonth?: string | null;
  issueDate: string;
  dueDate?: string | null;
  totalAmount: number | string;
  discountAmount: number | string;
  fineAmount: number | string;
  paidAmount: number | string;
  dueAmount: number | string;
  status: FeeInvoiceStatus;
  note?: string | null;
  student?: FeeStudentOption & { phone?: string | null; parentEmail?: string | null; parentPhone?: string | null };
  class?: FeeClassOption | null;
  section?: FeeSectionOption | null;
  feeType?: Pick<FeeType, 'id' | 'name' | 'schedule'> | null;
  items?: FeeInvoiceItem[];
  payments?: FeePayment[];
  receipts?: FeeReceipt[];
};

export type FeeLedgerEntry = {
  id: string;
  entryType: 'INVOICE' | 'PAYMENT' | 'DISCOUNT' | 'FINE' | 'ADJUSTMENT' | 'REFUND';
  description: string;
  debit: number | string;
  credit: number | string;
  balance: number | string;
  createdAt: string;
  invoice?: { invoiceNumber: string } | null;
  payment?: { paymentNumber: string } | null;
};

export type FeeDiscount = {
  id: string;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  particularId?: string | null;
  discountType: FeeDiscountType;
  valueType: FeeValueType;
  value: number | string;
  amount?: number | string | null;
  validFrom?: string | null;
  validTo?: string | null;
  approvalStatus: FeeApprovalStatus;
  note?: string | null;
  student?: { id: string; fullName: string; admissionNo: string } | null;
  class?: { name: string } | null;
  section?: { name: string } | null;
};

export type FeeFine = {
  id: string;
  particularId?: string | null;
  name: string;
  fineType: FeeFineType;
  amount: number | string;
  graceDays: number;
  status: FeeRecordStatus;
};

export type FeeReports = {
  totalCollected: number;
  totalInvoiced: number;
  totalOutstanding: number;
  payments: FeePayment[];
  invoices: FeeInvoice[];
  discounts: FeeDiscount[];
  fines: FeeFine[];
  dailyCollection: Record<string, number>;
  classWise: Record<string, { invoiced: number; due: number }>;
};

export type FeeMetadata = {
  schoolId: string;
  academicSessionId: string;
  academicSessions: FeeOption[];
  classes: FeeClassOption[];
  sections: FeeSectionOption[];
  students: FeeStudentOption[];
  particulars: FeeParticular[];
  feeTypes: FeeType[];
  structures: FeeStructure[];
  transportRoutes: FeeTransportRouteOption[];
};

export type FeeScopeParams = { schoolId?: string; academicSessionId?: string };

export const getFeeMetadata = async (params?: FeeScopeParams) => {
  const { data } = await api.get<FeeMetadata>('/fees/metadata', { params: sanitizeParams(params) });
  return data;
};

export const listFeeParticulars = async (params?: FeeScopeParams & { page?: number; limit?: number; search?: string; status?: FeeRecordStatus }) => {
  const { data } = await api.get<FeeListResponse<FeeParticular>>('/fees/particulars', { params: sanitizeParams(params) });
  return data;
};

export const createFeeParticular = async (payload: Partial<FeeParticular> & FeeScopeParams & { name: string; type: FeeParticularType }) => {
  const { data } = await api.post<FeeParticular>('/fees/particulars', payload);
  return data;
};

export const updateFeeParticular = async (id: string, payload: Partial<FeeParticular> & FeeScopeParams) => {
  const { data } = await api.patch<FeeParticular>(`/fees/particulars/${id}`, payload);
  return data;
};

export const deleteFeeParticular = async (id: string, params?: FeeScopeParams) => {
  await api.delete(`/fees/particulars/${id}`, { params });
};

export const listFeeTypes = async (params?: FeeScopeParams) => {
  const { data } = await api.get<FeeType[]>('/fees/types', { params: sanitizeParams(params) });
  return data;
};

export const createFeeType = async (payload: FeeScopeParams & { name: string; code?: string | null; schedule: FeeCollectionSchedule; description?: string | null; status?: FeeRecordStatus; sortOrder?: number }) => {
  const { data } = await api.post<FeeType>('/fees/types', payload);
  return data;
};

export const updateFeeType = async (id: string, payload: Partial<FeeType> & FeeScopeParams) => {
  const { data } = await api.patch<FeeType>(`/fees/types/${id}`, payload);
  return data;
};

export const deleteFeeType = async (id: string, params?: FeeScopeParams) => {
  await api.delete(`/fees/types/${id}`, { params });
};

export const listFeeStructures = async (params?: FeeScopeParams & { page?: number; limit?: number; classId?: string }) => {
  const { data } = await api.get<FeeListResponse<FeeStructure>>('/fees/structures', { params: sanitizeParams(params) });
  return data;
};

export const createFeeStructure = async (payload: FeeScopeParams & {
  classId: string;
  sectionId?: string | null;
  feeTypeId: string;
  name?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status?: FeeStructureStatus;
  items: Array<{ particularId: string; amount: number; isOptional?: boolean; sortOrder?: number }>;
}) => {
  const { data } = await api.post<FeeStructure>('/fees/structures', payload);
  return data;
};

export const updateFeeStructure = async (id: string, payload: Partial<Parameters<typeof createFeeStructure>[0]>) => {
  const { data } = await api.patch<FeeStructure>(`/fees/structures/${id}`, payload);
  return data;
};

export const deleteFeeStructure = async (id: string, params?: FeeScopeParams) => {
  await api.delete(`/fees/structures/${id}`, { params });
};

export const duplicateFeeStructure = async (id: string, payload: FeeScopeParams & { classId: string; sectionId?: string | null; name?: string | null }) => {
  const { data } = await api.post<FeeStructure>(`/fees/structures/${id}/duplicate`, payload);
  return data;
};

export const listFeeAssignments = async (params?: FeeScopeParams) => {
  const { data } = await api.get<StudentFeeAssignment[]>('/fees/assignments', { params: sanitizeParams(params) });
  return data;
};

export const assignStudentFees = async (payload: FeeScopeParams & {
  feeStructureId: string;
  studentIds?: string[];
  classId?: string;
  sectionId?: string | null;
  autoAssigned?: boolean;
  notes?: string | null;
}) => {
  const { data } = await api.post<{ assigned: number; requested: number }>('/fees/assignments', payload);
  return data;
};

export const listFeeInvoices = async (params?: FeeScopeParams & { page?: number; limit?: number; studentId?: string; status?: FeeInvoiceStatus }) => {
  const { data } = await api.get<FeeListResponse<FeeInvoice>>('/fees/invoices', { params: sanitizeParams(params) });
  return data;
};

export const generateFeeInvoices = async (payload: FeeScopeParams & {
  target: 'STUDENT' | 'CLASS' | 'SECTION' | 'SCHOOL';
  studentId?: string;
  classId?: string;
  sectionId?: string;
  feeStructureId?: string;
  feeTypeId?: string;
  feeMonth?: string | null;
  dueDate?: string | null;
  emailInvoice?: boolean;
}) => {
  const { data } = await api.post<{ generated: FeeInvoice[]; skipped: Array<{ studentId: string; reason: string }> }>('/fees/invoices/generate', payload);
  return data;
};

export const collectFeePayment = async (payload: FeeScopeParams & {
  invoiceId: string;
  amount: number;
  paymentMode: FeePaymentMode;
  transactionReference?: string | null;
  gateway?: string | null;
  gatewayPaymentId?: string | null;
  note?: string | null;
}) => {
  const { data } = await api.post<{ payment: FeePayment; receipt: FeeReceipt; invoice: FeeInvoice }>('/fees/payments', payload);
  return data;
};

export const listFeePayments = async (params?: FeeScopeParams) => {
  const { data } = await api.get<FeePayment[]>('/fees/payments', { params: sanitizeParams(params) });
  return data;
};

export const getStudentFeeLedger = async (studentId: string, params?: FeeScopeParams) => {
  const { data } = await api.get<FeeLedgerEntry[]>(`/fees/ledger/${studentId}`, { params: sanitizeParams(params) });
  return data;
};

export const listFeeDiscounts = async (params?: FeeScopeParams) => {
  const { data } = await api.get<FeeDiscount[]>('/fees/discounts', { params: sanitizeParams(params) });
  return data;
};

export const createFeeDiscount = async (payload: FeeScopeParams & {
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  particularId?: string | null;
  discountType: FeeDiscountType;
  valueType: FeeValueType;
  value: number;
  amount?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  approvalStatus?: FeeApprovalStatus;
  note?: string | null;
}) => {
  const { data } = await api.post<FeeDiscount>('/fees/discounts', payload);
  return data;
};

export const listFeeFines = async (params?: FeeScopeParams) => {
  const { data } = await api.get<FeeFine[]>('/fees/fines', { params: sanitizeParams(params) });
  return data;
};

export const createFeeFine = async (payload: FeeScopeParams & {
  particularId?: string | null;
  name: string;
  fineType: FeeFineType;
  amount: number;
  graceDays?: number;
  status?: FeeRecordStatus;
}) => {
  const { data } = await api.post<FeeFine>('/fees/fines', payload);
  return data;
};

export const getFeeReports = async (params?: FeeScopeParams & { from?: string; to?: string }) => {
  const { data } = await api.get<FeeReports>('/fees/reports', { params: sanitizeParams(params) });
  return data;
};
