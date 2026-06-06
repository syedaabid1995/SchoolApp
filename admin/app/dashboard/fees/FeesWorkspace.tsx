'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listAcademicYears } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import {
  activateFeeDiscount,
  activateFeeAssignment,
  assignStudentFees,
  approveFeeDiscount,
  cancelFeeInvoice,
  collectFeePayment,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deactivateFeeDiscount,
  deactivateFeeAssignment,
  deleteFeeAssignment,
  deleteFeeDiscount,
  deleteFeeFine,
  deleteFeeParticular,
  deleteFeeStructure,
  deleteFeeType,
  duplicateFeeStructure,
  exportFeeReports,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listStudentCollectionInvoices,
  listFeeAssignments,
  listFeeDiscounts,
  listFeeFines,
  listFeeInvoices,
  listFeeParticulars,
  listFeePayments,
  listFeeStructures,
  listFeeTypes,
  previewFeeInvoices,
  rejectFeeDiscount,
  searchFeeCollectionStudents,
  updateFeeAssignment,
  updateFeeDiscount,
  updateFeeParticular,
  updateFeeStructure,
  updateFeeType,
  type FeeApprovalStatus,
  type FeeAssignmentTargetType,
  type FeeClassOption,
  type FeeCollectionSchedule,
  type FeeCollectionStudent,
  type FeeDiscount,
  type FeeDiscountTargetType,
  type FeeFine,
  type FeeFineType,
  type FeeInvoice,
  type FeeInvoicePreviewResponse,
  type FeeInvoiceSortBy,
  type FeeInvoiceStatus,
  type FeeListResponse,
  type FeeParticular,
  type FeeParticularType,
  type FeePayment,
  type FeePaymentMode,
  type FeeReportFormat,
  type FeeReportRow,
  type FeeReportType,
  type FeeRecordStatus,
  type FeeReports,
  type FeeScopeParams,
  type FeeSectionOption,
  type FeeStructure,
  type FeeStructureItem,
  type FeeType,
  type FeeValueType,
  type StudentFeeAssignment,
} from '../../../services/fee-management.service';

export type FeeSectionId =
  | 'overview'
  | 'particulars'
  | 'types'
  | 'structures'
  | 'assignments'
  | 'invoice-generate'
  | 'invoices'
  | 'collection'
  | 'discounts'
  | 'fines'
  | 'ledger'
  | 'reports';

type TabId = FeeSectionId;

type StructureDraftItem = {
  id: string;
  particularId: string;
  amount: string;
  isOptional: boolean;
};

type ConfirmAction = {
  title: string;
  itemName: string;
  message: string;
  confirmLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
};

const getListItems = <T,>(response?: T[] | FeeListResponse<T>) => {
  if (!response) return [];
  return Array.isArray(response) ? response : response.items ?? response.data ?? [];
};

const tabs: Array<{ id: TabId; label: string; href: string; description: string }> = [
  { id: 'overview', label: 'Fee Overview', href: '/dashboard/fees/overview', description: 'Follow the full fee workflow from setup to reports.' },
  { id: 'particulars', label: 'Fee Particulars', href: '/dashboard/fees/particulars', description: 'Create and manage fee heads such as tuition, transport, hostel, discounts, fines, and previous balance.' },
  { id: 'types', label: 'Fee Types', href: '/dashboard/fees/types', description: 'Create and manage fee schedules such as monthly, quarterly, yearly, and one-time fees.' },
  { id: 'structures', label: 'Fee Structures', href: '/dashboard/fees/structures', description: 'Build class-wise fee plans with particulars and schedules.' },
  { id: 'assignments', label: 'Fee Assignments', href: '/dashboard/fees/assignments', description: 'Assign fee structures to classes, sections, or students.' },
  { id: 'invoice-generate', label: 'Generate Invoices', href: '/dashboard/fees/invoice-generate', description: 'Generate invoices by student, class, section, or full school using active fee assignments.' },
  { id: 'invoices', label: 'Fee Invoice List', href: '/dashboard/fees/invoices', description: 'Search, print, export, and manage issued student fee invoices.' },
  { id: 'collection', label: 'Fee Collection', href: '/dashboard/fees/collection', description: 'Collect payments, issue receipts, and print invoices.' },
  { id: 'discounts', label: 'Fee Discounts', href: '/dashboard/fees/discounts', description: 'Manage scholarships, waivers, sibling concessions, and special discounts.' },
  { id: 'fines', label: 'Fee Fines', href: '/dashboard/fees/fines', description: 'Manage late-payment fine rules and grace periods.' },
  { id: 'ledger', label: 'Fee Ledger', href: '/dashboard/fees/ledger', description: 'Review student-wise debit, credit, and balance entries.' },
  { id: 'reports', label: 'Fee Reports', href: '/dashboard/fees/reports', description: 'Analyze collections, dues, outstanding balances, and concessions.' },
];

const sectionViewPermissions: Record<TabId, string> = {
  overview: 'fees.overview.view',
  particulars: 'fees.particulars.view',
  types: 'fees.types.view',
  structures: 'fees.structures.view',
  assignments: 'fees.assignments.view',
  'invoice-generate': 'fees.invoice-generate.view',
  invoices: 'fees.invoices.view',
  collection: 'fees.collection.view',
  discounts: 'fees.discounts.view',
  fines: 'fees.fines.view',
  ledger: 'fees.ledger.view',
  reports: 'fees.reports.view',
};

const feeSectionIds = tabs.map((tab) => tab.id);
const isFeeSectionId = (value: string): value is TabId => feeSectionIds.includes(value as TabId);
const feeSectionFromPath = (pathname: string): TabId => {
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  if (segment === 'setup') return 'particulars';
  return isFeeSectionId(segment) ? segment : 'overview';
};
const feeSectionHref = (section: TabId) => tabs.find((tab) => tab.id === section)?.href ?? '/dashboard/fees/overview';

const particularTypes: FeeParticularType[] = ['CHARGE', 'DISCOUNT', 'FINE', 'PREVIOUS_BALANCE', 'TRANSPORT', 'HOSTEL'];
const schedules: FeeCollectionSchedule[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'];
const invoiceStatuses: Array<'' | FeeInvoiceStatus> = ['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const paymentModes: FeePaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY'];
const reportTypes: FeeReportType[] = [
  'daily_collection',
  'monthly_collection',
  'class_wise_due',
  'section_wise_due',
  'student_wise_due',
  'outstanding_report',
  'discount_report',
  'fine_report',
  'cancelled_invoice_report',
  'payment_mode_report',
  'accountant_wise_collection',
  'receipt_report',
  'ledger_summary',
];
const assignmentTargetTypes: FeeAssignmentTargetType[] = ['CLASS', 'SECTION', 'STUDENT', 'GROUP', 'CATEGORY', 'TRANSPORT_ROUTE'];
const discountValueTypes: FeeValueType[] = ['FIXED', 'PERCENTAGE'];
const discountTargetTypes: FeeDiscountTargetType[] = ['STUDENT', 'CLASS', 'SECTION', 'CATEGORY', 'FEE_TYPE', 'ALL'];
const discountStatuses: FeeApprovalStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'];
const fineTypes: FeeFineType[] = ['FIXED', 'DAILY', 'MONTHLY'];

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400';

const particularSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().optional(),
  type: z.enum(particularTypes),
  description: z.string().trim().optional(),
  isMandatory: z.boolean().default(false),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const feeTypeSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().optional(),
  schedule: z.enum(schedules),
  description: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const structureSchema = z.object({
  name: z.string().trim().optional(),
  classId: z.string().min(1, 'Class is required'),
  sectionId: z.string().optional(),
  feeTypeId: z.string().min(1, 'Fee type is required'),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

const assignmentSchema = z.object({
  feeStructureId: z.string().min(1, 'Fee structure is required'),
  targetType: z.enum(assignmentTargetTypes),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  studentId: z.string().optional(),
  studentIds: z.array(z.string()).default([]),
  groupId: z.string().optional(),
  categoryId: z.string().optional(),
  transportRouteId: z.string().optional(),
  overrideAmount: z.preprocess((value) => value === '' || value === null ? undefined : value, z.coerce.number().positive('Override must be greater than zero').optional()),
  startMonth: z.string().min(1, 'Start month is required'),
  endMonth: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  notes: z.string().trim().optional(),
}).superRefine((payload, ctx) => {
  if (payload.endMonth && payload.endMonth < payload.startMonth) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endMonth'], message: 'End month cannot be before start month' });
  }
  const requiredByTarget: Partial<Record<FeeAssignmentTargetType, keyof AssignmentForm>> = {
    CLASS: 'classId',
    SECTION: 'sectionId',
    STUDENT: 'studentId',
    GROUP: 'groupId',
    CATEGORY: 'categoryId',
    TRANSPORT_ROUTE: 'transportRouteId',
  };
  const field = requiredByTarget[payload.targetType];
  if (field && !payload[field]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${String(field).replace('Id', '')} is required` });
  }
});

const invoiceSchema = z.object({
  target: z.enum(['STUDENT', 'CLASS', 'SECTION', 'SCHOOL']),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  feeStructureId: z.string().optional(),
  feeTypeId: z.string().optional(),
  feeMonth: z.string().trim().min(1, 'Fee month is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  emailInvoice: z.boolean().default(false),
});

const paymentSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMode: z.enum(paymentModes),
  transactionReference: z.string().trim().optional(),
  chequeNumber: z.string().trim().optional(),
  bankName: z.string().trim().optional(),
  note: z.string().trim().optional(),
}).superRefine((payload, ctx) => {
  if (['UPI', 'BANK_TRANSFER', 'CARD', 'ONLINE_GATEWAY'].includes(payload.paymentMode) && !payload.transactionReference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transactionReference'], message: 'Transaction reference is required for this payment mode' });
  }
  if (payload.paymentMode === 'CHEQUE') {
    if (!payload.chequeNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chequeNumber'], message: 'Cheque number is required' });
    }
    if (!payload.bankName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['bankName'], message: 'Bank name is required' });
    }
  }
});

const discountSchema = z.object({
  discountName: z.string().trim().min(1, 'Discount name is required'),
  targetType: z.enum(discountTargetTypes),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  categoryId: z.string().optional(),
  feeTypeId: z.string().optional(),
  discountType: z.enum(discountValueTypes),
  discountValue: z.coerce.number().positive('Discount value must be greater than zero'),
  amount: z.coerce.number().min(0).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  status: z.enum(discountStatuses).default('PENDING_APPROVAL'),
  reason: z.string().trim().optional(),
  note: z.string().trim().optional(),
}).superRefine((payload, ctx) => {
  if (payload.discountType === 'PERCENTAGE' && payload.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountValue'], message: 'Percentage cannot exceed 100' });
  }
  if (payload.validFrom && payload.validTo && payload.validTo < payload.validFrom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validTo'], message: 'Valid to cannot be before valid from' });
  }
  const requiredByTarget: Partial<Record<FeeDiscountTargetType, keyof DiscountForm>> = {
    STUDENT: 'studentId',
    CLASS: 'classId',
    SECTION: 'sectionId',
    CATEGORY: 'categoryId',
    FEE_TYPE: 'feeTypeId',
  };
  const requiredField = requiredByTarget[payload.targetType];
  if (requiredField && !payload[requiredField]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [requiredField], message: `${String(requiredField).replace('Id', '')} is required` });
  }
});

const fineSchema = z.object({
  name: z.string().trim().min(1, 'Fine name is required'),
  particularId: z.string().optional(),
  fineType: z.enum(fineTypes),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  graceDays: z.coerce.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

type ParticularForm = z.infer<typeof particularSchema>;
type FeeTypeForm = z.infer<typeof feeTypeSchema>;
type StructureForm = z.infer<typeof structureSchema>;
type AssignmentForm = z.infer<typeof assignmentSchema>;
type InvoiceForm = z.infer<typeof invoiceSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;
type DiscountForm = z.infer<typeof discountSchema>;
type FineForm = z.infer<typeof fineSchema>;

const errorMessage = (error: unknown, fallback = 'Please try again.') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const money = (value?: number | string | null) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
    Number.isFinite(amount) ? amount : 0,
  );
};

const numberValue = (value?: number | string | null) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const dateValue = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const labelize = (value?: string | null) => String(value ?? '-').replace(/_/g, ' ');
const invoiceStatusLabel = (status?: FeeInvoiceStatus | null) => {
  if (status === 'ISSUED' || status === 'DRAFT') return 'UNPAID';
  if (status === 'PARTIALLY_PAID') return 'PARTIAL';
  return labelize(status);
};

const today = () => new Date().toISOString().slice(0, 10);

const Field = ({ label, children, error }: { label: string; children: ReactNode; error?: string }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {error ? <span className="mt-1 block text-xs font-semibold text-red-600">{error}</span> : null}
  </label>
);

const Card = ({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
    {children}
  </section>
);

const StatCard = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
  </div>
);

const SkeletonBlock = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 ${className}`} />
);

const DashboardSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="mt-4 h-8 w-32" />
        <SkeletonBlock className="mt-3 h-3 w-full" />
      </div>
    ))}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
    {message}
  </div>
);

const ConfirmDialog = ({ action, onCancel, onConfirm }: { action: ConfirmAction; onCancel: () => void; onConfirm: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
      <p className={`text-xs font-black uppercase tracking-wide ${action.tone === 'warning' ? 'text-amber-600' : 'text-red-600'}`}>{action.title}</p>
      <h3 className="mt-2 text-xl font-black text-slate-950">{action.itemName}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{action.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton onClick={onConfirm}>{action.confirmLabel ?? 'Confirm'}</PrimaryButton>
      </div>
    </div>
  </div>
);

const PrimaryButton = ({ children, disabled, type = 'button', onClick }: { children: ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, disabled, type = 'button', onClick }: { children: ReactNode; disabled?: boolean; type?: 'button' | 'submit'; onClick?: () => void }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const IconButton = ({ title, onClick, disabled, tone = 'neutral', children }: { title: string; onClick?: () => void; disabled?: boolean; tone?: 'neutral' | 'danger' | 'success'; children: ReactNode }) => {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
};

const Badge = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) => {
  const classes =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>;
};

const statusTone = (status?: string | null): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  const key = String(status ?? '').toUpperCase();
  if (['ACTIVE', 'PAID', 'SUCCESS', 'APPROVED'].includes(key)) return 'success';
  if (['PARTIALLY_PAID', 'PENDING_APPROVAL', 'ISSUED'].includes(key)) return 'warning';
  if (['OVERDUE', 'CANCELLED', 'FAILED', 'REJECTED', 'INACTIVE'].includes(key)) return 'danger';
  return 'neutral';
};

function DataTable<T>({ columns, data, emptyMessage, isLoading = false }: { columns: ColumnDef<T>[]; data: T[]; emptyMessage: string; isLoading?: boolean }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 font-black">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((_, columnIndex) => (
                  <td key={columnIndex} className="px-4 py-4">
                    <SkeletonBlock className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top text-slate-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                <EmptyState message={emptyMessage} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const ExportButtons = ({ onPrint, onCsv, onPdf, onExcel }: { onPrint: () => void; onCsv?: () => void; onPdf?: () => void; onExcel?: () => void }) => (
  <>
    {onCsv ? <SecondaryButton onClick={onCsv}>CSV</SecondaryButton> : null}
    {onPdf ? <SecondaryButton onClick={onPdf}>PDF</SecondaryButton> : null}
    {onExcel ? <SecondaryButton onClick={onExcel}>Excel</SecondaryButton> : null}
    <SecondaryButton onClick={onPrint}>Print</SecondaryButton>
  </>
);

const downloadCsv = (filename: string, rows: Array<Record<string, string | number>>) => {
  const headers = Object.keys(rows[0] ?? { empty: '' });
  const csv = [
    headers,
    ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replace(/"/g, '""')}"`)),
  ]
    .map((line) => line.join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const selectedSectionOptions = (sections: FeeSectionOption[], classId?: string) =>
  classId ? sections.filter((section) => section.classId === classId) : sections;

const structureTotal = (items?: FeeStructureItem[] | StructureDraftItem[]) =>
  (items ?? []).reduce((sum, item) => sum + numberValue((item as any).amount), 0);

export default function FeesWorkspace({ initialSection }: { initialSection?: FeeSectionId } = {}) {
  const notify = useNotify();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const routeSection = feeSectionFromPath(pathname);
  const selectedInvoiceId = searchParams.get('invoiceId') ?? '';
  const academicSessionQueryId = searchParams.get('academicSessionId') ?? '';
  const activeTab = initialSection ?? routeSection;
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedAcademicSessionId, setSelectedAcademicSessionId] = useState('');
  const [particularPage, setParticularPage] = useState(1);
  const [structurePage, setStructurePage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [discountPage, setDiscountPage] = useState(1);
  const [finePage, setFinePage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [particularSearch, setParticularSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<'' | FeeInvoiceStatus>('');
  const [invoiceFilters, setInvoiceFilters] = useState<{
    search: string;
    classId: string;
    sectionId: string;
    feeTypeId: string;
    feeMonth: string;
    dateFrom: string;
    dateTo: string;
    sortBy: FeeInvoiceSortBy;
    sortOrder: 'asc' | 'desc';
  }>({ search: '', classId: '', sectionId: '', feeTypeId: '', feeMonth: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'desc' });
  const [paymentFilters, setPaymentFilters] = useState<{ search: string; paymentMode: '' | FeePaymentMode; status: string }>({ search: '', paymentMode: '', status: '' });
  const [editingParticular, setEditingParticular] = useState<FeeParticular | null>(null);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [structureRows, setStructureRows] = useState<StructureDraftItem[]>([{ id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }]);
  const [selectedInvoice, setSelectedInvoice] = useState<FeeInvoice | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    receiptNumber: string;
    amount: number | string;
    receiptDate: string;
    paymentMode?: FeePaymentMode;
    allocations?: Array<{ invoiceId: string; allocatedAmount: number | string; invoice?: Partial<FeeInvoice> }>;
  } | null>(null);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [selectedCollectionStudentId, setSelectedCollectionStudentId] = useState('');
  const [collectionAllocations, setCollectionAllocations] = useState<Record<string, string>>({});
  const [ledgerStudentId, setLedgerStudentId] = useState('');
  const [reportFilters, setReportFilters] = useState<{
    type: FeeReportType;
    dateFrom: string;
    dateTo: string;
    classId: string;
    sectionId: string;
    studentId: string;
    feeTypeId: string;
    feeStructureId: string;
    paymentMode: '' | FeePaymentMode;
    status: string;
    collectedById: string;
  }>({ type: 'daily_collection', dateFrom: '', dateTo: '', classId: '', sectionId: '', studentId: '', feeTypeId: '', feeStructureId: '', paymentMode: '', status: '', collectedById: '' });
  const [editingDiscount, setEditingDiscount] = useState<FeeDiscount | null>(null);
  const [discountFilters, setDiscountFilters] = useState<{ search: string; status: '' | FeeApprovalStatus; targetType: '' | FeeDiscountTargetType }>({ search: '', status: '', targetType: '' });
  const [editingAssignment, setEditingAssignment] = useState<StudentFeeAssignment | null>(null);
  const [assignmentFilters, setAssignmentFilters] = useState({ search: '', classId: '', sectionId: '', feeStructureId: '', status: '' });
  const [fineFilters, setFineFilters] = useState<{ search: string; status: '' | FeeRecordStatus }>({ search: '', status: '' });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);


  const goToTab = useCallback((section: TabId, params?: Record<string, string>) => {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    router.push(`${feeSectionHref(section)}${query}`);
  }, [router]);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const role = session?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const can = useCallback(
    (permissionCode: string) => isSuperAdmin || isSchoolAdmin || permissionCodes.includes(permissionCode),
    [isSchoolAdmin, isSuperAdmin, permissionCodes],
  );
  const canViewSection = useCallback((section: TabId) => can(sectionViewPermissions[section]), [can]);
  const canUseFees = isSuperAdmin || isSchoolAdmin || permissionCodes.some((permissionCode) => permissionCode.startsWith('fees.'));
  const canCreateParticular = can('fees.particulars.create');
  const canUpdateParticular = can('fees.particulars.update');
  const canDeleteParticular = can('fees.particulars.delete');
  const canCreateFeeType = can('fees.types.create');
  const canUpdateFeeType = can('fees.types.update');
  const canDeleteFeeType = can('fees.types.delete');
  const canCreateStructure = can('fees.structures.create');
  const canUpdateStructure = can('fees.structures.update');
  const canDeleteStructure = can('fees.structures.delete');
  const canCreateAssignment = can('fees.assignments.create');
  const canUpdateAssignment = can('fees.assignments.update');
  const canDeleteAssignment = can('fees.assignments.delete');
  const canCreateInvoice = can('fees.invoice-generate.create');
  const canCancelInvoice = can('fees.invoices.cancel');
  const canCreateCollection = can('fees.collection.create');
  const canPrintReceipt = can('fees.receipts.print');
  const canCreateDiscount = can('fees.discounts.create');
  const canUpdateDiscount = can('fees.discounts.update');
  const canDeleteDiscount = can('fees.discounts.delete');
  const canApproveDiscount = can('fees.discounts.approve');
  const canCreateFine = can('fees.fines.create');
  const canDeleteFine = can('fees.fines.delete');
  const canLedgerExport = can('fees.ledger.export');
  const canReportsExport = can('fees.reports.export');

  const requestConfirmation = useCallback((action: ConfirmAction) => setConfirmAction(action), []);

  const schoolsQuery = useQuery({
    queryKey: ['fees', 'schools'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId]);

  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? '';
  const canQuery = Boolean(canUseFees && (!isSuperAdmin || effectiveSchoolId));
  const academicSessionStorageKey = effectiveSchoolId ? `fees:${effectiveSchoolId}:academicSessionId` : '';
  const readStoredAcademicSessionId = useCallback(() => {
    if (!academicSessionStorageKey || typeof window === 'undefined') return '';
    return window.localStorage.getItem(academicSessionStorageKey) ?? '';
  }, [academicSessionStorageKey]);
  const scope = useMemo<FeeScopeParams>(
    () => ({
      ...(isSuperAdmin && effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
      ...(selectedAcademicSessionId ? { academicSessionId: selectedAcademicSessionId } : {}),
    }),
    [effectiveSchoolId, isSuperAdmin, selectedAcademicSessionId],
  );

  const metadataQuery = useQuery({
    queryKey: ['fees', 'metadata', effectiveSchoolId, selectedAcademicSessionId],
    queryFn: () => getFeeMetadata(scope),
    enabled: canQuery,
  });

  const academicYearsFallbackQuery = useQuery({
    queryKey: ['fees', 'academic-years-fallback', effectiveSchoolId],
    queryFn: () => listAcademicYears(isSuperAdmin && effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined),
    enabled: canUseFees && (!isSuperAdmin || Boolean(effectiveSchoolId)),
  });

  useEffect(() => {
    const data = metadataQuery.data;
    if (!data) return;
    if (!ledgerStudentId && data.students.length) {
      setLedgerStudentId(data.students[0].id);
    }
  }, [metadataQuery.data, ledgerStudentId]);

  const metadata = metadataQuery.data;
  const academicSessions = useMemo(
    () => (metadata?.academicSessions?.length ? metadata.academicSessions : academicYearsFallbackQuery.data ?? []),
    [academicYearsFallbackQuery.data, metadata?.academicSessions],
  );

  useEffect(() => {
    if (!academicSessions.length) return;
    const validSessionIds = new Set(academicSessions.map((item: any) => item.id));
    const storedAcademicSessionId = readStoredAcademicSessionId();
    const nextAcademicSessionId = [
      academicSessionQueryId,
      selectedAcademicSessionId,
      storedAcademicSessionId,
      metadata?.academicSessionId,
      academicSessions.find((item: any) => item.isActive)?.id,
      academicSessions[0]?.id,
    ].find((id) => id && validSessionIds.has(id));
    if (nextAcademicSessionId && nextAcademicSessionId !== selectedAcademicSessionId) {
      setSelectedAcademicSessionId(nextAcademicSessionId);
    }
  }, [academicSessionQueryId, academicSessions, metadata?.academicSessionId, readStoredAcademicSessionId, selectedAcademicSessionId]);

  useEffect(() => {
    if (!selectedAcademicSessionId || !effectiveSchoolId) return;
    if (academicSessionStorageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(academicSessionStorageKey, selectedAcademicSessionId);
    }
    if (academicSessionQueryId !== selectedAcademicSessionId) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set('academicSessionId', selectedAcademicSessionId);
      router.replace(`${pathname}?${nextSearchParams.toString()}`, { scroll: false });
    }
  }, [academicSessionQueryId, academicSessionStorageKey, effectiveSchoolId, pathname, router, searchParams, selectedAcademicSessionId]);

  const scopedWithSession = useMemo<FeeScopeParams>(
    () => ({
      ...(isSuperAdmin && effectiveSchoolId ? { schoolId: effectiveSchoolId } : {}),
      ...(selectedAcademicSessionId || metadata?.academicSessionId ? { academicSessionId: selectedAcademicSessionId || metadata?.academicSessionId } : {}),
    }),
    [effectiveSchoolId, isSuperAdmin, metadata?.academicSessionId, selectedAcademicSessionId],
  );

  const particularsQuery = useQuery({
    queryKey: ['fees', 'particulars', effectiveSchoolId, scopedWithSession.academicSessionId, particularPage, particularSearch],
    queryFn: () => listFeeParticulars({ ...scopedWithSession, page: particularPage, limit: 10, search: particularSearch }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const feeTypesQuery = useQuery({
    queryKey: ['fees', 'types', effectiveSchoolId, scopedWithSession.academicSessionId],
    queryFn: () => listFeeTypes(scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const structuresQuery = useQuery({
    queryKey: ['fees', 'structures', effectiveSchoolId, scopedWithSession.academicSessionId, structurePage],
    queryFn: () => listFeeStructures({ ...scopedWithSession, page: structurePage, limit: 8 }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const assignmentsQuery = useQuery({
    queryKey: ['fees', 'assignments', effectiveSchoolId, scopedWithSession.academicSessionId, assignmentPage, assignmentFilters],
    queryFn: () => listFeeAssignments({
      ...scopedWithSession,
      page: assignmentPage,
      limit: 20,
      search: assignmentFilters.search || undefined,
      classId: assignmentFilters.classId || undefined,
      sectionId: assignmentFilters.sectionId || undefined,
      feeStructureId: assignmentFilters.feeStructureId || undefined,
      status: assignmentFilters.status || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const invoiceQueryParams = useMemo(
    () => ({
      ...scopedWithSession,
      page: invoicePage,
      limit: 10,
      search: invoiceFilters.search || undefined,
      classId: invoiceFilters.classId || undefined,
      sectionId: invoiceFilters.sectionId || undefined,
      feeTypeId: invoiceFilters.feeTypeId || undefined,
      feeMonth: invoiceFilters.feeMonth || undefined,
      status: invoiceStatus || undefined,
      dateFrom: invoiceFilters.dateFrom || undefined,
      dateTo: invoiceFilters.dateTo || undefined,
      sortBy: invoiceFilters.sortBy,
      sortOrder: invoiceFilters.sortOrder,
    }),
    [invoiceFilters, invoicePage, invoiceStatus, scopedWithSession],
  );
  const invoicesQuery = useQuery({
    queryKey: ['fees', 'invoices', effectiveSchoolId, scopedWithSession.academicSessionId, invoiceQueryParams],
    queryFn: () => listFeeInvoices(invoiceQueryParams),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const paymentsQuery = useQuery({
    queryKey: ['fees', 'payments', effectiveSchoolId, scopedWithSession.academicSessionId, paymentPage, paymentFilters],
    queryFn: () => listFeePayments({
      ...scopedWithSession,
      page: paymentPage,
      limit: 20,
      search: paymentFilters.search || undefined,
      paymentMode: paymentFilters.paymentMode || undefined,
      status: paymentFilters.status || undefined,
      sortBy: 'paymentDate',
      sortOrder: 'desc',
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const collectionStudentsQuery = useQuery({
    queryKey: ['fees', 'collection-students', effectiveSchoolId, scopedWithSession.academicSessionId, collectionSearch],
    queryFn: () => searchFeeCollectionStudents({ ...scopedWithSession, search: collectionSearch || undefined }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const collectionInvoicesQuery = useQuery({
    queryKey: ['fees', 'collection-invoices', effectiveSchoolId, scopedWithSession.academicSessionId, selectedCollectionStudentId],
    queryFn: () => listStudentCollectionInvoices(selectedCollectionStudentId, scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId && selectedCollectionStudentId),
  });
  const discountsQuery = useQuery({
    queryKey: ['fees', 'discounts', effectiveSchoolId, scopedWithSession.academicSessionId, discountPage, discountFilters],
    queryFn: () => listFeeDiscounts({
      ...scopedWithSession,
      page: discountPage,
      limit: 20,
      search: discountFilters.search || undefined,
      status: discountFilters.status || undefined,
      targetType: discountFilters.targetType || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const finesQuery = useQuery({
    queryKey: ['fees', 'fines', effectiveSchoolId, scopedWithSession.academicSessionId, finePage, fineFilters],
    queryFn: () => listFeeFines({
      ...scopedWithSession,
      page: finePage,
      limit: 20,
      search: fineFilters.search || undefined,
      status: fineFilters.status || undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const ledgerQuery = useQuery({
    queryKey: ['fees', 'ledger', effectiveSchoolId, scopedWithSession.academicSessionId, ledgerStudentId, ledgerPage],
    queryFn: () => getStudentFeeLedger(ledgerStudentId, {
      ...scopedWithSession,
      page: ledgerPage,
      limit: 30,
      sortBy: 'createdAt',
      sortOrder: 'asc',
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId && ledgerStudentId),
  });
  const reportsQuery = useQuery({
    queryKey: ['fees', 'reports', effectiveSchoolId, scopedWithSession.academicSessionId, reportFilters],
    queryFn: () => getFeeReports({
      ...scopedWithSession,
      type: reportFilters.type,
      dateFrom: reportFilters.dateFrom || undefined,
      dateTo: reportFilters.dateTo || undefined,
      classId: reportFilters.classId || undefined,
      sectionId: reportFilters.sectionId || undefined,
      studentId: reportFilters.studentId || undefined,
      feeTypeId: reportFilters.feeTypeId || undefined,
      feeStructureId: reportFilters.feeStructureId || undefined,
      paymentMode: reportFilters.paymentMode || undefined,
      status: reportFilters.status || undefined,
      collectedById: reportFilters.collectedById || undefined,
    }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });

  const particulars = particularsQuery.data?.items ?? metadata?.particulars ?? [];
  const feeTypes = feeTypesQuery.data ?? metadata?.feeTypes ?? [];
  const activeFeeTypes = useMemo(() => feeTypes.filter((type) => type.status === 'ACTIVE'), [feeTypes]);
  const [invoicePreview, setInvoicePreview] = useState<FeeInvoicePreviewResponse | null>(null);
  const structures = structuresQuery.data?.items ?? metadata?.structures ?? [];
  const invoices = invoicesQuery.data?.items ?? [];
  const payments = getListItems<FeePayment>(paymentsQuery.data);
  const assignments = assignmentsQuery.data?.items ?? [];
  const assignedStudents = assignmentsQuery.data?.assignedStudents ?? [];
  const unassignedStudents = assignmentsQuery.data?.unassignedStudents ?? [];
  const discounts = getListItems<FeeDiscount>(discountsQuery.data);
  const fines = getListItems<FeeFine>(finesQuery.data);
  const reports = reportsQuery.data;
  const reportRows = useMemo<FeeReportRow[]>(() => reports?.rows ?? [], [reports?.rows]);
  const reportColumns = useMemo(() => Object.keys(reportRows[0] ?? {}), [reportRows]);
  const classes = metadata?.classes ?? [];
  const sections = metadata?.sections ?? [];
  const students = metadata?.students ?? [];
  const studentCategories = metadata?.studentCategories ?? [];
  const studentGroups = metadata?.studentGroups ?? [];
  const transportRoutes = metadata?.transportRoutes ?? [];
  const collectionStudents = collectionStudentsQuery.data?.items ?? [];
  const collectionInvoices = collectionInvoicesQuery.data?.items ?? [];

  const handleReportExport = useCallback(async (format: FeeReportFormat) => {
    try {
      const blob = await exportFeeReports({
        ...scopedWithSession,
        type: reportFilters.type,
        dateFrom: reportFilters.dateFrom || undefined,
        dateTo: reportFilters.dateTo || undefined,
        classId: reportFilters.classId || undefined,
        sectionId: reportFilters.sectionId || undefined,
        studentId: reportFilters.studentId || undefined,
        feeTypeId: reportFilters.feeTypeId || undefined,
        feeStructureId: reportFilters.feeStructureId || undefined,
        paymentMode: reportFilters.paymentMode || undefined,
        status: reportFilters.status || undefined,
        collectedById: reportFilters.collectedById || undefined,
        format,
      });
      downloadBlob(`fee-${reportFilters.type}-report.${format}`, blob);
    } catch (error) {
      notify.error('Unable to export report', errorMessage(error));
    }
  }, [notify, reportFilters, scopedWithSession]);

  const invalidateFees = () => {
    queryClient.invalidateQueries({ queryKey: ['fees'] });
  };

  const particularForm = useForm<ParticularForm>({
    resolver: zodResolver(particularSchema) as any,
    defaultValues: { name: '', code: '', type: 'CHARGE', description: '', isMandatory: false, status: 'ACTIVE', sortOrder: 0 },
  });
  const feeTypeForm = useForm<FeeTypeForm>({
    resolver: zodResolver(feeTypeSchema) as any,
    defaultValues: { name: '', code: '', schedule: 'MONTHLY', description: '', status: 'ACTIVE', sortOrder: 0 },
  });
  const structureForm = useForm<StructureForm>({
    resolver: zodResolver(structureSchema) as any,
    defaultValues: { name: '', classId: '', sectionId: '', feeTypeId: '', effectiveFrom: today(), effectiveTo: '', status: 'ACTIVE' },
  });
  const assignmentForm = useForm<AssignmentForm>({
    resolver: zodResolver(assignmentSchema) as any,
    defaultValues: { feeStructureId: '', targetType: 'CLASS', classId: '', sectionId: '', studentId: '', studentIds: [], groupId: '', categoryId: '', transportRouteId: '', overrideAmount: undefined, startMonth: today().slice(0, 7), endMonth: '', status: 'ACTIVE', notes: '' },
  });
  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: { target: 'STUDENT', studentId: '', classId: '', sectionId: '', feeStructureId: '', feeTypeId: '', feeMonth: new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }), dueDate: today(), emailInvoice: false },
  });
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: { studentId: '', amount: 0, paymentDate: today(), paymentMode: 'CASH', transactionReference: '', chequeNumber: '', bankName: '', note: '' },
  });
  const discountForm = useForm<DiscountForm>({
    resolver: zodResolver(discountSchema) as any,
    defaultValues: { discountName: '', targetType: 'STUDENT', studentId: '', classId: '', sectionId: '', categoryId: '', feeTypeId: '', discountType: 'FIXED', discountValue: 0, amount: undefined, validFrom: today(), validTo: '', status: 'PENDING_APPROVAL', reason: '', note: '' },
  });
  const fineForm = useForm<FineForm>({
    resolver: zodResolver(fineSchema) as any,
    defaultValues: { name: '', particularId: '', fineType: 'FIXED', amount: 0, graceDays: 0, status: 'ACTIVE' },
  });

  const resetParticularForm = () => {
    setEditingParticular(null);
    particularForm.reset({ name: '', code: '', type: 'CHARGE', description: '', isMandatory: false, status: 'ACTIVE', sortOrder: 0 });
  };
  const resetFeeTypeForm = () => {
    setEditingFeeType(null);
    feeTypeForm.reset({ name: '', code: '', schedule: 'MONTHLY', description: '', status: 'ACTIVE', sortOrder: 0 });
  };
  const resetStructureForm = () => {
    setEditingStructure(null);
    structureForm.reset({ name: '', classId: '', sectionId: '', feeTypeId: '', effectiveFrom: today(), effectiveTo: '', status: 'ACTIVE' });
    setStructureRows([{ id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }]);
  };
  const resetAssignmentForm = () => {
    setEditingAssignment(null);
    assignmentForm.reset({ feeStructureId: '', targetType: 'CLASS', classId: '', sectionId: '', studentId: '', studentIds: [], groupId: '', categoryId: '', transportRouteId: '', overrideAmount: undefined, startMonth: today().slice(0, 7), endMonth: '', status: 'ACTIVE', notes: '' });
  };
  const resetDiscountForm = () => {
    setEditingDiscount(null);
    discountForm.reset({ discountName: '', targetType: 'STUDENT', studentId: '', classId: '', sectionId: '', categoryId: '', feeTypeId: '', discountType: 'FIXED', discountValue: 0, amount: undefined, validFrom: today(), validTo: '', status: 'PENDING_APPROVAL', reason: '', note: '' });
  };

  const saveParticularMutation = useMutation({
    mutationFn: (payload: ParticularForm) => {
      const body = { ...scopedWithSession, ...payload, description: payload.description || undefined, code: payload.code || undefined };
      return editingParticular ? updateFeeParticular(editingParticular.id, body) : createFeeParticular(body);
    },
    onSuccess: () => {
      notify.success(editingParticular ? 'Particular updated' : 'Particular added');
      resetParticularForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save particular', errorMessage(error)),
  });

  const saveFeeTypeMutation = useMutation({
    mutationFn: (payload: FeeTypeForm) => {
      const body = { ...scopedWithSession, ...payload, description: payload.description || undefined, code: payload.code || undefined };
      return editingFeeType ? updateFeeType(editingFeeType.id, body) : createFeeType(body);
    },
    onSuccess: () => {
      notify.success(editingFeeType ? 'Fee type updated' : 'Fee type added');
      resetFeeTypeForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save fee type', errorMessage(error)),
  });

  const saveStructureMutation = useMutation({
    mutationFn: (payload: StructureForm) => {
      const invalidAmountRow = structureRows.find((item) => item.particularId && Number(item.amount) <= 0);
      if (invalidAmountRow) throw new Error('Amount must be greater than 0.');
      const items = structureRows
        .filter((item) => item.particularId)
        .map((item, index) => ({ particularId: item.particularId, amount: Number(item.amount), isOptional: item.isOptional, sortOrder: index + 1 }));
      if (!items.length) throw new Error('Add at least one fee particular with amount.');
      const body = {
        ...scopedWithSession,
        ...payload,
        sectionId: payload.sectionId || null,
        name: payload.name || null,
        effectiveFrom: payload.effectiveFrom || null,
        effectiveTo: payload.effectiveTo || null,
        items,
      };
      return editingStructure ? updateFeeStructure(editingStructure.id, body) : createFeeStructure(body);
    },
    onSuccess: () => {
      notify.success(editingStructure ? 'Structure updated' : 'Structure added');
      resetStructureForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save structure', errorMessage(error)),
  });

  const deleteParticularMutation = useMutation({
    mutationFn: (id: string) => deleteFeeParticular(id, scopedWithSession),
    onSuccess: () => {
      notify.success('Particular removed');
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to remove particular', errorMessage(error)),
  });

  const deleteFeeTypeMutation = useMutation({
    mutationFn: (id: string) => deleteFeeType(id, scopedWithSession),
    onSuccess: () => {
      notify.success('Fee type removed');
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to remove fee type', errorMessage(error)),
  });

  const deleteStructureMutation = useMutation({
    mutationFn: (id: string) => deleteFeeStructure(id, scopedWithSession),
    onSuccess: () => {
      notify.success('Structure removed');
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to remove structure', errorMessage(error)),
  });

  const duplicateStructureMutation = useMutation({
    mutationFn: (structure: FeeStructure) => duplicateFeeStructure(structure.id, { ...scopedWithSession, classId: structure.classId, sectionId: structure.sectionId ?? null, name: `${structure.name} Copy` }),
    onSuccess: () => {
      notify.success('Structure duplicated');
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to duplicate structure', errorMessage(error)),
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: AssignmentForm) => {
      const requestPayload = {
        ...scopedWithSession,
        feeStructureId: payload.feeStructureId,
        targetType: payload.targetType,
        studentId: payload.targetType === 'STUDENT' ? payload.studentId || null : null,
        studentIds: payload.targetType === 'STUDENT' && payload.studentId ? [payload.studentId] : undefined,
        classId: payload.targetType === 'CLASS' || payload.targetType === 'SECTION' ? payload.classId : undefined,
        sectionId: payload.targetType === 'SECTION' ? payload.sectionId || null : undefined,
        groupId: payload.targetType === 'GROUP' ? payload.groupId || null : null,
        categoryId: payload.targetType === 'CATEGORY' ? payload.categoryId || null : null,
        transportRouteId: payload.targetType === 'TRANSPORT_ROUTE' ? payload.transportRouteId || null : null,
        overrideAmount: payload.overrideAmount ?? null,
        startMonth: payload.startMonth,
        endMonth: payload.endMonth || null,
        status: payload.status,
        autoAssigned: payload.targetType !== 'STUDENT',
        notes: payload.notes || null,
      };
      if (editingAssignment) {
        const assignment = await updateFeeAssignment(editingAssignment.id, requestPayload);
        return { assigned: 1, requested: 1, assignments: [assignment], assignedStudents: [] };
      }
      return assignStudentFees(requestPayload);
    },
    onSuccess: (result) => {
      const assignedCount = 'assigned' in result ? result.assigned : undefined;
      notify.success(editingAssignment ? 'Assignment updated' : 'Fee assigned', assignedCount === undefined ? undefined : `${assignedCount} active students matched.`);
      resetAssignmentForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to assign fee', errorMessage(error)),
  });

  const assignmentActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'delete' }) => {
      if (action === 'activate') return activateFeeAssignment(id, scopedWithSession);
      if (action === 'deactivate') return deactivateFeeAssignment(id, scopedWithSession);
      return deleteFeeAssignment(id, scopedWithSession);
    },
    onSuccess: (_, variables) => {
      notify.success(`Assignment ${variables.action}d`);
      if (editingAssignment?.id === variables.id) resetAssignmentForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to update assignment', errorMessage(error)),
  });

  const buildInvoicePayload = useCallback((payload: InvoiceForm) => ({
        ...scopedWithSession,
        target: payload.target,
        studentId: payload.target === 'STUDENT' ? payload.studentId : undefined,
        classId: payload.target === 'CLASS' || payload.target === 'SECTION' ? payload.classId : undefined,
        sectionId: payload.target === 'SECTION' ? payload.sectionId : undefined,
        feeStructureId: payload.feeStructureId || undefined,
        feeTypeId: payload.feeTypeId || undefined,
        feeMonth: payload.feeMonth,
        dueDate: payload.dueDate,
        emailInvoice: payload.emailInvoice,
      }), [scopedWithSession]);

  const invoicePreviewMutation = useMutation({
    mutationFn: (payload: InvoiceForm) => previewFeeInvoices(buildInvoicePayload(payload)),
    onSuccess: (result) => {
      setInvoicePreview(result);
      notify.success('Invoice preview ready', `${result.totals.generatableStudents} invoices ready, ${result.totals.duplicatesSkipped} duplicates marked.`);
    },
    onError: (error) => notify.error('Unable to preview invoices', errorMessage(error)),
  });

  const invoiceMutation = useMutation({
    mutationFn: (payload: InvoiceForm) => generateFeeInvoices(buildInvoicePayload(payload)),
    onSuccess: (result) => {
      notify.success('Invoices generated', `${result.generated.length} created, ${result.skipped.length} skipped.`);
      if (result.generated[0]) setSelectedInvoice(result.generated[0]);
      setInvoicePreview(null);
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to generate invoices', errorMessage(error)),
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: (invoice: FeeInvoice) => cancelFeeInvoice(invoice.id, scopedWithSession),
    onSuccess: (invoice) => {
      notify.success('Invoice cancelled', `${invoice.invoiceNumber} was cancelled.`);
      setSelectedInvoice(invoice);
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to cancel invoice', errorMessage(error)),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: PaymentForm) => {
      const allocations = Object.entries(collectionAllocations)
        .map(([invoiceId, value]) => ({ invoiceId, amount: numberValue(value) }))
        .filter((allocation) => allocation.amount > 0);
      return collectFeePayment({
        ...scopedWithSession,
        studentId: payload.studentId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        paymentMode: payload.paymentMode,
        transactionReference: payload.transactionReference || null,
        chequeNumber: payload.chequeNumber || null,
        bankName: payload.bankName || null,
        idempotencyKey: crypto.randomUUID(),
        allocations,
        note: payload.note || null,
      });
    },
    onSuccess: (result) => {
      notify.success('Payment collected', `Receipt ${result.receipt.receiptNumber} was created.`);
      setSelectedInvoice(result.invoices?.[0] ?? result.invoice);
      setSelectedReceipt({ ...result.receipt, paymentMode: result.payment.paymentMode, allocations: result.allocations });
      setCollectionAllocations({});
      paymentForm.reset({ studentId: selectedCollectionStudentId, amount: 0, paymentDate: today(), paymentMode: 'CASH', transactionReference: '', chequeNumber: '', bankName: '', note: '' });
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to collect payment', errorMessage(error)),
  });

  const discountMutation = useMutation({
    mutationFn: (payload: DiscountForm) =>
      (editingDiscount ? updateFeeDiscount(editingDiscount.id, {
        ...scopedWithSession,
        discountName: payload.discountName,
        targetType: payload.targetType,
        studentId: payload.targetType === 'STUDENT' ? payload.studentId || null : null,
        classId: payload.targetType === 'CLASS' || payload.targetType === 'SECTION' ? payload.classId || null : null,
        sectionId: payload.targetType === 'SECTION' ? payload.sectionId || null : null,
        categoryId: payload.targetType === 'CATEGORY' ? payload.categoryId || null : null,
        feeTypeId: payload.targetType === 'FEE_TYPE' ? payload.feeTypeId || null : null,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        amount: payload.amount ?? null,
        validFrom: payload.validFrom || null,
        validTo: payload.validTo || null,
        status: payload.status,
        reason: payload.reason || null,
        note: payload.note || null,
      }) : createFeeDiscount({
        ...scopedWithSession,
        discountName: payload.discountName,
        targetType: payload.targetType,
        studentId: payload.targetType === 'STUDENT' ? payload.studentId || null : null,
        classId: payload.targetType === 'CLASS' || payload.targetType === 'SECTION' ? payload.classId || null : null,
        sectionId: payload.targetType === 'SECTION' ? payload.sectionId || null : null,
        categoryId: payload.targetType === 'CATEGORY' ? payload.categoryId || null : null,
        feeTypeId: payload.targetType === 'FEE_TYPE' ? payload.feeTypeId || null : null,
        discountType: payload.discountType,
        discountValue: payload.discountValue,
        amount: payload.amount ?? null,
        validFrom: payload.validFrom || null,
        validTo: payload.validTo || null,
        status: payload.status,
        reason: payload.reason || null,
        note: payload.note || null,
      })),
    onSuccess: () => {
      notify.success(editingDiscount ? 'Discount updated' : 'Discount saved');
      resetDiscountForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save discount', errorMessage(error)),
  });

  const discountActionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' | 'activate' | 'deactivate' | 'delete' }) => {
      if (action === 'approve') return approveFeeDiscount(id, scopedWithSession);
      if (action === 'reject') return rejectFeeDiscount(id, scopedWithSession);
      if (action === 'activate') return activateFeeDiscount(id, scopedWithSession);
      if (action === 'deactivate') return deactivateFeeDiscount(id, scopedWithSession);
      return deleteFeeDiscount(id, scopedWithSession);
    },
    onSuccess: (_, variables) => {
      notify.success(`Discount ${variables.action}d`);
      if (editingDiscount?.id === variables.id) resetDiscountForm();
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to update discount', errorMessage(error)),
  });

  const fineMutation = useMutation({
    mutationFn: (payload: FineForm) =>
      createFeeFine({
        ...scopedWithSession,
        name: payload.name,
        particularId: payload.particularId || null,
        fineType: payload.fineType,
        amount: payload.amount,
        graceDays: payload.graceDays,
        status: payload.status,
      }),
    onSuccess: () => {
      notify.success('Fine rule saved');
      fineForm.reset({ name: '', particularId: '', fineType: 'FIXED', amount: 0, graceDays: 0, status: 'ACTIVE' });
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save fine', errorMessage(error)),
  });

  const deleteFineMutation = useMutation({
    mutationFn: (id: string) => deleteFeeFine(id, scopedWithSession),
    onSuccess: () => {
      notify.success('Fine rule deleted');
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to delete fine rule', errorMessage(error)),
  });

  const editParticular = (item: FeeParticular) => {
    setEditingParticular(item);
    particularForm.reset({
      name: item.name,
      code: item.code ?? '',
      type: item.type,
      description: item.description ?? '',
      isMandatory: item.isMandatory,
      status: item.status,
      sortOrder: item.sortOrder ?? 0,
    });
    goToTab('particulars');
  };

  const editFeeType = (item: FeeType) => {
    setEditingFeeType(item);
    feeTypeForm.reset({
      name: item.name,
      code: item.code ?? '',
      schedule: item.schedule,
      description: item.description ?? '',
      status: item.status,
      sortOrder: item.sortOrder ?? 0,
    });
    goToTab('types');
  };

  const editStructure = (item: FeeStructure) => {
    setEditingStructure(item);
    structureForm.reset({
      name: item.name ?? '',
      classId: item.classId,
      sectionId: item.sectionId ?? '',
      feeTypeId: item.feeTypeId,
      effectiveFrom: item.effectiveFrom ? item.effectiveFrom.slice(0, 10) : '',
      effectiveTo: item.effectiveTo ? item.effectiveTo.slice(0, 10) : '',
      status: item.status,
    });
    setStructureRows(
      item.items.length
        ? item.items.map((row) => ({ id: row.id ?? crypto.randomUUID(), particularId: row.particularId, amount: String(row.amount ?? ''), isOptional: row.isOptional }))
        : [{ id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }],
    );
    goToTab('structures');
  };

  const editAssignment = (item: StudentFeeAssignment) => {
    setEditingAssignment(item);
    assignmentForm.reset({
      feeStructureId: item.feeStructureId,
      targetType: item.targetType,
      classId: item.classId ?? '',
      sectionId: item.sectionId ?? '',
      studentId: item.studentId ?? '',
      studentIds: item.studentId ? [item.studentId] : [],
      groupId: item.groupId ?? '',
      categoryId: item.categoryId ?? '',
      transportRouteId: item.transportRouteId ?? '',
      overrideAmount: item.overrideAmount === null || item.overrideAmount === undefined ? undefined : numberValue(item.overrideAmount),
      startMonth: item.startMonth || today().slice(0, 7),
      endMonth: item.endMonth ?? '',
      status: item.status,
      notes: item.notes ?? '',
    });
    goToTab('assignments');
  };

  const editDiscount = (item: FeeDiscount) => {
    setEditingDiscount(item);
    discountForm.reset({
      discountName: item.discountName ?? labelize(item.discountType),
      targetType: item.targetType ?? 'STUDENT',
      studentId: item.studentId ?? '',
      classId: item.classId ?? '',
      sectionId: item.sectionId ?? '',
      categoryId: item.categoryId ?? '',
      feeTypeId: item.feeTypeId ?? '',
      discountType: item.valueType,
      discountValue: numberValue(item.value),
      amount: item.amount === null || item.amount === undefined ? undefined : numberValue(item.amount),
      validFrom: item.validFrom ? item.validFrom.slice(0, 10) : '',
      validTo: item.validTo ? item.validTo.slice(0, 10) : '',
      status: item.approvalStatus,
      reason: item.reason ?? '',
      note: item.note ?? '',
    });
    goToTab('discounts');
  };

  const watchedStructureClassId = structureForm.watch('classId');
  const watchedAssignmentTargetType = assignmentForm.watch('targetType');
  const watchedAssignmentClassId = assignmentForm.watch('classId');
  const watchedInvoiceTarget = invoiceForm.watch('target');
  const watchedInvoiceClassId = invoiceForm.watch('classId');
  const watchedPaymentMode = paymentForm.watch('paymentMode');
  const watchedDiscountClassId = discountForm.watch('classId');
  const watchedDiscountTargetType = discountForm.watch('targetType');

  useEffect(() => {
    paymentForm.setValue('studentId', selectedCollectionStudentId);
  }, [paymentForm, selectedCollectionStudentId]);

  const dueInvoices = useMemo(() => invoices.filter((invoice) => numberValue(invoice.dueAmount) > 0 && invoice.status !== 'CANCELLED'), [invoices]);
  const selectedCollectionStudent = useMemo(
    () => collectionStudents.find((student) => student.id === selectedCollectionStudentId) ?? students.find((student) => student.id === selectedCollectionStudentId) as FeeCollectionStudent | undefined,
    [collectionStudents, selectedCollectionStudentId, students],
  );
  const selectedAllocationRows = useMemo(
    () =>
      collectionInvoices
        .map((invoice) => ({ invoice, amount: numberValue(collectionAllocations[invoice.id]) }))
        .filter((row) => row.amount > 0),
    [collectionAllocations, collectionInvoices],
  );
  const selectedAllocationTotal = useMemo(
    () => selectedAllocationRows.reduce((sum, row) => sum + row.amount, 0),
    [selectedAllocationRows],
  );

  useEffect(() => {
    paymentForm.setValue('amount', selectedAllocationTotal);
  }, [paymentForm, selectedAllocationTotal]);

  useEffect(() => {
    if (!selectedInvoiceId || !collectionInvoices.length) return;
    const invoice = collectionInvoices.find((item) => item.id === selectedInvoiceId);
    if (!invoice) return;
    setSelectedInvoice(invoice);
    setCollectionAllocations((current) => ({ ...current, [invoice.id]: String(numberValue(invoice.dueAmount)) }));
  }, [collectionInvoices, selectedInvoiceId]);

  const totalDue = useMemo(() => invoices.reduce((sum, invoice) => sum + numberValue(invoice.dueAmount), 0), [invoices]);
  const totalCollected = reports?.totalCollected ?? payments.reduce((sum, payment) => sum + numberValue(payment.amount), 0);
  const reportMaxDaily = Math.max(1, ...Object.values(reports?.dailyCollection ?? { today: 0 }));
  const selectedLedgerStudent = students.find((student) => student.id === ledgerStudentId);

  const particularColumns = useMemo<ColumnDef<FeeParticular>[]>(
    () => [
      { header: 'Particular', accessorKey: 'name', cell: ({ row }) => <div><p className="font-bold text-slate-900">{row.original.name}</p><p className="text-xs text-slate-500">{row.original.code}</p></div> },
      { header: 'Type', accessorKey: 'type', cell: ({ row }) => <Badge tone={row.original.type === 'CHARGE' ? 'info' : 'neutral'}>{labelize(row.original.type)}</Badge> },
      { header: 'Mandatory', accessorKey: 'isMandatory', cell: ({ row }) => (row.original.isMandatory ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>) },
      { header: 'Status', accessorKey: 'status', cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status}</Badge> },
      {
        header: 'Action',
        cell: ({ row }) => (
          <div className="flex gap-2">
            {canUpdateParticular ? <IconButton title="Edit" onClick={() => editParticular(row.original)}>E</IconButton> : null}
            {canDeleteParticular ? (
              <IconButton
                title="Delete"
                tone="danger"
                onClick={() => requestConfirmation({
                  title: 'Delete fee particular',
                  itemName: row.original.name,
                  message: 'This will remove the fee label unless it is already used in a fee structure.',
                  confirmLabel: 'Delete',
                  onConfirm: () => deleteParticularMutation.mutate(row.original.id),
                })}
              >
                D
              </IconButton>
            ) : null}
          </div>
        ),
      },
    ],
    [canDeleteParticular, canUpdateParticular, deleteParticularMutation, requestConfirmation],
  );

  useEffect(() => {
    if (!selectedInvoiceId) return;
    const invoice = invoices.find((item) => item.id === selectedInvoiceId);
    if (!invoice || selectedInvoice?.id === invoice.id) return;
    setSelectedInvoice(invoice);
    setSelectedCollectionStudentId(invoice.studentId);
    paymentForm.setValue('studentId', invoice.studentId);
    setCollectionAllocations({ [invoice.id]: String(numberValue(invoice.dueAmount)) });
  }, [invoices, paymentForm, selectedInvoice?.id, selectedInvoiceId]);

  const invoiceColumns = useMemo<ColumnDef<FeeInvoice>[]>(
    () => [
      { header: 'Invoice', accessorKey: 'invoiceNumber', cell: ({ row }) => <div><p className="font-bold text-slate-900">{row.original.invoiceNumber}</p><p className="text-xs text-slate-500">{dateValue(row.original.issueDate)}</p></div> },
      { header: 'Student', cell: ({ row }) => <div><p className="font-semibold text-slate-900">{row.original.student?.fullName ?? '-'}</p><p className="text-xs text-slate-500">{row.original.student?.admissionNo ?? '-'}</p></div> },
      { header: 'Class', cell: ({ row }) => `${row.original.class?.name ?? '-'} ${row.original.section?.name ? `(${row.original.section.name})` : ''}` },
      { header: 'Fee Type', cell: ({ row }) => row.original.feeType?.name ?? '-' },
      { header: 'Month', cell: ({ row }) => row.original.feeMonth ?? '-' },
      { header: 'Due Date', cell: ({ row }) => dateValue(row.original.dueDate) },
      { header: 'Total', cell: ({ row }) => money(row.original.totalAmount) },
      { header: 'Paid', cell: ({ row }) => money(row.original.paidAmount) },
      { header: 'Balance', cell: ({ row }) => <span className="font-bold text-slate-950">{money(row.original.dueAmount)}</span> },
      { header: 'Status', cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{invoiceStatusLabel(row.original.status)}</Badge> },
      {
        header: 'Action',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <IconButton title="View invoice" onClick={() => setSelectedInvoice(row.original)}>V</IconButton>
            {canCreateCollection ? (
              <IconButton
                title="Collect"
                tone="success"
                onClick={() => {
                  setSelectedCollectionStudentId(row.original.studentId);
                  paymentForm.setValue('studentId', row.original.studentId);
                  setCollectionAllocations({ [row.original.id]: String(numberValue(row.original.dueAmount)) });
                  setSelectedInvoice(row.original);
                  goToTab('collection', { invoiceId: row.original.id });
                }}
              >
                C
              </IconButton>
            ) : null}
            {canPrintReceipt ? <IconButton title="Print" onClick={() => { setSelectedInvoice(row.original); setTimeout(() => window.print(), 100); }}>P</IconButton> : null}
            {canCancelInvoice ? (
              <IconButton
                title="Cancel"
                tone="danger"
                onClick={() => requestConfirmation({
                  title: 'Cancel invoice',
                  itemName: row.original.invoiceNumber,
                  message: 'Cancelled invoices are excluded from collection balances. This is allowed only before payment exists.',
                  confirmLabel: 'Cancel invoice',
                  tone: 'warning',
                  onConfirm: () => cancelInvoiceMutation.mutate(row.original),
                })}
              >
                X
              </IconButton>
            ) : null}
          </div>
        ),
      },
    ],
    [canCancelInvoice, canCreateCollection, canPrintReceipt, cancelInvoiceMutation, goToTab, paymentForm, requestConfirmation],
  );

  if (sessionLoading || !role) return <FullPageLoader label="Checking fee access..." />;
  if (!canUseFees) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Fee Management is not available</h1>
        <p className="mt-2 text-sm text-slate-500">Only School Admin and Accountant users can manage fee setup, invoices, collections, and reports.</p>
      </div>
    );
  }
  if (!canViewSection(activeTab)) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Fee page access denied</h1>
        <p className="mt-2 text-sm text-slate-500">Your account does not have {sectionViewPermissions[activeTab]} permission for this fee page.</p>
      </div>
    );
  }

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white">
      {confirmAction ? (
        <ConfirmDialog
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const nextAction = confirmAction;
            setConfirmAction(null);
            nextAction.onConfirm();
          }}
        />
      ) : null}
      <div className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-8">
        <PageHeader
          title={activeTab === 'overview' ? 'Fee Management' : activeTabMeta.label}
          subtitle={activeTabMeta.description}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Fee Management', href: '/dashboard/fees/overview' },
            ...(activeTab === 'overview' ? [] : [{ label: activeTabMeta.label }]),
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>Refresh</SecondaryButton>
              {canViewSection('collection') ? <PrimaryButton onClick={() => goToTab('collection')}>Collect Fee</PrimaryButton> : null}
            </div>
          }
        />

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="grid gap-3 md:grid-cols-3">
              {isSuperAdmin ? (
                <Field label="School">
                  <select className={inputClass} value={selectedSchoolId} onChange={(event) => { setSelectedSchoolId(event.target.value); setSelectedAcademicSessionId(''); }}>
                    <option value="">Select school</option>
                    {schoolsQuery.data?.items?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="School">
                  <input className={inputClass} value={session?.schoolName ?? 'Current school'} disabled />
                </Field>
              )}
              <Field label="Academic Session">
                <select className={inputClass} value={selectedAcademicSessionId} onChange={(event) => setSelectedAcademicSessionId(event.target.value)}>
                  {academicSessions.map((item: any) => (
                    <option key={item.id} value={item.id}>{item.name}{item.isActive ? ' - Active' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Search Particulars">
                <input className={inputClass} value={particularSearch} onChange={(event) => { setParticularSearch(event.target.value); setParticularPage(1); }} placeholder="Tuition, transport, fine..." />
              </Field>
            </div>
            {canReportsExport ? (
              <ExportButtons
                onPrint={() => window.print()}
                onCsv={() =>
                  downloadCsv(
                    'fee-invoices.csv',
                    invoices.map((invoice) => ({
                      invoice: invoice.invoiceNumber,
                      student: invoice.student?.fullName ?? '',
                      admission: invoice.student?.admissionNo ?? '',
                      total: numberValue(invoice.totalAmount),
                      paid: numberValue(invoice.paidAmount),
                      due: numberValue(invoice.dueAmount),
                      status: invoice.status,
                    })),
                  )
                }
              />
            ) : null}
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Collected" value={money(totalCollected)} note="Successful fee payments" />
          <StatCard label="Outstanding" value={money(reports?.totalOutstanding ?? totalDue)} note={`${dueInvoices.length} invoices with balance`} />
          <StatCard label="Invoiced" value={money(reports?.totalInvoiced ?? invoices.reduce((sum, invoice) => sum + numberValue(invoice.totalAmount), 0))} note="Current session invoices" />
          <StatCard label="Setup Coverage" value={`${structures.length} structures`} note={`${particulars.length} particulars, ${feeTypes.length} fee types`} />
        </div>

        {metadataQuery.isLoading ? <DashboardSkeleton /> : null}

        {metadataQuery.isError && !academicSessions.length ? (
          <Card
            title="Academic session required"
            subtitle="Fees load academic sessions from Academics > Academic Year. System Setup > Sessions is only a settings list and does not create fee-ready academic year records."
            actions={<SecondaryButton onClick={() => router.push('/dashboard/academics')}>Open Academic Year Setup</SecondaryButton>}
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <p className="font-black">Academic Session is not coming because the fee metadata API could not resolve an academic year for this school.</p>
              <p className="mt-2">{errorMessage(metadataQuery.error)}</p>
            </div>
          </Card>
        ) : null}

        {activeTab === 'overview' ? (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Fee Operations" subtitle="Use this module in order: setup particulars, create class structures, assign students, generate invoices, then collect payments.">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Particulars', `${particulars.length} active charge heads`, 'particulars'],
                  ['Fee Types', `${feeTypes.length} fee schedules`, 'types'],
                  ['Structures', `${structures.length} class-wise fee plans`, 'structures'],
                  ['Assignments', `${assignments.length} student mappings`, 'assignments'],
                  ['Generate Invoices', 'Create student invoices from assignments', 'invoice-generate'],
                  ['Invoice List', `${invoicesQuery.data?.pagination.total ?? invoices.length} generated invoices`, 'invoices'],
                  ['Collections', `${payments.length} recent payments`, 'collection'],
                  ['Discounts', `${discounts.length} waivers and concessions`, 'discounts'],
                  ['Fines', `${fines.length} fine rules`, 'fines'],
                  ['Reports', 'Collection, due, class-wise summary', 'reports'],
                ].filter(([, , tab]) => canViewSection(tab as TabId)).map(([title, note, tab]) => (
                  <button key={title} type="button" onClick={() => goToTab(tab as TabId)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50">
                    <p className="text-base font-black text-slate-950">{title}</p>
                    <p className="mt-1 text-sm text-slate-500">{note}</p>
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Transport & Challan Readiness" subtitle="Transport routes are available as fee inputs, and challan bank details stay under System Setup.">
              <div className="space-y-3">
                {(metadata?.transportRoutes ?? []).slice(0, 5).map((route) => (
                  <div key={route.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span className="font-bold text-slate-800">{route.title}</span>
                    <span className="text-sm font-black text-slate-950">{money(route.fare)}</span>
                  </div>
                ))}
                {!metadata?.transportRoutes?.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No transport routes are configured yet.</p> : null}
              </div>
            </Card>
            <Card title="Recent Invoices" actions={<SecondaryButton onClick={() => goToTab('invoices')}>View all</SecondaryButton>}>
              <DataTable columns={invoiceColumns.slice(0, 6)} data={invoices.slice(0, 5)} emptyMessage="No invoices generated yet." isLoading={invoicesQuery.isLoading} />
            </Card>
            <Card title="Daily Collection Trend">
              <div className="space-y-3">
                {Object.entries(reports?.dailyCollection ?? {}).slice(0, 10).map(([date, amount]) => (
                  <div key={date} className="grid gap-2 sm:grid-cols-[8rem_1fr_7rem] sm:items-center">
                    <span className="text-sm font-bold text-slate-600">{date}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(4, (amount / reportMaxDaily) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-black text-slate-950 sm:text-right">{money(amount)}</span>
                  </div>
                ))}
                {!Object.keys(reports?.dailyCollection ?? {}).length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No collections found for this session yet.</p> : null}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'particulars' ? (
          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <Card title={editingParticular ? 'Edit Fee Particular' : 'Add Fee Particular'} subtitle="Create charge heads such as tuition, transport, hostel, fine, discount, or previous balance.">
              <form className="space-y-3" onSubmit={particularForm.handleSubmit((payload) => (editingParticular ? canUpdateParticular : canCreateParticular) && saveParticularMutation.mutate(payload))}>
                <Field label="Name" error={particularForm.formState.errors.name?.message}>
                  <input className={inputClass} {...particularForm.register('name')} placeholder="Monthly Tuition Fee" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Code">
                    <input className={inputClass} {...particularForm.register('code')} placeholder="TUITION" />
                  </Field>
                  <Field label="Type">
                    <select className={inputClass} {...particularForm.register('type')}>
                      {particularTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <select className={inputClass} {...particularForm.register('status')}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Sort Order">
                    <input type="number" className={inputClass} {...particularForm.register('sortOrder')} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...particularForm.register('isMandatory')} />
                  Mandatory fee
                </label>
                <Field label="Description">
                  <textarea className={`${inputClass} min-h-20`} {...particularForm.register('description')} />
                </Field>
                <div className="flex gap-2">
                  {(editingParticular ? canUpdateParticular : canCreateParticular) ? <PrimaryButton type="submit" disabled={saveParticularMutation.isPending}>{editingParticular ? 'Update' : 'Save'}</PrimaryButton> : null}
                  {editingParticular ? <SecondaryButton onClick={resetParticularForm}>Cancel</SecondaryButton> : null}
                </div>
              </form>
            </Card>

            <Card
              title="Fee Particular List"
              actions={
                <div className="flex items-center gap-2">
                  <SecondaryButton disabled={particularPage <= 1} onClick={() => setParticularPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(particularsQuery.data?.pagination.totalPages ?? 1) <= particularPage} onClick={() => setParticularPage((page) => page + 1)}>Next</SecondaryButton>
                </div>
              }
            >
              <DataTable columns={particularColumns} data={particularsQuery.data?.items ?? []} emptyMessage="No fee particulars found." isLoading={particularsQuery.isLoading} />
            </Card>
          </div>
        ) : null}

        {activeTab === 'types' ? (
          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <Card title={editingFeeType ? 'Edit Fee Type' : 'Add Fee Type'} subtitle="Define schedules such as monthly, quarterly, yearly, or one-time fees.">
              <form className="space-y-3" onSubmit={feeTypeForm.handleSubmit((payload) => (editingFeeType ? canUpdateFeeType : canCreateFeeType) && saveFeeTypeMutation.mutate(payload))}>
                <Field label="Name" error={feeTypeForm.formState.errors.name?.message}>
                  <input className={inputClass} {...feeTypeForm.register('name')} placeholder="Monthly" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Code">
                    <input className={inputClass} {...feeTypeForm.register('code')} placeholder="MONTHLY" />
                  </Field>
                  <Field label="Schedule">
                    <select className={inputClass} {...feeTypeForm.register('schedule')}>
                      {schedules.map((schedule) => <option key={schedule} value={schedule}>{labelize(schedule)}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <select className={inputClass} {...feeTypeForm.register('status')}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <Field label="Sort Order">
                    <input type="number" className={inputClass} {...feeTypeForm.register('sortOrder')} />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea className={`${inputClass} min-h-16`} {...feeTypeForm.register('description')} />
                </Field>
                <div className="flex gap-2">
                  {(editingFeeType ? canUpdateFeeType : canCreateFeeType) ? <PrimaryButton type="submit" disabled={saveFeeTypeMutation.isPending}>{editingFeeType ? 'Update' : 'Save'}</PrimaryButton> : null}
                  {editingFeeType ? <SecondaryButton onClick={resetFeeTypeForm}>Cancel</SecondaryButton> : null}
                </div>
              </form>
            </Card>

            <Card title="Fee Type List">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Schedule</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {feeTypes.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-bold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.code}</p></td>
                        <td className="px-4 py-3">{labelize(item.schedule)}</td>
                        <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canUpdateFeeType ? <IconButton title="Edit" onClick={() => editFeeType(item)}>E</IconButton> : null}
                            {canDeleteFeeType ? (
                              <IconButton
                                title="Delete"
                                tone="danger"
                                onClick={() => requestConfirmation({
                                  title: 'Delete fee type',
                                  itemName: item.name,
                                  message: 'Inactive or unused fee types can be removed. Fee types already used by structures or invoices may be blocked by the server.',
                                  confirmLabel: 'Delete',
                                  onConfirm: () => deleteFeeTypeMutation.mutate(item.id),
                                })}
                              >
                                D
                              </IconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!feeTypes.length ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No fee types found.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}
        {activeTab === 'structures' ? (
          <div className="grid gap-5 xl:grid-cols-[0.84fr_1.16fr]">
            <Card title={editingStructure ? 'Edit Class Fee Structure' : 'Add Class Fee Structure'} subtitle="Build class-wise fee structures with one or more particulars.">
              <form className="space-y-4" onSubmit={structureForm.handleSubmit((payload) => (editingStructure ? canUpdateStructure : canCreateStructure) && saveStructureMutation.mutate(payload))}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Structure Name">
                    <input className={inputClass} {...structureForm.register('name')} placeholder="Class 1 Monthly Fee" />
                  </Field>
                  <Field label="Fee Type" error={structureForm.formState.errors.feeTypeId?.message}>
                    <select className={inputClass} {...structureForm.register('feeTypeId')}>
                      <option value="">Select type</option>
                      {activeFeeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class" error={structureForm.formState.errors.classId?.message}>
                    <select className={inputClass} {...structureForm.register('classId')}>
                      <option value="">Select class</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Section">
                    <select className={inputClass} {...structureForm.register('sectionId')}>
                      <option value="">All sections</option>
                      {selectedSectionOptions(sections, watchedStructureClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Effective From">
                    <input type="date" className={inputClass} {...structureForm.register('effectiveFrom')} />
                  </Field>
                  <Field label="Effective To">
                    <input type="date" className={inputClass} {...structureForm.register('effectiveTo')} />
                  </Field>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-black text-slate-900">Particular Items</p>
                    {(editingStructure ? canUpdateStructure : canCreateStructure) ? <PrimaryButton onClick={() => setStructureRows((rows) => [...rows, { id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }])}>Add Item</PrimaryButton> : null}
                  </div>
                  <div className="space-y-3">
                    {structureRows.map((row, index) => (
                      <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_9rem_7rem_3rem] md:items-end">
                        <Field label={`Particular ${index + 1}`}>
                          <select className={inputClass} value={row.particularId} onChange={(event) => setStructureRows((rows) => rows.map((item) => item.id === row.id ? { ...item, particularId: event.target.value } : item))}>
                            <option value="">Select particular</option>
                            {particulars.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </Field>
                        <Field label="Amount">
                          <input type="number" min="0.01" step="0.01" className={inputClass} value={row.amount} onChange={(event) => setStructureRows((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} />
                        </Field>
                        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                          <input type="checkbox" checked={row.isOptional} onChange={(event) => setStructureRows((rows) => rows.map((item) => item.id === row.id ? { ...item, isOptional: event.target.checked } : item))} />
                          Optional
                        </label>
                        {(editingStructure ? canUpdateStructure : canCreateStructure) ? <IconButton title="Remove item" tone="danger" onClick={() => setStructureRows((rows) => rows.length === 1 ? rows : rows.filter((item) => item.id !== row.id))}>D</IconButton> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end text-sm font-black text-slate-950">Total: {money(structureTotal(structureRows))}</div>
                </div>
                <div className="flex gap-2">
                  {(editingStructure ? canUpdateStructure : canCreateStructure) ? <PrimaryButton type="submit" disabled={saveStructureMutation.isPending}>{editingStructure ? 'Update Structure' : 'Save Structure'}</PrimaryButton> : null}
                  {editingStructure ? <SecondaryButton onClick={resetStructureForm}>Cancel</SecondaryButton> : null}
                </div>
              </form>
            </Card>

            <Card
              title="Class Fee Structure List"
              actions={
                <>
                  <SecondaryButton disabled={structurePage <= 1} onClick={() => setStructurePage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(structuresQuery.data?.pagination.totalPages ?? 1) <= structurePage} onClick={() => setStructurePage((page) => page + 1)}>Next</SecondaryButton>
                </>
              }
            >
              <div className="space-y-3">
                {structures.map((structure) => (
                  <div key={structure.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-black text-slate-950">{structure.name}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {structure.class?.name ?? '-'} {structure.section?.name ? `(${structure.section.name})` : '(All sections)'} Ãƒâ€šÃ‚Â· {structure.feeType?.name ?? '-'} Ãƒâ€šÃ‚Â· {money(structureTotal(structure.items))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge tone={statusTone(structure.status)}>{structure.status}</Badge>
                        {canUpdateStructure ? <IconButton title="Edit" onClick={() => editStructure(structure)}>E</IconButton> : null}
                        {canCreateStructure ? <IconButton title="Duplicate" onClick={() => duplicateStructureMutation.mutate(structure)}>C</IconButton> : null}
                        {canDeleteStructure ? (
                          <IconButton
                            title="Delete"
                            tone="danger"
                            onClick={() => requestConfirmation({
                              title: 'Delete fee structure',
                              itemName: structure.name,
                              message: 'This will remove the structure only if it is not assigned and no invoice has been generated from it.',
                              confirmLabel: 'Delete',
                              onConfirm: () => deleteStructureMutation.mutate(structure.id),
                            })}
                          >
                            D
                          </IconButton>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {structure.items.map((item) => (
                        <div key={`${structure.id}-${item.particularId}-${item.sortOrder}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-bold text-slate-700">{item.particular?.name ?? 'Particular'}</span>
                          <span className="font-black text-slate-950">{money(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!structures.length ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No structures have been created yet.</div> : null}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'assignments' ? (
          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <Card
              title={editingAssignment ? 'Edit Fee Assignment' : 'Assign Fee Structure'}
              subtitle="Assign a structure by class, section, student, group, category, or transport route."
              actions={editingAssignment ? <SecondaryButton onClick={resetAssignmentForm}>Cancel</SecondaryButton> : null}
            >
              <form className="space-y-3" onSubmit={assignmentForm.handleSubmit((payload) => (editingAssignment ? canUpdateAssignment : canCreateAssignment) && assignMutation.mutate(payload))}>
                <Field label="Fee Structure" error={assignmentForm.formState.errors.feeStructureId?.message}>
                  <select className={inputClass} {...assignmentForm.register('feeStructureId')}>
                    <option value="">Select structure</option>
                    {structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name} - {structure.class?.name}</option>)}
                  </select>
                </Field>
                <Field label="Target Type">
                  <select className={inputClass} {...assignmentForm.register('targetType')}>
                    {assignmentTargetTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {watchedAssignmentTargetType === 'CLASS' || watchedAssignmentTargetType === 'SECTION' ? (
                    <Field label="Class" error={assignmentForm.formState.errors.classId?.message}>
                      <select className={inputClass} {...assignmentForm.register('classId')}>
                        <option value="">Select class</option>
                        {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedAssignmentTargetType === 'SECTION' ? (
                    <Field label="Section" error={assignmentForm.formState.errors.sectionId?.message}>
                      <select className={inputClass} {...assignmentForm.register('sectionId')}>
                        <option value="">Select section</option>
                        {selectedSectionOptions(sections, watchedAssignmentClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedAssignmentTargetType === 'STUDENT' ? (
                    <Field label="Student" error={assignmentForm.formState.errors.studentId?.message}>
                      <select className={inputClass} {...assignmentForm.register('studentId')}>
                        <option value="">Select student</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedAssignmentTargetType === 'GROUP' ? (
                    <Field label="Group" error={assignmentForm.formState.errors.groupId?.message}>
                      <select className={inputClass} {...assignmentForm.register('groupId')}>
                        <option value="">Select group</option>
                        {studentGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedAssignmentTargetType === 'CATEGORY' ? (
                    <Field label="Category" error={assignmentForm.formState.errors.categoryId?.message}>
                      <select className={inputClass} {...assignmentForm.register('categoryId')}>
                        <option value="">Select category</option>
                        {studentCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedAssignmentTargetType === 'TRANSPORT_ROUTE' ? (
                    <Field label="Transport Route" error={assignmentForm.formState.errors.transportRouteId?.message}>
                      <select className={inputClass} {...assignmentForm.register('transportRouteId')}>
                        <option value="">Select route</option>
                        {transportRoutes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                      </select>
                    </Field>
                  ) : null}
                  <Field label="Override Amount" error={assignmentForm.formState.errors.overrideAmount?.message}>
                    <input type="number" min="0" step="0.01" className={inputClass} {...assignmentForm.register('overrideAmount')} placeholder="Optional" />
                  </Field>
                  <Field label="Start Month" error={assignmentForm.formState.errors.startMonth?.message}>
                    <input type="month" className={inputClass} {...assignmentForm.register('startMonth')} />
                  </Field>
                  <Field label="End Month" error={assignmentForm.formState.errors.endMonth?.message}>
                    <input type="month" className={inputClass} {...assignmentForm.register('endMonth')} />
                  </Field>
                  <Field label="Status">
                    <select className={inputClass} {...assignmentForm.register('status')}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                </div>
                <Field label="Notes">
                  <textarea className={`${inputClass} min-h-20`} {...assignmentForm.register('notes')} />
                </Field>
                {(editingAssignment ? canUpdateAssignment : canCreateAssignment) ? <PrimaryButton type="submit" disabled={assignMutation.isPending}>{editingAssignment ? 'Update Assignment' : 'Assign Fees'}</PrimaryButton> : null}
              </form>
            </Card>

            <Card title="Student Fee Assignments" subtitle="Review assignment targets and matched assigned/unassigned students.">
              <div className="mb-4 grid gap-3 md:grid-cols-5">
                <Field label="Search">
                  <input
                    className={inputClass}
                    value={assignmentFilters.search}
                    onChange={(event) => {
                      setAssignmentFilters((current) => ({ ...current, search: event.target.value }));
                      setAssignmentPage(1);
                    }}
                    placeholder="Student, admission, structure..."
                  />
                </Field>
                <Field label="Class Filter">
                  <select className={inputClass} value={assignmentFilters.classId} onChange={(event) => { setAssignmentFilters((current) => ({ ...current, classId: event.target.value, sectionId: '' })); setAssignmentPage(1); }}>
                    <option value="">All classes</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Section Filter">
                  <select className={inputClass} value={assignmentFilters.sectionId} onChange={(event) => { setAssignmentFilters((current) => ({ ...current, sectionId: event.target.value })); setAssignmentPage(1); }}>
                    <option value="">All sections</option>
                    {selectedSectionOptions(sections, assignmentFilters.classId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Structure Filter">
                  <select className={inputClass} value={assignmentFilters.feeStructureId} onChange={(event) => { setAssignmentFilters((current) => ({ ...current, feeStructureId: event.target.value })); setAssignmentPage(1); }}>
                    <option value="">All structures</option>
                    {structures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputClass} value={assignmentFilters.status} onChange={(event) => { setAssignmentFilters((current) => ({ ...current, status: event.target.value as FeeRecordStatus | '' })); setAssignmentPage(1); }}>
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Target</th><th className="px-4 py-3">Structure</th><th className="px-4 py-3">Override</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.slice(0, 80).map((item: StudentFeeAssignment) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-bold text-slate-900">{labelize(item.targetType)}</p><p className="text-xs text-slate-500">{item.student?.fullName ?? item.class?.name ?? item.section?.name ?? item.group?.name ?? item.category?.name ?? item.transportRoute?.title ?? '-'}</p></td>
                        <td className="px-4 py-3">{item.feeStructure?.name ?? '-'}</td>
                        <td className="px-4 py-3">{item.overrideAmount ? money(item.overrideAmount) : '-'}</td>
                        <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canUpdateAssignment ? <IconButton title="Edit" onClick={() => editAssignment(item)}>E</IconButton> : null}
                            {canUpdateAssignment && item.status === 'INACTIVE' ? <IconButton title="Activate" tone="success" onClick={() => assignmentActionMutation.mutate({ id: item.id, action: 'activate' })}>A</IconButton> : null}
                            {canUpdateAssignment && item.status === 'ACTIVE' ? <IconButton title="Deactivate" onClick={() => assignmentActionMutation.mutate({ id: item.id, action: 'deactivate' })}>I</IconButton> : null}
                            {canDeleteAssignment ? (
                              <IconButton
                                title="Delete"
                                tone="danger"
                                onClick={() => requestConfirmation({
                                  title: 'Delete fee assignment',
                                  itemName: item.student?.fullName ?? item.class?.name ?? item.section?.name ?? item.group?.name ?? item.category?.name ?? item.transportRoute?.title ?? item.feeStructure?.name ?? 'Assignment',
                                  message: 'This removes the assignment target. Existing generated invoices remain unchanged.',
                                  confirmLabel: 'Delete',
                                  onConfirm: () => assignmentActionMutation.mutate({ id: item.id, action: 'delete' }),
                                })}
                              >
                                D
                              </IconButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!assignments.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No assignments yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>Page {assignmentPage} of {assignmentsQuery.data?.pagination.totalPages ?? 1}</span>
                <div className="flex gap-2">
                  <SecondaryButton disabled={assignmentPage <= 1} onClick={() => setAssignmentPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(assignmentsQuery.data?.pagination.totalPages ?? 1) <= assignmentPage} onClick={() => setAssignmentPage((page) => page + 1)}>Next</SecondaryButton>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="font-black text-emerald-900">Assigned Students ({assignedStudents.length})</p>
                  <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
                    {assignedStudents.map((student) => <p key={student.id} className="rounded-xl bg-white px-3 py-2">{student.fullName} <span className="text-slate-500">({student.admissionNo})</span></p>)}
                    {!assignedStudents.length ? <p className="text-emerald-700">No students matched active assignments.</p> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="font-black text-amber-900">Unassigned Students ({unassignedStudents.length})</p>
                  <div className="mt-2 max-h-52 space-y-2 overflow-auto text-sm">
                    {unassignedStudents.map((student) => <p key={student.id} className="rounded-xl bg-white px-3 py-2">{student.fullName} <span className="text-slate-500">({student.admissionNo})</span></p>)}
                    {!unassignedStudents.length ? <p className="text-amber-700">All filtered students are assigned.</p> : null}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'invoice-generate' ? (
          <div className="space-y-5">
            <Card title="Generate Invoices" subtitle="Generate invoices by student, class, section, or full school using active assignments and structures.">
              <form className="grid gap-3 lg:grid-cols-5 lg:items-end" onSubmit={invoiceForm.handleSubmit((payload) => { setInvoicePreview(null); invoicePreviewMutation.mutate(payload); })}>
                <Field label="Target">
                  <select className={inputClass} {...invoiceForm.register('target')}>
                    <option value="STUDENT">Student</option>
                    <option value="CLASS">Class</option>
                    <option value="SECTION">Section</option>
                    <option value="SCHOOL">School</option>
                  </select>
                </Field>
                {watchedInvoiceTarget === 'STUDENT' ? (
                  <Field label="Student">
                    <select className={inputClass} {...invoiceForm.register('studentId')}>
                      <option value="">Select student</option>
                      {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                    </select>
                  </Field>
                ) : null}
                {watchedInvoiceTarget === 'CLASS' || watchedInvoiceTarget === 'SECTION' ? (
                  <Field label="Class">
                    <select className={inputClass} {...invoiceForm.register('classId')}>
                      <option value="">Select class</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                ) : null}
                {watchedInvoiceTarget === 'SECTION' ? (
                  <Field label="Section">
                    <select className={inputClass} {...invoiceForm.register('sectionId')}>
                      <option value="">Select section</option>
                      {selectedSectionOptions(sections, watchedInvoiceClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                ) : null}
                <Field label="Structure">
                  <select className={inputClass} {...invoiceForm.register('feeStructureId')}>
                    <option value="">Auto match</option>
                    {structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee Type">
                  <select className={inputClass} {...invoiceForm.register('feeTypeId')}>
                    <option value="">Any type</option>
                    {activeFeeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee Month">
                  <input className={inputClass} {...invoiceForm.register('feeMonth')} />
                </Field>
                <Field label="Due Date">
                  <input type="date" className={inputClass} {...invoiceForm.register('dueDate')} />
                </Field>
                <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
                  <input type="checkbox" {...invoiceForm.register('emailInvoice')} />
                  Queue notice
                </label>
                <PrimaryButton type="submit" disabled={invoicePreviewMutation.isPending}>{invoicePreviewMutation.isPending ? 'Previewing...' : 'Preview Invoices'}</PrimaryButton>
              </form>
              {invoicePreview ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Students</p><p className="text-xl font-black text-slate-900">{invoicePreview.totals.totalStudents}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Base</p><p className="text-xl font-black text-slate-900">{money(invoicePreview.totals.totalBaseAmount)}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Discount</p><p className="text-xl font-black text-emerald-700">{money(invoicePreview.totals.totalDiscount)}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Fine</p><p className="text-xl font-black text-rose-700">{money(invoicePreview.totals.totalFine)}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Previous</p><p className="text-xl font-black text-amber-700">{money(invoicePreview.totals.totalPreviousBalance)}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Net Payable</p><p className="text-xl font-black text-slate-900">{money(invoicePreview.totals.totalNetPayable)}</p></div>
                  </div>
                  {invoicePreview.excludedStudentIds.length ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
                      {invoicePreview.excludedStudentIds.length} selected student(s) were excluded because they are inactive, transferred, disabled, deleted, or outside this session.
                    </div>
                  ) : null}
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Student</th>
                          <th className="px-3 py-2">Class</th>
                          <th className="px-3 py-2">Structure</th>
                          <th className="px-3 py-2">Base</th>
                          <th className="px-3 py-2">Discount</th>
                          <th className="px-3 py-2">Fine</th>
                          <th className="px-3 py-2">Previous</th>
                          <th className="px-3 py-2">Net</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {invoicePreview.rows.map((row) => (
                          <tr key={row.studentId} className={row.duplicateInvoiceExists || !row.canGenerate ? 'bg-amber-50/60' : undefined}>
                            <td className="px-3 py-2 font-bold text-slate-900">{row.studentName}<p className="text-xs font-semibold text-slate-500">{row.admissionNumber}</p></td>
                            <td className="px-3 py-2 text-slate-700">{row.className ?? '-'} {row.sectionName ? `- ${row.sectionName}` : ''}</td>
                            <td className="px-3 py-2 text-slate-700">{row.feeStructureName ?? 'Missing'}<p className="text-xs text-slate-500">{row.feeTypeName ?? ''}</p></td>
                            <td className="px-3 py-2">{money(row.baseAmount)}</td>
                            <td className="px-3 py-2 text-emerald-700">{money(row.discountAmount)}</td>
                            <td className="px-3 py-2 text-rose-700">{money(row.fineAmount)}</td>
                            <td className="px-3 py-2 text-amber-700">{money(row.previousBalance)}</td>
                            <td className="px-3 py-2 font-black">{money(row.netPayable)}</td>
                            <td className="px-3 py-2">
                              {row.canGenerate ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">Ready</span> : <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">Skipped</span>}
                              {row.warnings.length ? <p className="mt-1 max-w-xs text-xs font-semibold text-amber-700">{row.warnings.join(', ')}</p> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!invoicePreview.rows.length ? <div className="p-6 text-center text-sm font-bold text-slate-500">No eligible students found for this preview.</div> : null}
                  </div>
                  {canCreateInvoice ? (
                    <PrimaryButton
                      type="button"
                      disabled={invoiceMutation.isPending || invoicePreview.totals.generatableStudents <= 0}
                      onClick={() => {
                        const values = invoiceForm.getValues();
                        if (window.confirm(`Generate invoices for ${invoicePreview.totals.generatableStudents} students with total amount ${money(invoicePreview.totals.totalNetPayable)}?`)) {
                          invoiceMutation.mutate(values);
                        }
                      }}
                    >
                      {invoiceMutation.isPending ? 'Generating...' : 'Generate Confirmed Invoices'}
                    </PrimaryButton>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}

        {activeTab === 'invoices' ? (
          <div className="space-y-5">
            <Card
              title="Invoice List"
              actions={
                <>
                  <select className={inputClass} value={invoiceStatus} onChange={(event) => { setInvoiceStatus(event.target.value as '' | FeeInvoiceStatus); setInvoicePage(1); }}>
                    {invoiceStatuses.map((status) => <option key={status || 'ALL'} value={status}>{status ? invoiceStatusLabel(status as FeeInvoiceStatus) : 'All Status'}</option>)}
                  </select>
                  <SecondaryButton disabled={invoicePage <= 1} onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(invoicesQuery.data?.pagination.totalPages ?? 1) <= invoicePage} onClick={() => setInvoicePage((page) => page + 1)}>Next</SecondaryButton>
                </>
              }
            >
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Search">
                  <input
                    className={inputClass}
                    value={invoiceFilters.search}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, search: event.target.value }));
                    }}
                    placeholder="Student, admission no, invoice, class, section, fee type"
                  />
                </Field>
                <Field label="Class">
                  <select
                    className={inputClass}
                    value={invoiceFilters.classId}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, classId: event.target.value, sectionId: '' }));
                    }}
                  >
                    <option value="">All classes</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Section">
                  <select
                    className={inputClass}
                    value={invoiceFilters.sectionId}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, sectionId: event.target.value }));
                    }}
                  >
                    <option value="">All sections</option>
                    {selectedSectionOptions(sections, invoiceFilters.classId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee Type">
                  <select
                    className={inputClass}
                    value={invoiceFilters.feeTypeId}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, feeTypeId: event.target.value }));
                    }}
                  >
                    <option value="">All fee types</option>
                    {feeTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee Month">
                  <input
                    className={inputClass}
                    value={invoiceFilters.feeMonth}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, feeMonth: event.target.value }));
                    }}
                    placeholder="2026-06 or June 2026"
                  />
                </Field>
                <Field label="Invoice From">
                  <input
                    type="date"
                    className={inputClass}
                    value={invoiceFilters.dateFrom}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, dateFrom: event.target.value }));
                    }}
                  />
                </Field>
                <Field label="Invoice To">
                  <input
                    type="date"
                    className={inputClass}
                    value={invoiceFilters.dateTo}
                    onChange={(event) => {
                      setInvoicePage(1);
                      setInvoiceFilters((filters) => ({ ...filters, dateTo: event.target.value }));
                    }}
                  />
                </Field>
                <Field label="Sort">
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      className={inputClass}
                      value={invoiceFilters.sortBy}
                      onChange={(event) => {
                        setInvoicePage(1);
                        setInvoiceFilters((filters) => ({ ...filters, sortBy: event.target.value as FeeInvoiceSortBy }));
                      }}
                    >
                      <option value="createdAt">Created</option>
                      <option value="invoiceDate">Invoice date</option>
                      <option value="dueDate">Due date</option>
                      <option value="feeMonth">Fee month</option>
                      <option value="totalAmount">Total amount</option>
                      <option value="paidAmount">Paid amount</option>
                      <option value="balanceAmount">Balance amount</option>
                    </select>
                    <select
                      className={inputClass}
                      value={invoiceFilters.sortOrder}
                      onChange={(event) => {
                        setInvoicePage(1);
                        setInvoiceFilters((filters) => ({ ...filters, sortOrder: event.target.value as 'asc' | 'desc' }));
                      }}
                    >
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </select>
                  </div>
                </Field>
                <div className="flex items-end">
                  <SecondaryButton
                    onClick={() => {
                      setInvoicePage(1);
                      setInvoiceStatus('');
                      setInvoiceFilters({ search: '', classId: '', sectionId: '', feeTypeId: '', feeMonth: '', dateFrom: '', dateTo: '', sortBy: 'createdAt', sortOrder: 'desc' });
                    }}
                  >
                    Reset Filters
                  </SecondaryButton>
                </div>
              </div>
              <DataTable columns={invoiceColumns} data={invoices} emptyMessage="No invoices found." isLoading={invoicesQuery.isLoading} />
            </Card>
          </div>
        ) : null}
        {activeTab === 'collection' ? (
          <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <Card title="Search Student" subtitle="Find a student by name, admission number, roll number, class, section, or phone.">
                <div className="space-y-3">
                  <Field label="Search">
                    <input
                      className={inputClass}
                      value={collectionSearch}
                      onChange={(event) => setCollectionSearch(event.target.value)}
                      placeholder="Name, admission no, roll no, class, section, phone"
                    />
                  </Field>
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {collectionStudents.map((student) => (
                      <button
                        type="button"
                        key={student.id}
                        onClick={() => {
                          setSelectedCollectionStudentId(student.id);
                          paymentForm.setValue('studentId', student.id);
                          setCollectionAllocations({});
                          setSelectedInvoice(null);
                          setSelectedReceipt(null);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selectedCollectionStudentId === student.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{student.fullName}</p>
                            <p className="text-xs text-slate-500">
                              {student.admissionNo}
                              {student.rollNo ? ` - Roll ${student.rollNo}` : ''}
                              {' - '}
                              {student.class?.name ?? classes.find((item) => item.id === student.classId)?.name ?? '-'}
                              {student.section?.name ? ` (${student.section.name})` : ''}
                            </p>
                            <p className="text-xs text-slate-500">{student.phone ?? student.parentPhone ?? '-'}</p>
                          </div>
                          <div className="text-right">
                            <Badge tone={numberValue(student.pendingAmount) > 0 ? 'warning' : 'success'}>{student.pendingInvoiceCount} due</Badge>
                            <p className="mt-1 text-sm font-black text-slate-950">{money(student.pendingAmount)}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {!collectionStudents.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No students found.</p> : null}
                  </div>
                </div>
              </Card>

              <Card title="Collect Payment" subtitle="Select one or more unpaid invoices and create one receipt.">
                <form
                  className="space-y-4"
                  onSubmit={paymentForm.handleSubmit((payload) => {
                    if (!canCreateCollection) {
                      notify.error('You do not have permission to collect fees');
                      return;
                    }
                    if (!selectedAllocationRows.length) {
                      notify.error('Select at least one invoice');
                      return;
                    }
                    paymentMutation.mutate({ ...payload, amount: selectedAllocationTotal });
                  })}
                >
                  <input type="hidden" {...paymentForm.register('studentId')} />
                  {selectedCollectionStudent ? (
                    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
                      <StatCard label="Student" value={selectedCollectionStudent.fullName} note={selectedCollectionStudent.admissionNo} />
                      <StatCard label="Class" value={selectedCollectionStudent.class?.name ?? classes.find((item) => item.id === selectedCollectionStudent.classId)?.name ?? '-'} note={selectedCollectionStudent.section?.name ?? ''} />
                      <StatCard label="Pending" value={money(collectionInvoices.reduce((sum, invoice) => sum + numberValue(invoice.dueAmount), 0))} note={`${collectionInvoices.length} unpaid invoice(s)`} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Select a student to load unpaid invoices.</div>
                  )}

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Select</th>
                          <th className="px-4 py-3">Invoice</th>
                          <th className="px-4 py-3">Month / Type</th>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-right">Discount</th>
                          <th className="px-4 py-3 text-right">Fine</th>
                          <th className="px-4 py-3 text-right">Paid</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Allocation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {collectionInvoices.map((invoice) => {
                          const selected = numberValue(collectionAllocations[invoice.id]) > 0;
                          return (
                            <tr key={invoice.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={!canCreateCollection}
                                  onChange={(event) => {
                                    setCollectionAllocations((current) => {
                                      const next = { ...current };
                                      if (event.target.checked) next[invoice.id] = String(numberValue(invoice.dueAmount));
                                      else delete next[invoice.id];
                                      return next;
                                    });
                                    setSelectedInvoice(invoice);
                                  }}
                                />
                              </td>
                              <td className="px-4 py-3 font-bold text-slate-900">{invoice.invoiceNumber}</td>
                              <td className="px-4 py-3">
                                {invoice.feeMonth ?? 'Current period'}
                                <p className="text-xs text-slate-500">{invoice.feeType?.name ?? '-'}</p>
                              </td>
                              <td className="px-4 py-3">{dateValue(invoice.dueDate)}</td>
                              <td className="px-4 py-3 text-right">{money(invoice.totalAmount)}</td>
                              <td className="px-4 py-3 text-right">{money(invoice.discountAmount)}</td>
                              <td className="px-4 py-3 text-right">{money(invoice.fineAmount)}</td>
                              <td className="px-4 py-3 text-right">{money(invoice.paidAmount)}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-950">{money(invoice.dueAmount)}</td>
                              <td className="px-4 py-3"><Badge tone={statusTone(invoice.status)}>{labelize(invoice.status)}</Badge></td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  max={numberValue(invoice.dueAmount)}
                                  step="0.01"
                                  className={`${inputClass} w-32 text-right`}
                                  value={collectionAllocations[invoice.id] ?? ''}
                                  disabled={!canCreateCollection}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setCollectionAllocations((current) => {
                                      const next = { ...current };
                                      if (!value || numberValue(value) <= 0) delete next[invoice.id];
                                      else next[invoice.id] = value;
                                      return next;
                                    });
                                    setSelectedInvoice(invoice);
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                        {selectedCollectionStudentId && !collectionInvoices.length ? (
                          <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">No unpaid invoices found for this student.</td></tr>
                        ) : null}
                        {!selectedCollectionStudentId ? (
                          <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Search and select a student first.</td></tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Total Selected" error={paymentForm.formState.errors.amount?.message}>
                      <input type="number" min="1" className={inputClass} readOnly {...paymentForm.register('amount')} />
                    </Field>
                    <Field label="Payment Date" error={paymentForm.formState.errors.paymentDate?.message}>
                      <input type="date" className={inputClass} {...paymentForm.register('paymentDate')} />
                    </Field>
                    <Field label="Payment Mode">
                      <select className={inputClass} {...paymentForm.register('paymentMode')}>
                        {paymentModes.map((mode) => <option key={mode} value={mode}>{labelize(mode)}</option>)}
                      </select>
                    </Field>
                    {watchedPaymentMode === 'CHEQUE' ? (
                      <>
                        <Field label="Cheque Number">
                          <input className={inputClass} {...paymentForm.register('chequeNumber')} placeholder="Cheque number" />
                        </Field>
                        <Field label="Bank Name">
                          <input className={inputClass} {...paymentForm.register('bankName')} placeholder="Issuing bank" />
                        </Field>
                      </>
                    ) : null}
                    {watchedPaymentMode !== 'CASH' && watchedPaymentMode !== 'CHEQUE' ? (
                      <Field label="Transaction Reference">
                        <input className={inputClass} {...paymentForm.register('transactionReference')} placeholder="UPI / bank / card reference" />
                      </Field>
                    ) : (
                      <Field label="Reference">
                        <input className={inputClass} {...paymentForm.register('transactionReference')} placeholder="Optional reference" />
                      </Field>
                    )}
                  </div>
                  <Field label="Note">
                    <textarea className={`${inputClass} min-h-20`} {...paymentForm.register('note')} />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Selected amount</p>
                      <p className="text-2xl font-black text-slate-950">{money(selectedAllocationTotal)}</p>
                    </div>
                    {canCreateCollection ? <PrimaryButton type="submit" disabled={paymentMutation.isPending || !selectedAllocationRows.length || selectedAllocationTotal <= 0}>
                      {paymentMutation.isPending ? 'Collecting...' : 'Collect & Generate Receipt'}
                    </PrimaryButton> : null}
                  </div>
                </form>
              </Card>

              <Card title="Recent Payments">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <Field label="Search">
                    <input
                      className={inputClass}
                      value={paymentFilters.search}
                      onChange={(event) => {
                        setPaymentFilters((current) => ({ ...current, search: event.target.value }));
                        setPaymentPage(1);
                      }}
                      placeholder="Receipt, student, admission..."
                    />
                  </Field>
                  <Field label="Payment Mode">
                    <select className={inputClass} value={paymentFilters.paymentMode} onChange={(event) => { setPaymentFilters((current) => ({ ...current, paymentMode: event.target.value as '' | FeePaymentMode })); setPaymentPage(1); }}>
                      <option value="">All modes</option>
                      {paymentModes.map((mode) => <option key={mode} value={mode}>{labelize(mode)}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={inputClass} value={paymentFilters.status} onChange={(event) => { setPaymentFilters((current) => ({ ...current, status: event.target.value })); setPaymentPage(1); }}>
                      <option value="">All statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="SUCCESS">Success</option>
                      <option value="FAILED">Failed</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </Field>
                </div>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-slate-950">{payment.paymentNumber}</p>
                        <p className="text-xs text-slate-500">{payment.student?.fullName ?? '-'} - {labelize(payment.paymentMode)}</p>
                        <p className="text-xs text-slate-400">{payment.allocations?.length ?? 1} invoice allocation(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-950">{money(payment.amount)}</p>
                        <p className="text-xs text-slate-500">{dateValue(payment.paidAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!payments.length ? <EmptyState message="No payments collected yet. Search a student, select pending invoices, and collect payment to generate receipts." /> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                  <span>Page {paymentPage} of {paymentsQuery.data && !Array.isArray(paymentsQuery.data) ? paymentsQuery.data.pagination.totalPages : 1}</span>
                  <div className="flex gap-2">
                    <SecondaryButton disabled={paymentPage <= 1} onClick={() => setPaymentPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                    <SecondaryButton disabled={(paymentsQuery.data && !Array.isArray(paymentsQuery.data) ? paymentsQuery.data.pagination.totalPages : 1) <= paymentPage} onClick={() => setPaymentPage((page) => page + 1)}>Next</SecondaryButton>
                  </div>
                </div>
              </Card>
            </div>

            <Card
              title={selectedReceipt ? 'Receipt Preview' : 'Invoice Preview'}
              subtitle="Print the generated receipt with invoice-wise allocation details."
              actions={canPrintReceipt ? <SecondaryButton onClick={() => window.print()} disabled={!selectedInvoice && !selectedReceipt}>Print Receipt</SecondaryButton> : null}
            >
              {selectedReceipt ? (
                <div className="rounded-2xl border border-slate-200 p-5" id="fee-print-area">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">Fee Receipt</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedReceipt.receiptNumber}</h3>
                      <p className="text-sm text-slate-500">Date: {dateValue(selectedReceipt.receiptDate)} - Mode: {labelize(selectedReceipt.paymentMode)}</p>
                    </div>
                    <Badge tone="success">Paid</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Student</p>
                      <p className="mt-1 font-black text-slate-950">{selectedCollectionStudent?.fullName ?? selectedInvoice?.student?.fullName ?? '-'}</p>
                      <p className="text-sm text-slate-500">{selectedCollectionStudent?.admissionNo ?? selectedInvoice?.student?.admissionNo ?? '-'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Collection</p>
                      <p className="mt-1 font-black text-slate-950">Total paid {money(selectedReceipt.amount)}</p>
                      <p className="text-sm text-slate-500">{selectedReceipt.allocations?.length ?? 0} invoice allocation(s)</p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Month</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Allocated</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedReceipt.allocations ?? []).map((allocation) => (
                          <tr key={`${allocation.invoiceId}-${allocation.allocatedAmount}`}>
                            <td className="px-4 py-3 font-bold text-slate-900">{allocation.invoice?.invoiceNumber ?? allocation.invoiceId}</td>
                            <td className="px-4 py-3">{allocation.invoice?.feeMonth ?? '-'}</td>
                            <td className="px-4 py-3"><Badge tone={statusTone(allocation.invoice?.status)}>{labelize(allocation.invoice?.status)}</Badge></td>
                            <td className="px-4 py-3 text-right font-black text-slate-950">{money(allocation.allocatedAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <StatCard label="Invoices" value={String(selectedReceipt.allocations?.length ?? 0)} />
                    <StatCard label="Total Paid" value={money(selectedReceipt.amount)} />
                    <StatCard label="Receipt Date" value={dateValue(selectedReceipt.receiptDate)} />
                  </div>
                </div>
              ) : selectedInvoice ? (
                <div className="rounded-2xl border border-slate-200 p-5" id="fee-print-area">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">Fee Invoice</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedInvoice.invoiceNumber}</h3>
                      <p className="text-sm text-slate-500">Issue: {dateValue(selectedInvoice.issueDate)} - Due: {dateValue(selectedInvoice.dueDate)}</p>
                    </div>
                    <Badge tone={statusTone(selectedInvoice.status)}>{labelize(selectedInvoice.status)}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Student</p>
                      <p className="mt-1 font-black text-slate-950">{selectedInvoice.student?.fullName ?? '-'}</p>
                      <p className="text-sm text-slate-500">{selectedInvoice.student?.admissionNo ?? '-'} - {selectedInvoice.class?.name ?? '-'} {selectedInvoice.section?.name ? `(${selectedInvoice.section.name})` : ''}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Contact</p>
                      <p className="mt-1 font-black text-slate-950">{selectedInvoice.student?.parentPhone ?? selectedInvoice.student?.phone ?? '-'}</p>
                      <p className="text-sm text-slate-500">{selectedInvoice.student?.parentEmail ?? '-'}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <StatCard label="Total" value={money(selectedInvoice.totalAmount)} />
                    <StatCard label="Discount" value={money(selectedInvoice.discountAmount)} />
                    <StatCard label="Paid" value={money(selectedInvoice.paidAmount)} />
                    <StatCard label="Due" value={money(selectedInvoice.dueAmount)} />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Select a student invoice to preview, then collect to print receipt.</div>
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === 'discounts' ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <Card
              title={editingDiscount ? 'Edit Discount / Waiver' : 'Add Discount / Waiver'}
              subtitle="Create auditable discounts by student, class, section, category, fee type, or all students."
              actions={editingDiscount ? <SecondaryButton onClick={resetDiscountForm}>Cancel</SecondaryButton> : null}
            >
              <form className="space-y-3" onSubmit={discountForm.handleSubmit((payload) => (editingDiscount ? canUpdateDiscount : canCreateDiscount) && discountMutation.mutate(payload))}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Discount Name" error={discountForm.formState.errors.discountName?.message}>
                    <input className={inputClass} {...discountForm.register('discountName')} placeholder="Sibling concession" />
                  </Field>
                  <Field label="Target Type" error={discountForm.formState.errors.targetType?.message}>
                    <select className={inputClass} {...discountForm.register('targetType')}>
                      {discountTargetTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                    </select>
                  </Field>
                  {watchedDiscountTargetType === 'STUDENT' ? (
                    <Field label="Student" error={discountForm.formState.errors.studentId?.message}>
                      <select className={inputClass} {...discountForm.register('studentId')}>
                        <option value="">Select student</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                      </select>
                    </Field>
                  ) : null}
                  {watchedDiscountTargetType === 'CLASS' || watchedDiscountTargetType === 'SECTION' ? (
                  <Field label="Class" error={discountForm.formState.errors.classId?.message}>
                    <select className={inputClass} {...discountForm.register('classId')}>
                      <option value="">Select class</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  ) : null}
                  {watchedDiscountTargetType === 'SECTION' ? (
                  <Field label="Section" error={discountForm.formState.errors.sectionId?.message}>
                    <select className={inputClass} {...discountForm.register('sectionId')}>
                      <option value="">Select section</option>
                      {selectedSectionOptions(sections, watchedDiscountClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  ) : null}
                  {watchedDiscountTargetType === 'CATEGORY' ? (
                  <Field label="Category" error={discountForm.formState.errors.categoryId?.message}>
                    <select className={inputClass} {...discountForm.register('categoryId')}>
                      <option value="">Select category</option>
                      {studentCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  ) : null}
                  {watchedDiscountTargetType === 'FEE_TYPE' ? (
                  <Field label="Fee Type" error={discountForm.formState.errors.feeTypeId?.message}>
                    <select className={inputClass} {...discountForm.register('feeTypeId')}>
                      <option value="">Select fee type</option>
                      {activeFeeTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  ) : null}
                  <Field label="Discount Type">
                    <select className={inputClass} {...discountForm.register('discountType')}>
                      <option value="FIXED">Fixed</option>
                      <option value="PERCENTAGE">Percentage</option>
                    </select>
                  </Field>
                  <Field label="Discount Value" error={discountForm.formState.errors.discountValue?.message}>
                    <input type="number" min="0" step="0.01" className={inputClass} {...discountForm.register('discountValue')} />
                  </Field>
                  <Field label="Fixed Amount Override">
                    <input type="number" min="0" step="0.01" className={inputClass} {...discountForm.register('amount')} placeholder="Optional" />
                  </Field>
                  <Field label="Valid From">
                    <input type="date" className={inputClass} {...discountForm.register('validFrom')} />
                  </Field>
                  <Field label="Valid To" error={discountForm.formState.errors.validTo?.message}>
                    <input type="date" className={inputClass} {...discountForm.register('validTo')} />
                  </Field>
                </div>
                <Field label="Status">
                  <select className={inputClass} {...discountForm.register('status')} disabled={!canApproveDiscount}>
                    {discountStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </select>
                </Field>
                <Field label="Reason">
                  <textarea className={`${inputClass} min-h-16`} {...discountForm.register('reason')} placeholder="Approval reason, scholarship note, sibling concession reference..." />
                </Field>
                <Field label="Note">
                  <textarea className={`${inputClass} min-h-16`} {...discountForm.register('note')} />
                </Field>
                {(editingDiscount ? canUpdateDiscount : canCreateDiscount) ? <PrimaryButton type="submit" disabled={discountMutation.isPending}>{editingDiscount ? 'Update Discount' : 'Save Discount'}</PrimaryButton> : null}
              </form>
            </Card>

            <Card title="Discount List" subtitle="Filter by lifecycle status and target. Approval actions are visible only to School Admins.">
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Field label="Search">
                  <input
                    className={inputClass}
                    value={discountFilters.search}
                    onChange={(event) => {
                      setDiscountFilters((current) => ({ ...current, search: event.target.value }));
                      setDiscountPage(1);
                    }}
                    placeholder="Discount, student, target..."
                  />
                </Field>
                <Field label="Status Filter">
                  <select className={inputClass} value={discountFilters.status} onChange={(event) => { setDiscountFilters((current) => ({ ...current, status: event.target.value as '' | FeeApprovalStatus })); setDiscountPage(1); }}>
                    <option value="">All statuses</option>
                    {discountStatuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </select>
                </Field>
                <Field label="Target Filter">
                  <select className={inputClass} value={discountFilters.targetType} onChange={(event) => { setDiscountFilters((current) => ({ ...current, targetType: event.target.value as '' | FeeDiscountTargetType })); setDiscountPage(1); }}>
                    <option value="">All targets</option>
                    {discountTargetTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                  </select>
                </Field>
              </div>
              <div className="space-y-3">
                {discounts.map((item: FeeDiscount) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{item.discountName ?? labelize(item.discountType)}</p>
                        <p className="text-sm text-slate-500">
                          {labelize(item.targetType)} - {item.student?.fullName ?? item.class?.name ?? item.section?.name ?? item.category?.name ?? item.feeType?.name ?? 'All students'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {labelize(item.valueType)} {item.value} {item.validFrom ? `from ${item.validFrom.slice(0, 10)}` : ''} {item.validTo ? `to ${item.validTo.slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <Badge tone={statusTone(item.approvalStatus)}>{labelize(item.approvalStatus)}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canUpdateDiscount ? <IconButton title="Edit" onClick={() => editDiscount(item)} disabled={discountActionMutation.isPending}>E</IconButton> : null}
                      {canApproveDiscount && !['APPROVED', 'ACTIVE'].includes(item.approvalStatus) ? (
                        <IconButton title="Approve" tone="success" onClick={() => discountActionMutation.mutate({ id: item.id, action: 'approve' })} disabled={discountActionMutation.isPending}>A</IconButton>
                      ) : null}
                      {canApproveDiscount && ['DRAFT', 'PENDING_APPROVAL'].includes(item.approvalStatus) ? (
                        <IconButton
                          title="Reject"
                          tone="danger"
                          onClick={() => requestConfirmation({
                            title: 'Reject discount',
                            itemName: item.discountName ?? labelize(item.discountType),
                            message: 'Rejected discounts will not apply during invoice calculation.',
                            confirmLabel: 'Reject',
                            tone: 'warning',
                            onConfirm: () => discountActionMutation.mutate({ id: item.id, action: 'reject' }),
                          })}
                          disabled={discountActionMutation.isPending}
                        >
                          R
                        </IconButton>
                      ) : null}
                      {canApproveDiscount && item.approvalStatus === 'APPROVED' ? (
                        <IconButton title="Activate" tone="success" onClick={() => discountActionMutation.mutate({ id: item.id, action: 'activate' })} disabled={discountActionMutation.isPending}>ON</IconButton>
                      ) : null}
                      {canApproveDiscount && item.approvalStatus === 'ACTIVE' ? (
                        <IconButton title="Deactivate" onClick={() => discountActionMutation.mutate({ id: item.id, action: 'deactivate' })} disabled={discountActionMutation.isPending}>OFF</IconButton>
                      ) : null}
                      {canDeleteDiscount ? (
                        <IconButton
                          title="Delete"
                          tone="danger"
                          onClick={() => requestConfirmation({
                            title: 'Delete discount',
                            itemName: item.discountName ?? labelize(item.discountType),
                            message: 'Paid or partially paid invoice discounts require a reversal flow. The server will block unsafe deletion.',
                            confirmLabel: 'Delete',
                            onConfirm: () => discountActionMutation.mutate({ id: item.id, action: 'delete' }),
                          })}
                          disabled={discountActionMutation.isPending}
                        >
                          D
                        </IconButton>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!discounts.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No discounts found.</p> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>Page {discountPage} of {discountsQuery.data && !Array.isArray(discountsQuery.data) ? discountsQuery.data.pagination.totalPages : 1}</span>
                <div className="flex gap-2">
                  <SecondaryButton disabled={discountPage <= 1} onClick={() => setDiscountPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(discountsQuery.data && !Array.isArray(discountsQuery.data) ? discountsQuery.data.pagination.totalPages : 1) <= discountPage} onClick={() => setDiscountPage((page) => page + 1)}>Next</SecondaryButton>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'fines' ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Add Fine Rule" subtitle="Create late fee rules with grace days.">
              <form className="space-y-3" onSubmit={fineForm.handleSubmit((payload) => canCreateFine && fineMutation.mutate(payload))}>
                <Field label="Fine Name" error={fineForm.formState.errors.name?.message}>
                  <input className={inputClass} {...fineForm.register('name')} placeholder="Late Payment Fine" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Particular">
                    <select className={inputClass} {...fineForm.register('particularId')}>
                      <option value="">No particular</option>
                      {particulars.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Fine Type">
                    <select className={inputClass} {...fineForm.register('fineType')}>
                      {fineTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                    </select>
                  </Field>
                  <Field label="Amount">
                    <input type="number" min="0" className={inputClass} {...fineForm.register('amount')} />
                  </Field>
                  <Field label="Grace Days">
                    <input type="number" min="0" className={inputClass} {...fineForm.register('graceDays')} />
                  </Field>
                </div>
                <Field label="Status">
                  <select className={inputClass} {...fineForm.register('status')}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
                {canCreateFine ? <PrimaryButton type="submit" disabled={fineMutation.isPending}>Save Fine</PrimaryButton> : null}
              </form>
            </Card>

            <Card title="Fine Rules">
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <Field label="Search">
                  <input
                    className={inputClass}
                    value={fineFilters.search}
                    onChange={(event) => {
                      setFineFilters((current) => ({ ...current, search: event.target.value }));
                      setFinePage(1);
                    }}
                    placeholder="Fine name, type..."
                  />
                </Field>
                <Field label="Status">
                  <select className={inputClass} value={fineFilters.status} onChange={(event) => { setFineFilters((current) => ({ ...current, status: event.target.value as FeeRecordStatus | '' })); setFinePage(1); }}>
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </Field>
              </div>
              <div className="space-y-3">
                {fines.map((item: FeeFine) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-slate-950">{item.name}</p>
                      <p className="text-sm text-slate-500">{labelize(item.fineType)} - Grace {item.graceDays} days</p>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <p className="font-black text-slate-950">{money(item.amount)}</p>
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                      {canDeleteFine ? (
                        <IconButton
                          title="Delete"
                          tone="danger"
                          onClick={() => requestConfirmation({
                            title: 'Delete fine rule',
                            itemName: item.name,
                            message: 'This deactivates the fine rule. Already applied fines remain in invoices and ledgers.',
                            confirmLabel: 'Delete',
                            onConfirm: () => deleteFineMutation.mutate(item.id),
                          })}
                          disabled={deleteFineMutation.isPending}
                        >
                          D
                        </IconButton>
                      ) : null}
                    </div>
                  </div>
                ))}
                {!fines.length ? <EmptyState message="No fine rules found. Create a fixed, daily, or monthly fine rule to apply late payment penalties." /> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>Page {finePage} of {finesQuery.data && !Array.isArray(finesQuery.data) ? finesQuery.data.pagination.totalPages : 1}</span>
                <div className="flex gap-2">
                  <SecondaryButton disabled={finePage <= 1} onClick={() => setFinePage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(finesQuery.data && !Array.isArray(finesQuery.data) ? finesQuery.data.pagination.totalPages : 1) <= finePage} onClick={() => setFinePage((page) => page + 1)}>Next</SecondaryButton>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
        {activeTab === 'ledger' ? (
          <div className="space-y-5">
            <Card
              title="Student Fee Ledger"
              subtitle="Student-wise debit, credit, and running balance."
              actions={canLedgerExport ? (
                <ExportButtons
                  onPrint={() => window.print()}
                  onCsv={() =>
                    downloadCsv(
                      'student-fee-ledger.csv',
                      (ledgerQuery.data?.items ?? []).map((entry) => ({
                        date: dateValue(entry.createdAt),
                        type: entry.entryType,
                        description: entry.description ?? '',
                        debit: numberValue(entry.debitAmount ?? entry.debit),
                        credit: numberValue(entry.creditAmount ?? entry.credit),
                        balance: numberValue(entry.balanceAfter ?? entry.balance),
                      })),
                    )
                  }
                />
              ) : null}
            >
              <div className="mb-4 max-w-xl">
                <Field label="Student">
                  <select className={inputClass} value={ledgerStudentId} onChange={(event) => { setLedgerStudentId(event.target.value); setLedgerPage(1); }}>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                  </select>
                </Field>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Student" value={selectedLedgerStudent?.fullName ?? '-'} note={selectedLedgerStudent?.admissionNo ?? ''} />
                <StatCard label="Class" value={classes.find((item) => item.id === selectedLedgerStudent?.classId)?.name ?? '-'} />
                <StatCard label="Entries" value={String(ledgerQuery.data?.items?.length ?? 0)} />
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(ledgerQuery.data?.items ?? []).map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{dateValue(entry.createdAt)}</td>
                        <td className="px-4 py-3"><Badge tone={entry.entryType === 'PAYMENT_CREDIT' ? 'success' : 'info'}>{labelize(entry.entryType)}</Badge></td>
                        <td className="px-4 py-3">{entry.description}</td>
                        <td className="px-4 py-3 text-right">{money(entry.debitAmount ?? entry.debit)}</td>
                        <td className="px-4 py-3 text-right">{money(entry.creditAmount ?? entry.credit)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-950">{money(entry.balanceAfter ?? entry.balance)}</td>
                      </tr>
                    ))}
                    {!ledgerQuery.data?.items?.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No ledger entries found for this student.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span>Page {ledgerPage} of {ledgerQuery.data?.pagination?.totalPages ?? 1}</span>
                <div className="flex gap-2">
                  <SecondaryButton disabled={ledgerPage <= 1} onClick={() => setLedgerPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(ledgerQuery.data?.pagination?.totalPages ?? 1) <= ledgerPage} onClick={() => setLedgerPage((page) => page + 1)}>Next</SecondaryButton>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'reports' ? (
          <div className="space-y-5">
            <Card
              title="Fee Reports"
              subtitle="Generate collection, due, outstanding, discount, fine, cancellation, receipt, and ledger summaries."
              actions={canReportsExport ? (
                <ExportButtons
                  onPrint={() => window.print()}
                  onCsv={() => void handleReportExport('csv')}
                  onPdf={() => void handleReportExport('pdf')}
                  onExcel={() => void handleReportExport('xlsx')}
                />
              ) : null}
            >
              <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Report Type">
                  <select className={inputClass} value={reportFilters.type} onChange={(event) => setReportFilters((current) => ({ ...current, type: event.target.value as FeeReportType }))}>
                    {reportTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                  </select>
                </Field>
                <Field label="Date From">
                  <input type="date" className={inputClass} value={reportFilters.dateFrom} onChange={(event) => setReportFilters((current) => ({ ...current, dateFrom: event.target.value }))} />
                </Field>
                <Field label="Date To">
                  <input type="date" className={inputClass} value={reportFilters.dateTo} onChange={(event) => setReportFilters((current) => ({ ...current, dateTo: event.target.value }))} />
                </Field>
                <Field label="Class">
                  <select className={inputClass} value={reportFilters.classId} onChange={(event) => setReportFilters((current) => ({ ...current, classId: event.target.value, sectionId: '' }))}>
                    <option value="">All classes</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Section">
                  <select className={inputClass} value={reportFilters.sectionId} onChange={(event) => setReportFilters((current) => ({ ...current, sectionId: event.target.value }))}>
                    <option value="">All sections</option>
                    {selectedSectionOptions(sections, reportFilters.classId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Student">
                  <select className={inputClass} value={reportFilters.studentId} onChange={(event) => setReportFilters((current) => ({ ...current, studentId: event.target.value }))}>
                    <option value="">All students</option>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                  </select>
                </Field>
                <Field label="Fee Type">
                  <select className={inputClass} value={reportFilters.feeTypeId} onChange={(event) => setReportFilters((current) => ({ ...current, feeTypeId: event.target.value }))}>
                    <option value="">All fee types</option>
                    {feeTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Fee Structure">
                  <select className={inputClass} value={reportFilters.feeStructureId} onChange={(event) => setReportFilters((current) => ({ ...current, feeStructureId: event.target.value }))}>
                    <option value="">All structures</option>
                    {structures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Payment Mode">
                  <select className={inputClass} value={reportFilters.paymentMode} onChange={(event) => setReportFilters((current) => ({ ...current, paymentMode: event.target.value as '' | FeePaymentMode }))}>
                    <option value="">All modes</option>
                    {paymentModes.map((mode) => <option key={mode} value={mode}>{labelize(mode)}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <input className={inputClass} value={reportFilters.status} onChange={(event) => setReportFilters((current) => ({ ...current, status: event.target.value }))} placeholder="PAID, CANCELLED, ACTIVE" />
                </Field>
                <Field label="Collected By">
                  <input className={inputClass} value={reportFilters.collectedById} onChange={(event) => setReportFilters((current) => ({ ...current, collectedById: event.target.value }))} placeholder="User ID" />
                </Field>
                <div className="flex items-end gap-2">
                  <PrimaryButton onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>Generate Report</PrimaryButton>
                  <SecondaryButton onClick={() => setReportFilters({ type: 'daily_collection', dateFrom: '', dateTo: '', classId: '', sectionId: '', studentId: '', feeTypeId: '', feeStructureId: '', paymentMode: '', status: '', collectedById: '' })}>Reset</SecondaryButton>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                <StatCard label="Total Billed" value={money(reports?.summary?.totalBilled ?? reports?.totalInvoiced)} />
                <StatCard label="Collected" value={money(reports?.summary?.totalCollected ?? reports?.totalCollected)} />
                <StatCard label="Discount" value={money(reports?.summary?.totalDiscount)} />
                <StatCard label="Fine" value={money(reports?.summary?.totalFine)} />
                <StatCard label="Due" value={money(reports?.summary?.totalDue ?? reports?.totalOutstanding)} />
                <StatCard label="Cancelled" value={money(reports?.summary?.totalCancelled)} />
                <StatCard label="Receipts" value={String(reports?.summary?.totalReceipts ?? 0)} />
              </div>
            </Card>

            <Card title={`${labelize(reportFilters.type)} Table`}>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      {reportColumns.map((column) => <th key={column} className="px-4 py-3">{labelize(column)}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportRows.map((row, index) => (
                      <tr key={index}>
                        {reportColumns.map((column) => (
                          <td key={column} className="px-4 py-3">
                            {typeof row[column] === 'number' && /amount|total|paid|due|billed|collected|discount|fine|balance|cash|online|credit|debit/i.test(column)
                              ? money(row[column])
                              : String(row[column] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!reportRows.length ? <tr><td colSpan={Math.max(1, reportColumns.length)} className="px-4 py-8 text-center text-slate-500">No rows found for selected filters.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

