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
export type FeeApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'INACTIVE';
export type FeeDiscountTargetType = 'STUDENT' | 'CLASS' | 'SECTION' | 'CATEGORY' | 'FEE_TYPE' | 'ALL';
export type FeeAssignmentTargetType = 'CLASS' | 'SECTION' | 'STUDENT' | 'GROUP' | 'CATEGORY' | 'TRANSPORT_ROUTE';
export type FeeFineType = 'FIXED' | 'DAILY' | 'MONTHLY';

export type FeePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type FeeListResponse<T> = {
  items: T[];
  data?: T[];
  pagination: FeePagination;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

export type FeeOption = { id: string; name: string; isActive?: boolean };
export type FeeClassOption = { id: string; name: string };
export type FeeSectionOption = { id: string; name: string; classId: string };
export type FeeStudentOption = {
  id: string;
  admissionNo: string;
  rollNo?: string | null;
  fullName: string;
  classId?: string | null;
  sectionId?: string | null;
  phone?: string | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
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
  targetType: FeeAssignmentTargetType;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  groupId?: string | null;
  categoryId?: string | null;
  transportRouteId?: string | null;
  feeStructureId: string;
  overrideAmount?: number | string | null;
  startMonth: string;
  endMonth?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  assignedAt: string;
  notes?: string | null;
  student?: FeeStudentOption & {
    class?: FeeClassOption | null;
    section?: FeeSectionOption | null;
  };
  class?: FeeClassOption | null;
  section?: FeeSectionOption | null;
  group?: FeeOption | null;
  category?: FeeOption | null;
  transportRoute?: FeeTransportRouteOption | null;
  feeStructure?: FeeStructure;
};

export type FeeAssignmentsResponse = {
  items: StudentFeeAssignment[];
  assignedStudents: FeeStudentOption[];
  unassignedStudents: FeeStudentOption[];
  pagination: FeePagination;
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
  chequeNumber?: string | null;
  bankName?: string | null;
  idempotencyKey?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  paidAt: string;
  invoice?: { invoiceNumber: string };
  student?: { fullName: string; admissionNo: string };
  receipt?: FeeReceipt | null;
  allocations?: FeePaymentAllocation[];
};

export type FeeReceipt = {
  id: string;
  receiptNumber: string;
  paymentId: string;
  invoiceId: string;
  receiptDate: string;
  amount: number | string;
};

export type FeePaymentAllocation = {
  id: string;
  paymentId: string;
  invoiceId: string;
  allocatedAmount: number | string;
  invoice?: Pick<FeeInvoice, 'id' | 'invoiceNumber' | 'feeMonth' | 'dueDate' | 'totalAmount' | 'discountAmount' | 'fineAmount' | 'paidAmount' | 'dueAmount' | 'status' | 'feeType'>;
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

export type FeeInvoicePreviewRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className?: string | null;
  sectionName?: string | null;
  feeStructureName?: string | null;
  feeTypeName?: string | null;
  feeMonth: string;
  dueDate: string;
  baseAmount: number;
  discountAmount: number;
  fineAmount: number;
  previousBalance: number;
  netPayable: number;
  duplicateInvoiceExists: boolean;
  warnings: string[];
  canGenerate: boolean;
};

export type FeeInvoicePreviewResponse = {
  rows: FeeInvoicePreviewRow[];
  excludedStudentIds: string[];
  totals: {
    totalStudents: number;
    totalBaseAmount: number;
    totalDiscount: number;
    totalFine: number;
    totalPreviousBalance: number;
    totalNetPayable: number;
    duplicatesSkipped: number;
    excludedStudents: number;
    generatableStudents: number;
  };
};

export type FeeInvoiceSortBy = 'invoiceDate' | 'dueDate' | 'feeMonth' | 'totalAmount' | 'paidAmount' | 'balanceAmount' | 'createdAt';

export type FeeInvoiceListParams = FeeScopeParams & {
  page?: number;
  limit?: number;
  search?: string;
  studentId?: string;
  admissionNumber?: string;
  invoiceNumber?: string;
  classId?: string;
  sectionId?: string;
  feeTypeId?: string;
  feeStructureId?: string;
  feeMonth?: string;
  status?: FeeInvoiceStatus;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: FeeInvoiceSortBy;
  sortOrder?: 'asc' | 'desc';
};

export type FeeLedgerEntry = {
  id: string;
  entryType: string;
  type?: string;
  description: string;
  debit?: number | string;
  credit?: number | string;
  balance?: number | string;
  debitAmount?: number | string;
  creditAmount?: number | string;
  balanceAfter?: number | string;
  createdAt: string;
  invoice?: { invoiceNumber: string } | null;
  payment?: { paymentNumber: string } | null;
  receipt?: { receiptNumber: string } | null;
  referenceInvoiceNumber?: string | null;
  referenceReceiptNumber?: string | null;
};

export type FeeLedgerResponse = {
  items: FeeLedgerEntry[];
  openingBalance: number | string;
  pagination: FeePagination;
};

export type FeeCollectionStudent = FeeStudentOption & {
  class?: FeeClassOption | null;
  section?: FeeSectionOption | null;
  pendingInvoiceCount: number;
  pendingAmount: number | string;
};

export type FeeCollectionPaymentResponse = {
  payment: FeePayment;
  receipt: FeeReceipt;
  invoice: FeeInvoice;
  invoices: FeeInvoice[];
  allocations: FeePaymentAllocation[];
  idempotent: boolean;
};

export type FeeDiscount = {
  id: string;
  discountName?: string | null;
  targetType: FeeDiscountTargetType;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  categoryId?: string | null;
  feeTypeId?: string | null;
  particularId?: string | null;
  discountType: FeeDiscountType;
  valueType: FeeValueType;
  value: number | string;
  amount?: number | string | null;
  validFrom?: string | null;
  validTo?: string | null;
  approvalStatus: FeeApprovalStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  reason?: string | null;
  note?: string | null;
  student?: { id: string; fullName: string; admissionNo: string } | null;
  class?: { id?: string; name: string } | null;
  section?: { id?: string; name: string } | null;
  category?: { id: string; name: string } | null;
  feeType?: Pick<FeeType, 'id' | 'name' | 'schedule'> | null;
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
  type?: FeeReportType;
  filters?: Record<string, string | null>;
  summary?: {
    totalBilled: number;
    totalCollected: number;
    totalDiscount: number;
    totalFine: number;
    totalDue: number;
    totalCancelled: number;
    totalReceipts: number;
  };
  rows?: FeeReportRow[];
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

export type FeeReportType =
  | 'daily_collection'
  | 'monthly_collection'
  | 'class_wise_due'
  | 'section_wise_due'
  | 'student_wise_due'
  | 'outstanding_report'
  | 'discount_report'
  | 'fine_report'
  | 'cancelled_invoice_report'
  | 'payment_mode_report'
  | 'accountant_wise_collection'
  | 'receipt_report'
  | 'ledger_summary';

export type FeeReportFormat = 'pdf' | 'xlsx' | 'csv';
export type FeeReportRow = Record<string, string | number | null>;
export type FeeReportParams = FeeScopeParams & {
  type?: FeeReportType;
  dateFrom?: string;
  dateTo?: string;
  from?: string;
  to?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  feeTypeId?: string;
  feeStructureId?: string;
  paymentMode?: FeePaymentMode;
  status?: string;
  collectedById?: string;
};

export type FeeMetadata = {
  schoolId: string;
  academicSessionId: string;
  academicSessions: FeeOption[];
  classes: FeeClassOption[];
  sections: FeeSectionOption[];
  students: FeeStudentOption[];
  studentGroups: FeeOption[];
  studentCategories: FeeOption[];
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

export const listFeeAssignments = async (params?: FeeScopeParams & { page?: number; limit?: number; search?: string; status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; classId?: string; sectionId?: string; feeStructureId?: string }) => {
  const { data } = await api.get<FeeAssignmentsResponse>('/fees/assignments', { params: sanitizeParams(params) });
  return data;
};

export const assignStudentFees = async (payload: FeeScopeParams & {
  feeStructureId: string;
  targetType?: FeeAssignmentTargetType;
  studentIds?: string[];
  studentId?: string | null;
  classId?: string;
  sectionId?: string | null;
  groupId?: string | null;
  categoryId?: string | null;
  transportRouteId?: string | null;
  overrideAmount?: number | null;
  startMonth?: string | null;
  endMonth?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  autoAssigned?: boolean;
  notes?: string | null;
}) => {
  const { data } = await api.post<{ assigned: number; requested: number; assignments: StudentFeeAssignment[]; assignedStudents: FeeStudentOption[] }>('/fees/assignments', payload);
  return data;
};

export const updateFeeAssignment = async (id: string, payload: Parameters<typeof assignStudentFees>[0]) => {
  const { data } = await api.patch<StudentFeeAssignment>(`/fees/assignments/${id}`, payload);
  return data;
};

export const deleteFeeAssignment = async (id: string, params?: FeeScopeParams) => {
  const { data } = await api.delete<StudentFeeAssignment>(`/fees/assignments/${id}`, { params });
  return data;
};

export const activateFeeAssignment = async (id: string, payload?: FeeScopeParams) => {
  const { data } = await api.patch<StudentFeeAssignment>(`/fees/assignments/${id}/activate`, payload ?? {});
  return data;
};

export const deactivateFeeAssignment = async (id: string, payload?: FeeScopeParams) => {
  const { data } = await api.patch<StudentFeeAssignment>(`/fees/assignments/${id}/deactivate`, payload ?? {});
  return data;
};

export const listFeeInvoices = async (params?: FeeInvoiceListParams) => {
  const { data } = await api.get<FeeListResponse<FeeInvoice>>('/fees/invoices', { params: sanitizeParams(params) });
  return data;
};

export const generateFeeInvoices = async (payload: FeeScopeParams & {
  target: 'STUDENT' | 'CLASS' | 'SECTION' | 'SCHOOL';
  studentId?: string;
  studentIds?: string[];
  classId?: string;
  sectionId?: string;
  feeStructureId?: string;
  feeTypeId?: string;
  feeMonth: string;
  dueDate: string;
  emailInvoice?: boolean;
}) => {
  const { data } = await api.post<{ generated: FeeInvoice[]; skipped: Array<{ studentId: string; reason: string }> }>('/fees/invoices/generate', payload);
  return data;
};

export const previewFeeInvoices = async (payload: FeeScopeParams & {
  target: 'STUDENT' | 'CLASS' | 'SECTION' | 'SCHOOL';
  studentId?: string;
  studentIds?: string[];
  classId?: string;
  sectionId?: string;
  feeStructureId?: string;
  feeTypeId?: string;
  feeMonth: string;
  dueDate: string;
}) => {
  const { data } = await api.post<FeeInvoicePreviewResponse>('/fees/invoices/preview', payload);
  return data;
};

export const cancelFeeInvoice = async (id: string, payload?: FeeScopeParams & { reason?: string | null }) => {
  const { data } = await api.patch<FeeInvoice>(`/fees/invoices/${id}/cancel`, payload ?? {});
  return data;
};

export const collectFeePayment = async (payload: FeeScopeParams & {
  studentId?: string;
  invoiceId?: string;
  amount: number;
  paymentDate?: string | null;
  paymentMode: FeePaymentMode;
  transactionReference?: string | null;
  chequeNumber?: string | null;
  bankName?: string | null;
  idempotencyKey?: string | null;
  allocations?: Array<{ invoiceId: string; amount: number }>;
  gateway?: string | null;
  gatewayPaymentId?: string | null;
  note?: string | null;
}) => {
  const { data } = await api.post<FeeCollectionPaymentResponse>('/fees/payments', payload);
  return data;
};

export const listFeePayments = async (params?: FeeScopeParams & { page?: number; limit?: number; search?: string; paymentMode?: FeePaymentMode; status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
  const { data } = await api.get<FeePayment[] | FeeListResponse<FeePayment>>('/fees/payments', { params: sanitizeParams(params) });
  return data;
};

export const searchFeeCollectionStudents = async (params?: FeeScopeParams & { search?: string; classId?: string; sectionId?: string }) => {
  const { data } = await api.get<{ items: FeeCollectionStudent[] }>('/fees/collection/students', { params: sanitizeParams(params) });
  return data;
};

export const listStudentCollectionInvoices = async (studentId: string, params?: FeeScopeParams) => {
  const { data } = await api.get<{ items: FeeInvoice[] }>(`/fees/collection/students/${studentId}/invoices`, { params: sanitizeParams(params) });
  return data;
};

export const getStudentFeeLedger = async (studentId: string, params?: FeeScopeParams & { page?: number; limit?: number; entryType?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
  const { data } = await api.get<FeeLedgerResponse>(`/fees/ledger/${studentId}`, { params: sanitizeParams(params) });
  return data;
};

export const listFeeDiscounts = async (params?: FeeScopeParams & {
  page?: number;
  limit?: number;
  search?: string;
  status?: FeeApprovalStatus;
  targetType?: FeeDiscountTargetType;
  studentId?: string;
  classId?: string;
  sectionId?: string;
  categoryId?: string;
  feeTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  const { data } = await api.get<FeeDiscount[] | FeeListResponse<FeeDiscount>>('/fees/discounts', { params: sanitizeParams(params) });
  return data;
};

export const createFeeDiscount = async (payload: FeeScopeParams & {
  discountName?: string | null;
  targetType: FeeDiscountTargetType;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  categoryId?: string | null;
  feeTypeId?: string | null;
  particularId?: string | null;
  discountType: FeeValueType;
  discountValue: number;
  amount?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  status?: FeeApprovalStatus;
  reason?: string | null;
  note?: string | null;
}) => {
  const { data } = await api.post<FeeDiscount>('/fees/discounts', payload);
  return data;
};

export const updateFeeDiscount = async (id: string, payload: FeeScopeParams & Partial<Parameters<typeof createFeeDiscount>[0]>) => {
  const { data } = await api.patch<FeeDiscount>(`/fees/discounts/${id}`, payload);
  return data;
};

export const deleteFeeDiscount = async (id: string, params?: FeeScopeParams) => {
  const { data } = await api.delete<FeeDiscount>(`/fees/discounts/${id}`, { params });
  return data;
};

export const approveFeeDiscount = async (id: string, payload?: FeeScopeParams & { reason?: string | null }) => {
  const { data } = await api.patch<FeeDiscount>(`/fees/discounts/${id}/approve`, payload ?? {});
  return data;
};

export const rejectFeeDiscount = async (id: string, payload?: FeeScopeParams & { reason?: string | null }) => {
  const { data } = await api.patch<FeeDiscount>(`/fees/discounts/${id}/reject`, payload ?? {});
  return data;
};

export const activateFeeDiscount = async (id: string, payload?: FeeScopeParams & { reason?: string | null }) => {
  const { data } = await api.patch<FeeDiscount>(`/fees/discounts/${id}/activate`, payload ?? {});
  return data;
};

export const deactivateFeeDiscount = async (id: string, payload?: FeeScopeParams) => {
  const { data } = await api.patch<FeeDiscount>(`/fees/discounts/${id}/deactivate`, payload ?? {});
  return data;
};

export const listFeeFines = async (params?: FeeScopeParams & { page?: number; limit?: number; search?: string; status?: FeeRecordStatus; sortBy?: string; sortOrder?: 'asc' | 'desc' }) => {
  const { data } = await api.get<FeeFine[] | FeeListResponse<FeeFine>>('/fees/fines', { params: sanitizeParams(params) });
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

export const deleteFeeFine = async (id: string, params?: FeeScopeParams) => {
  const { data } = await api.delete<FeeFine>(`/fees/fines/${id}`, { params });
  return data;
};

export const getFeeReports = async (params?: FeeReportParams) => {
  const { data } = await api.get<FeeReports>('/fees/reports', { params: sanitizeParams(params) });
  return data;
};

export const exportFeeReports = async (params: FeeReportParams & { format: FeeReportFormat }) => {
  const { data } = await api.get<Blob>('/fees/reports/export', { params: sanitizeParams(params), responseType: 'blob' });
  return data;
};
