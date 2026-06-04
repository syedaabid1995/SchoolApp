'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { listSchools } from '../../../services/school.service';
import {
  assignStudentFees,
  collectFeePayment,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deleteFeeParticular,
  deleteFeeStructure,
  deleteFeeType,
  duplicateFeeStructure,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listFeeAssignments,
  listFeeDiscounts,
  listFeeFines,
  listFeeInvoices,
  listFeeParticulars,
  listFeePayments,
  listFeeStructures,
  listFeeTypes,
  updateFeeParticular,
  updateFeeStructure,
  updateFeeType,
  type FeeApprovalStatus,
  type FeeClassOption,
  type FeeCollectionSchedule,
  type FeeDiscount,
  type FeeFine,
  type FeeFineType,
  type FeeInvoice,
  type FeeInvoiceStatus,
  type FeeParticular,
  type FeeParticularType,
  type FeePaymentMode,
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

type TabId =
  | 'overview'
  | 'setup'
  | 'structures'
  | 'assignments'
  | 'invoices'
  | 'collection'
  | 'discounts'
  | 'ledger'
  | 'reports';

type StructureDraftItem = {
  id: string;
  particularId: string;
  amount: string;
  isOptional: boolean;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'setup', label: 'Fee Setup' },
  { id: 'structures', label: 'Structures' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'collection', label: 'Collection' },
  { id: 'discounts', label: 'Discounts & Fines' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'reports', label: 'Reports' },
];

const particularTypes: FeeParticularType[] = ['CHARGE', 'DISCOUNT', 'FINE', 'PREVIOUS_BALANCE', 'TRANSPORT', 'HOSTEL'];
const schedules: FeeCollectionSchedule[] = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME'];
const invoiceStatuses: Array<'' | FeeInvoiceStatus> = ['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];
const paymentModes: FeePaymentMode[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY'];
const discountTypes = ['SCHOLARSHIP', 'SIBLING_DISCOUNT', 'STAFF_CHILD_DISCOUNT', 'SPECIAL_DISCOUNT'] as const;
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
  mode: z.enum(['CLASS', 'SECTION', 'STUDENTS']),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  studentIds: z.array(z.string()).default([]),
  notes: z.string().trim().optional(),
});

const invoiceSchema = z.object({
  target: z.enum(['STUDENT', 'CLASS', 'SECTION', 'SCHOOL']),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  feeStructureId: z.string().optional(),
  feeTypeId: z.string().optional(),
  feeMonth: z.string().trim().optional(),
  dueDate: z.string().optional(),
  emailInvoice: z.boolean().default(false),
});

const paymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  paymentMode: z.enum(paymentModes),
  transactionReference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const discountSchema = z.object({
  studentId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  particularId: z.string().optional(),
  discountType: z.enum(discountTypes),
  valueType: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().min(0),
  amount: z.coerce.number().min(0).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE']).default('PENDING_APPROVAL'),
  note: z.string().trim().optional(),
});

const fineSchema = z.object({
  name: z.string().trim().min(1, 'Fine name is required'),
  particularId: z.string().optional(),
  fineType: z.enum(fineTypes),
  amount: z.coerce.number().min(0),
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

function DataTable<T>({ columns, data, emptyMessage }: { columns: ColumnDef<T>[]; data: T[]; emptyMessage: string }) {
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
          {table.getRowModel().rows.length ? (
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
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const ExportButtons = ({ onPrint, onCsv }: { onPrint: () => void; onCsv?: () => void }) => (
  <>
    {onCsv ? <SecondaryButton onClick={onCsv}>CSV</SecondaryButton> : null}
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

const selectedSectionOptions = (sections: FeeSectionOption[], classId?: string) =>
  classId ? sections.filter((section) => section.classId === classId) : sections;

const structureTotal = (items?: FeeStructureItem[] | StructureDraftItem[]) =>
  (items ?? []).reduce((sum, item) => sum + numberValue((item as any).amount), 0);

export default function FeesPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedAcademicSessionId, setSelectedAcademicSessionId] = useState('');
  const [particularPage, setParticularPage] = useState(1);
  const [structurePage, setStructurePage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [particularSearch, setParticularSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<'' | FeeInvoiceStatus>('');
  const [editingParticular, setEditingParticular] = useState<FeeParticular | null>(null);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [editingStructure, setEditingStructure] = useState<FeeStructure | null>(null);
  const [structureRows, setStructureRows] = useState<StructureDraftItem[]>([{ id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }]);
  const [selectedInvoice, setSelectedInvoice] = useState<FeeInvoice | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{ receiptNumber: string; amount: number | string; receiptDate: string } | null>(null);
  const [ledgerStudentId, setLedgerStudentId] = useState('');
  const [reportRange, setReportRange] = useState({ from: '', to: '' });

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const role = session?.role ?? '';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canUseFees = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT'].includes(role);

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

  useEffect(() => {
    const data = metadataQuery.data;
    if (!data) return;
    if (!selectedAcademicSessionId || !data.academicSessions.some((item) => item.id === selectedAcademicSessionId)) {
      setSelectedAcademicSessionId(data.academicSessionId);
    }
    if (!ledgerStudentId && data.students.length) {
      setLedgerStudentId(data.students[0].id);
    }
  }, [metadataQuery.data, ledgerStudentId, selectedAcademicSessionId]);

  const metadata = metadataQuery.data;
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
    queryKey: ['fees', 'assignments', effectiveSchoolId, scopedWithSession.academicSessionId],
    queryFn: () => listFeeAssignments(scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const invoicesQuery = useQuery({
    queryKey: ['fees', 'invoices', effectiveSchoolId, scopedWithSession.academicSessionId, invoicePage, invoiceStatus],
    queryFn: () => listFeeInvoices({ ...scopedWithSession, page: invoicePage, limit: 10, status: invoiceStatus || undefined }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const paymentsQuery = useQuery({
    queryKey: ['fees', 'payments', effectiveSchoolId, scopedWithSession.academicSessionId],
    queryFn: () => listFeePayments(scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const discountsQuery = useQuery({
    queryKey: ['fees', 'discounts', effectiveSchoolId, scopedWithSession.academicSessionId],
    queryFn: () => listFeeDiscounts(scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const finesQuery = useQuery({
    queryKey: ['fees', 'fines', effectiveSchoolId, scopedWithSession.academicSessionId],
    queryFn: () => listFeeFines(scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });
  const ledgerQuery = useQuery({
    queryKey: ['fees', 'ledger', effectiveSchoolId, scopedWithSession.academicSessionId, ledgerStudentId],
    queryFn: () => getStudentFeeLedger(ledgerStudentId, scopedWithSession),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId && ledgerStudentId),
  });
  const reportsQuery = useQuery({
    queryKey: ['fees', 'reports', effectiveSchoolId, scopedWithSession.academicSessionId, reportRange],
    queryFn: () => getFeeReports({ ...scopedWithSession, from: reportRange.from || undefined, to: reportRange.to || undefined }),
    enabled: canQuery && Boolean(scopedWithSession.academicSessionId),
  });

  const particulars = particularsQuery.data?.items ?? metadata?.particulars ?? [];
  const feeTypes = feeTypesQuery.data ?? metadata?.feeTypes ?? [];
  const structures = structuresQuery.data?.items ?? metadata?.structures ?? [];
  const invoices = invoicesQuery.data?.items ?? [];
  const payments = paymentsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const discounts = discountsQuery.data ?? [];
  const fines = finesQuery.data ?? [];
  const reports = reportsQuery.data;
  const classes = metadata?.classes ?? [];
  const sections = metadata?.sections ?? [];
  const students = metadata?.students ?? [];

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
    defaultValues: { feeStructureId: '', mode: 'CLASS', classId: '', sectionId: '', studentIds: [], notes: '' },
  });
  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: { target: 'STUDENT', studentId: '', classId: '', sectionId: '', feeStructureId: '', feeTypeId: '', feeMonth: new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }), dueDate: today(), emailInvoice: false },
  });
  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: { invoiceId: '', amount: 0, paymentMode: 'CASH', transactionReference: '', note: '' },
  });
  const discountForm = useForm<DiscountForm>({
    resolver: zodResolver(discountSchema) as any,
    defaultValues: { studentId: '', classId: '', sectionId: '', particularId: '', discountType: 'SCHOLARSHIP', valueType: 'FIXED', value: 0, amount: undefined, validFrom: today(), validTo: '', approvalStatus: 'PENDING_APPROVAL', note: '' },
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
      const items = structureRows
        .filter((item) => item.particularId && Number(item.amount) > 0)
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
    mutationFn: (payload: AssignmentForm) =>
      assignStudentFees({
        ...scopedWithSession,
        feeStructureId: payload.feeStructureId,
        studentIds: payload.mode === 'STUDENTS' ? payload.studentIds : undefined,
        classId: payload.mode !== 'STUDENTS' ? payload.classId : undefined,
        sectionId: payload.mode === 'SECTION' ? payload.sectionId || null : undefined,
        autoAssigned: payload.mode !== 'STUDENTS',
        notes: payload.notes || null,
      }),
    onSuccess: (result) => {
      notify.success('Fee assigned', `${result.assigned} of ${result.requested} student assignments were created.`);
      assignmentForm.reset({ feeStructureId: '', mode: 'CLASS', classId: '', sectionId: '', studentIds: [], notes: '' });
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to assign fee', errorMessage(error)),
  });

  const invoiceMutation = useMutation({
    mutationFn: (payload: InvoiceForm) =>
      generateFeeInvoices({
        ...scopedWithSession,
        target: payload.target,
        studentId: payload.target === 'STUDENT' ? payload.studentId : undefined,
        classId: payload.target === 'CLASS' || payload.target === 'SECTION' ? payload.classId : undefined,
        sectionId: payload.target === 'SECTION' ? payload.sectionId : undefined,
        feeStructureId: payload.feeStructureId || undefined,
        feeTypeId: payload.feeTypeId || undefined,
        feeMonth: payload.feeMonth || null,
        dueDate: payload.dueDate || null,
        emailInvoice: payload.emailInvoice,
      }),
    onSuccess: (result) => {
      notify.success('Invoices generated', `${result.generated.length} created, ${result.skipped.length} skipped.`);
      if (result.generated[0]) setSelectedInvoice(result.generated[0]);
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to generate invoices', errorMessage(error)),
  });

  const paymentMutation = useMutation({
    mutationFn: (payload: PaymentForm) =>
      collectFeePayment({
        ...scopedWithSession,
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        paymentMode: payload.paymentMode,
        transactionReference: payload.transactionReference || null,
        note: payload.note || null,
      }),
    onSuccess: (result) => {
      notify.success('Payment collected', `Receipt ${result.receipt.receiptNumber} was created.`);
      setSelectedInvoice(result.invoice);
      setSelectedReceipt(result.receipt);
      paymentForm.reset({ invoiceId: '', amount: 0, paymentMode: 'CASH', transactionReference: '', note: '' });
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to collect payment', errorMessage(error)),
  });

  const discountMutation = useMutation({
    mutationFn: (payload: DiscountForm) =>
      createFeeDiscount({
        ...scopedWithSession,
        studentId: payload.studentId || null,
        classId: payload.classId || null,
        sectionId: payload.sectionId || null,
        particularId: payload.particularId || null,
        discountType: payload.discountType,
        valueType: payload.valueType as FeeValueType,
        value: payload.value,
        amount: payload.amount ?? null,
        validFrom: payload.validFrom || null,
        validTo: payload.validTo || null,
        approvalStatus: payload.approvalStatus as FeeApprovalStatus,
        note: payload.note || null,
      }),
    onSuccess: () => {
      notify.success('Discount saved');
      discountForm.reset({ studentId: '', classId: '', sectionId: '', particularId: '', discountType: 'SCHOLARSHIP', valueType: 'FIXED', value: 0, amount: undefined, validFrom: today(), validTo: '', approvalStatus: 'PENDING_APPROVAL', note: '' });
      invalidateFees();
    },
    onError: (error) => notify.error('Unable to save discount', errorMessage(error)),
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
    setActiveTab('setup');
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
    setActiveTab('setup');
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
    setActiveTab('structures');
  };

  const watchedStructureClassId = structureForm.watch('classId');
  const watchedAssignmentMode = assignmentForm.watch('mode');
  const watchedAssignmentClassId = assignmentForm.watch('classId');
  const watchedInvoiceTarget = invoiceForm.watch('target');
  const watchedInvoiceClassId = invoiceForm.watch('classId');
  const watchedPaymentInvoiceId = paymentForm.watch('invoiceId');
  const watchedDiscountClassId = discountForm.watch('classId');

  useEffect(() => {
    const invoice = invoices.find((item) => item.id === watchedPaymentInvoiceId);
    if (invoice) {
      paymentForm.setValue('amount', numberValue(invoice.dueAmount));
      setSelectedInvoice(invoice);
    }
  }, [invoices, paymentForm, watchedPaymentInvoiceId]);

  const dueInvoices = useMemo(() => invoices.filter((invoice) => numberValue(invoice.dueAmount) > 0 && invoice.status !== 'CANCELLED'), [invoices]);
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
            <IconButton title="Edit" onClick={() => editParticular(row.original)}>E</IconButton>
            <IconButton title="Delete" tone="danger" onClick={() => deleteParticularMutation.mutate(row.original.id)}>D</IconButton>
          </div>
        ),
      },
    ],
    [deleteParticularMutation],
  );

  const invoiceColumns = useMemo<ColumnDef<FeeInvoice>[]>(
    () => [
      { header: 'Invoice', accessorKey: 'invoiceNumber', cell: ({ row }) => <div><p className="font-bold text-slate-900">{row.original.invoiceNumber}</p><p className="text-xs text-slate-500">{row.original.feeMonth ?? 'Current period'}</p></div> },
      { header: 'Student', cell: ({ row }) => <div><p className="font-semibold text-slate-900">{row.original.student?.fullName ?? '-'}</p><p className="text-xs text-slate-500">{row.original.student?.admissionNo ?? '-'}</p></div> },
      { header: 'Class', cell: ({ row }) => `${row.original.class?.name ?? '-'} ${row.original.section?.name ? `(${row.original.section.name})` : ''}` },
      { header: 'Total', cell: ({ row }) => money(row.original.totalAmount) },
      { header: 'Paid', cell: ({ row }) => money(row.original.paidAmount) },
      { header: 'Due', cell: ({ row }) => <span className="font-bold text-slate-950">{money(row.original.dueAmount)}</span> },
      { header: 'Status', cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{labelize(row.original.status)}</Badge> },
      {
        header: 'Action',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <IconButton title="View invoice" onClick={() => setSelectedInvoice(row.original)}>V</IconButton>
            <IconButton title="Collect" tone="success" onClick={() => { paymentForm.setValue('invoiceId', row.original.id); paymentForm.setValue('amount', numberValue(row.original.dueAmount)); setSelectedInvoice(row.original); setActiveTab('collection'); }}>C</IconButton>
            <IconButton title="Print" onClick={() => { setSelectedInvoice(row.original); setTimeout(() => window.print(), 100); }}>P</IconButton>
          </div>
        ),
      },
    ],
    [paymentForm],
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

  return (
    <div className="min-h-screen bg-slate-100 pb-10 print:bg-white">
      <div className="mx-auto w-full max-w-[1580px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Fee Management"
          subtitle="Manage fee particulars, class-wise structures, student assignments, invoices, collections, challans, ledgers, discounts, fines, and reports."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Fee Management' }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>Refresh</SecondaryButton>
              <PrimaryButton onClick={() => setActiveTab('collection')}>Collect Fee</PrimaryButton>
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
                  {(metadata?.academicSessions ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}{item.isActive ? ' - Active' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Search Particulars">
                <input className={inputClass} value={particularSearch} onChange={(event) => { setParticularSearch(event.target.value); setParticularPage(1); }} placeholder="Tuition, transport, fine..." />
              </Field>
            </div>
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
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Collected" value={money(totalCollected)} note="Successful fee payments" />
          <StatCard label="Outstanding" value={money(reports?.totalOutstanding ?? totalDue)} note={`${dueInvoices.length} invoices with balance`} />
          <StatCard label="Invoiced" value={money(reports?.totalInvoiced ?? invoices.reduce((sum, invoice) => sum + numberValue(invoice.totalAmount), 0))} note="Current session invoices" />
          <StatCard label="Setup Coverage" value={`${structures.length} structures`} note={`${particulars.length} particulars, ${feeTypes.length} fee types`} />
        </div>

        <nav className="mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${activeTab === tab.id ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {metadataQuery.isLoading ? <FullPageLoader label="Loading fee workspace..." /> : null}

        {activeTab === 'overview' ? (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Fee Operations" subtitle="Use this module in order: setup particulars, create class structures, assign students, generate invoices, then collect payments.">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Particulars', `${particulars.length} active charge heads`, 'setup'],
                  ['Structures', `${structures.length} class-wise fee plans`, 'structures'],
                  ['Assignments', `${assignments.length} student mappings`, 'assignments'],
                  ['Invoices', `${invoicesQuery.data?.pagination.total ?? invoices.length} generated invoices`, 'invoices'],
                  ['Collections', `${payments.length} recent payments`, 'collection'],
                  ['Reports', 'Collection, due, class-wise summary', 'reports'],
                ].map(([title, note, tab]) => (
                  <button key={title} type="button" onClick={() => setActiveTab(tab as TabId)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-violet-50">
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
            <Card title="Recent Invoices" actions={<SecondaryButton onClick={() => setActiveTab('invoices')}>View all</SecondaryButton>}>
              <DataTable columns={invoiceColumns.slice(0, 6)} data={invoices.slice(0, 5)} emptyMessage="No invoices generated yet." />
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

        {activeTab === 'setup' ? (
          <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-5">
              <Card title={editingParticular ? 'Edit Fee Particular' : 'Add Fee Particular'} subtitle="Create charge heads such as tuition, transport, hostel, fine, discount, or previous balance.">
                <form className="space-y-3" onSubmit={particularForm.handleSubmit((payload) => saveParticularMutation.mutate(payload))}>
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
                    <PrimaryButton type="submit" disabled={saveParticularMutation.isPending}>{editingParticular ? 'Update' : 'Save'}</PrimaryButton>
                    {editingParticular ? <SecondaryButton onClick={resetParticularForm}>Cancel</SecondaryButton> : null}
                  </div>
                </form>
              </Card>

              <Card title={editingFeeType ? 'Edit Fee Type' : 'Add Fee Type'} subtitle="Define schedules such as monthly, quarterly, yearly, or one-time fees.">
                <form className="space-y-3" onSubmit={feeTypeForm.handleSubmit((payload) => saveFeeTypeMutation.mutate(payload))}>
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
                    <PrimaryButton type="submit" disabled={saveFeeTypeMutation.isPending}>{editingFeeType ? 'Update' : 'Save'}</PrimaryButton>
                    {editingFeeType ? <SecondaryButton onClick={resetFeeTypeForm}>Cancel</SecondaryButton> : null}
                  </div>
                </form>
              </Card>
            </div>

            <div className="space-y-5">
              <Card
                title="Fee Particular List"
                actions={
                  <div className="flex items-center gap-2">
                    <SecondaryButton disabled={particularPage <= 1} onClick={() => setParticularPage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                    <SecondaryButton disabled={(particularsQuery.data?.pagination.totalPages ?? 1) <= particularPage} onClick={() => setParticularPage((page) => page + 1)}>Next</SecondaryButton>
                  </div>
                }
              >
                <DataTable columns={particularColumns} data={particularsQuery.data?.items ?? []} emptyMessage="No fee particulars found." />
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
                              <IconButton title="Edit" onClick={() => editFeeType(item)}>E</IconButton>
                              <IconButton title="Delete" tone="danger" onClick={() => deleteFeeTypeMutation.mutate(item.id)}>D</IconButton>
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
          </div>
        ) : null}

        {activeTab === 'structures' ? (
          <div className="grid gap-5 xl:grid-cols-[0.84fr_1.16fr]">
            <Card title={editingStructure ? 'Edit Class Fee Structure' : 'Add Class Fee Structure'} subtitle="Build class-wise fee structures with one or more particulars.">
              <form className="space-y-4" onSubmit={structureForm.handleSubmit((payload) => saveStructureMutation.mutate(payload))}>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Structure Name">
                    <input className={inputClass} {...structureForm.register('name')} placeholder="Class 1 Monthly Fee" />
                  </Field>
                  <Field label="Fee Type" error={structureForm.formState.errors.feeTypeId?.message}>
                    <select className={inputClass} {...structureForm.register('feeTypeId')}>
                      <option value="">Select type</option>
                      {feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
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
                    <PrimaryButton onClick={() => setStructureRows((rows) => [...rows, { id: crypto.randomUUID(), particularId: '', amount: '', isOptional: false }])}>Add Item</PrimaryButton>
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
                          <input type="number" min="0" className={inputClass} value={row.amount} onChange={(event) => setStructureRows((rows) => rows.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} />
                        </Field>
                        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                          <input type="checkbox" checked={row.isOptional} onChange={(event) => setStructureRows((rows) => rows.map((item) => item.id === row.id ? { ...item, isOptional: event.target.checked } : item))} />
                          Optional
                        </label>
                        <IconButton title="Remove item" tone="danger" onClick={() => setStructureRows((rows) => rows.length === 1 ? rows : rows.filter((item) => item.id !== row.id))}>D</IconButton>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end text-sm font-black text-slate-950">Total: {money(structureTotal(structureRows))}</div>
                </div>
                <div className="flex gap-2">
                  <PrimaryButton type="submit" disabled={saveStructureMutation.isPending}>{editingStructure ? 'Update Structure' : 'Save Structure'}</PrimaryButton>
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
                          {structure.class?.name ?? '-'} {structure.section?.name ? `(${structure.section.name})` : '(All sections)'} · {structure.feeType?.name ?? '-'} · {money(structureTotal(structure.items))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge tone={statusTone(structure.status)}>{structure.status}</Badge>
                        <IconButton title="Edit" onClick={() => editStructure(structure)}>E</IconButton>
                        <IconButton title="Duplicate" onClick={() => duplicateStructureMutation.mutate(structure)}>C</IconButton>
                        <IconButton title="Delete" tone="danger" onClick={() => deleteStructureMutation.mutate(structure.id)}>D</IconButton>
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
            <Card title="Assign Fee Structure" subtitle="Assign a structure to a full class, a section, or selected students. Existing assignments are skipped.">
              <form className="space-y-3" onSubmit={assignmentForm.handleSubmit((payload) => assignMutation.mutate(payload))}>
                <Field label="Fee Structure" error={assignmentForm.formState.errors.feeStructureId?.message}>
                  <select className={inputClass} {...assignmentForm.register('feeStructureId')}>
                    <option value="">Select structure</option>
                    {structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name} - {structure.class?.name}</option>)}
                  </select>
                </Field>
                <Field label="Assign Mode">
                  <select className={inputClass} {...assignmentForm.register('mode')}>
                    <option value="CLASS">Class</option>
                    <option value="SECTION">Section</option>
                    <option value="STUDENTS">Selected Students</option>
                  </select>
                </Field>
                {watchedAssignmentMode !== 'STUDENTS' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Class">
                      <select className={inputClass} {...assignmentForm.register('classId')}>
                        <option value="">Select class</option>
                        {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </Field>
                    {watchedAssignmentMode === 'SECTION' ? (
                      <Field label="Section">
                        <select className={inputClass} {...assignmentForm.register('sectionId')}>
                          <option value="">Select section</option>
                          {selectedSectionOptions(sections, watchedAssignmentClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                      </Field>
                    ) : null}
                  </div>
                ) : (
                  <Field label="Students">
                    <select multiple className={`${inputClass} min-h-44`} value={assignmentForm.watch('studentIds')} onChange={(event) => assignmentForm.setValue('studentIds', Array.from(event.target.selectedOptions).map((option) => option.value))}>
                      {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Notes">
                  <textarea className={`${inputClass} min-h-20`} {...assignmentForm.register('notes')} />
                </Field>
                <PrimaryButton type="submit" disabled={assignMutation.isPending}>Assign Fees</PrimaryButton>
              </form>
            </Card>

            <Card title="Student Fee Assignments">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Structure</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignments.slice(0, 80).map((item: StudentFeeAssignment) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3"><p className="font-bold text-slate-900">{item.student?.fullName ?? '-'}</p><p className="text-xs text-slate-500">{item.student?.admissionNo ?? '-'}</p></td>
                        <td className="px-4 py-3">{item.student?.class?.name ?? '-'} {item.student?.section?.name ? `(${item.student.section.name})` : ''}</td>
                        <td className="px-4 py-3">{item.feeStructure?.name ?? '-'}</td>
                        <td className="px-4 py-3"><Badge tone={statusTone(item.status)}>{item.status}</Badge></td>
                        <td className="px-4 py-3">{dateValue(item.assignedAt)}</td>
                      </tr>
                    ))}
                    {!assignments.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No assignments yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'invoices' ? (
          <div className="space-y-5">
            <Card title="Generate Invoices" subtitle="Generate invoices by student, class, section, or full school using active assignments and structures.">
              <form className="grid gap-3 lg:grid-cols-5 lg:items-end" onSubmit={invoiceForm.handleSubmit((payload) => invoiceMutation.mutate(payload))}>
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
                    {feeTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
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
                <PrimaryButton type="submit" disabled={invoiceMutation.isPending}>Generate</PrimaryButton>
              </form>
            </Card>

            <Card
              title="Invoice List"
              actions={
                <>
                  <select className={inputClass} value={invoiceStatus} onChange={(event) => { setInvoiceStatus(event.target.value as '' | FeeInvoiceStatus); setInvoicePage(1); }}>
                    {invoiceStatuses.map((status) => <option key={status || 'ALL'} value={status}>{status ? labelize(status) : 'All Status'}</option>)}
                  </select>
                  <SecondaryButton disabled={invoicePage <= 1} onClick={() => setInvoicePage((page) => Math.max(1, page - 1))}>Prev</SecondaryButton>
                  <SecondaryButton disabled={(invoicesQuery.data?.pagination.totalPages ?? 1) <= invoicePage} onClick={() => setInvoicePage((page) => page + 1)}>Next</SecondaryButton>
                </>
              }
            >
              <DataTable columns={invoiceColumns} data={invoices} emptyMessage="No invoices found." />
            </Card>
          </div>
        ) : null}

        {activeTab === 'collection' ? (
          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-5">
              <Card title="Collect Fee" subtitle="Collect partial or full payments and issue a receipt automatically.">
                <form className="space-y-3" onSubmit={paymentForm.handleSubmit((payload) => paymentMutation.mutate(payload))}>
                  <Field label="Invoice" error={paymentForm.formState.errors.invoiceId?.message}>
                    <select className={inputClass} {...paymentForm.register('invoiceId')}>
                      <option value="">Select invoice</option>
                      {dueInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {invoice.student?.fullName} - Due {money(invoice.dueAmount)}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Amount" error={paymentForm.formState.errors.amount?.message}>
                      <input type="number" min="1" className={inputClass} {...paymentForm.register('amount')} />
                    </Field>
                    <Field label="Payment Mode">
                      <select className={inputClass} {...paymentForm.register('paymentMode')}>
                        {paymentModes.map((mode) => <option key={mode} value={mode}>{labelize(mode)}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Reference">
                    <input className={inputClass} {...paymentForm.register('transactionReference')} placeholder="UPI ref / cheque no / gateway id" />
                  </Field>
                  <Field label="Note">
                    <textarea className={`${inputClass} min-h-20`} {...paymentForm.register('note')} />
                  </Field>
                  <PrimaryButton type="submit" disabled={paymentMutation.isPending}>Collect Payment</PrimaryButton>
                </form>
              </Card>

              <Card title="Recent Payments">
                <div className="space-y-3">
                  {payments.slice(0, 8).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                      <div>
                        <p className="font-bold text-slate-950">{payment.paymentNumber}</p>
                        <p className="text-xs text-slate-500">{payment.student?.fullName ?? '-'} · {labelize(payment.paymentMode)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-950">{money(payment.amount)}</p>
                        <p className="text-xs text-slate-500">{dateValue(payment.paidAt)}</p>
                      </div>
                    </div>
                  ))}
                  {!payments.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No payments collected yet.</p> : null}
                </div>
              </Card>
            </div>

            <Card
              title="Invoice / Receipt Preview"
              subtitle="Use this as printable invoice, receipt, challan reference, or parent portal summary."
              actions={<SecondaryButton onClick={() => window.print()} disabled={!selectedInvoice}>Print</SecondaryButton>}
            >
              {selectedInvoice ? (
                <div className="rounded-2xl border border-slate-200 p-5" id="fee-print-area">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-slate-500">Fee Invoice</p>
                      <h3 className="mt-1 text-2xl font-black text-slate-950">{selectedInvoice.invoiceNumber}</h3>
                      <p className="text-sm text-slate-500">Issue: {dateValue(selectedInvoice.issueDate)} · Due: {dateValue(selectedInvoice.dueDate)}</p>
                    </div>
                    <Badge tone={statusTone(selectedInvoice.status)}>{labelize(selectedInvoice.status)}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Student</p>
                      <p className="mt-1 font-black text-slate-950">{selectedInvoice.student?.fullName ?? '-'}</p>
                      <p className="text-sm text-slate-500">{selectedInvoice.student?.admissionNo ?? '-'} · {selectedInvoice.class?.name ?? '-'} {selectedInvoice.section?.name ? `(${selectedInvoice.section.name})` : ''}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Contact</p>
                      <p className="mt-1 font-black text-slate-950">{selectedInvoice.student?.parentPhone ?? selectedInvoice.student?.phone ?? '-'}</p>
                      <p className="text-sm text-slate-500">{selectedInvoice.student?.parentEmail ?? '-'}</p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Fine</th><th className="px-4 py-3 text-right">Net</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedInvoice.items ?? []).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-semibold text-slate-700">{item.description}</td>
                            <td className="px-4 py-3 text-right">{money(item.amount)}</td>
                            <td className="px-4 py-3 text-right">{money(item.discountAmount)}</td>
                            <td className="px-4 py-3 text-right">{money(item.fineAmount)}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-950">{money(item.netAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <StatCard label="Total" value={money(selectedInvoice.totalAmount)} />
                    <StatCard label="Discount" value={money(selectedInvoice.discountAmount)} />
                    <StatCard label="Paid" value={money(selectedInvoice.paidAmount)} />
                    <StatCard label="Due" value={money(selectedInvoice.dueAmount)} />
                  </div>
                  {selectedReceipt ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-sm font-black text-emerald-800">Receipt {selectedReceipt.receiptNumber}</p>
                      <p className="text-sm text-emerald-700">Received {money(selectedReceipt.amount)} on {dateValue(selectedReceipt.receiptDate)}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Select an invoice to preview or print.</div>
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === 'discounts' ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Add Discount / Waiver" subtitle="Create student, class, section, or particular level discounts with approval status.">
              <form className="space-y-3" onSubmit={discountForm.handleSubmit((payload) => discountMutation.mutate(payload))}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Student">
                    <select className={inputClass} {...discountForm.register('studentId')}>
                      <option value="">Any student</option>
                      {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                    </select>
                  </Field>
                  <Field label="Class">
                    <select className={inputClass} {...discountForm.register('classId')}>
                      <option value="">Any class</option>
                      {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Section">
                    <select className={inputClass} {...discountForm.register('sectionId')}>
                      <option value="">Any section</option>
                      {selectedSectionOptions(sections, watchedDiscountClassId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Particular">
                    <select className={inputClass} {...discountForm.register('particularId')}>
                      <option value="">Any particular</option>
                      {particulars.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Discount Type">
                    <select className={inputClass} {...discountForm.register('discountType')}>
                      {discountTypes.map((type) => <option key={type} value={type}>{labelize(type)}</option>)}
                    </select>
                  </Field>
                  <Field label="Value Type">
                    <select className={inputClass} {...discountForm.register('valueType')}>
                      <option value="FIXED">Fixed</option>
                      <option value="PERCENTAGE">Percentage</option>
                    </select>
                  </Field>
                  <Field label="Value">
                    <input type="number" min="0" className={inputClass} {...discountForm.register('value')} />
                  </Field>
                  <Field label="Amount">
                    <input type="number" min="0" className={inputClass} {...discountForm.register('amount')} />
                  </Field>
                  <Field label="Valid From">
                    <input type="date" className={inputClass} {...discountForm.register('validFrom')} />
                  </Field>
                  <Field label="Valid To">
                    <input type="date" className={inputClass} {...discountForm.register('validTo')} />
                  </Field>
                </div>
                <Field label="Approval">
                  <select className={inputClass} {...discountForm.register('approvalStatus')}>
                    {(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'] as FeeApprovalStatus[]).map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                  </select>
                </Field>
                <Field label="Note">
                  <textarea className={`${inputClass} min-h-20`} {...discountForm.register('note')} />
                </Field>
                <PrimaryButton type="submit" disabled={discountMutation.isPending}>Save Discount</PrimaryButton>
              </form>
            </Card>

            <Card title="Add Fine Rule" subtitle="Create late fee rules with grace days.">
              <form className="space-y-3" onSubmit={fineForm.handleSubmit((payload) => fineMutation.mutate(payload))}>
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
                <PrimaryButton type="submit" disabled={fineMutation.isPending}>Save Fine</PrimaryButton>
              </form>
            </Card>

            <Card title="Discount List">
              <div className="space-y-3">
                {discounts.map((item: FeeDiscount) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-black text-slate-950">{labelize(item.discountType)}</p>
                      <p className="text-sm text-slate-500">{item.student?.fullName ?? item.class?.name ?? 'General'} · {labelize(item.valueType)} {item.value}</p>
                    </div>
                    <Badge tone={statusTone(item.approvalStatus)}>{labelize(item.approvalStatus)}</Badge>
                  </div>
                ))}
                {!discounts.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No discounts found.</p> : null}
              </div>
            </Card>

            <Card title="Fine Rules">
              <div className="space-y-3">
                {fines.map((item: FeeFine) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="font-black text-slate-950">{item.name}</p>
                      <p className="text-sm text-slate-500">{labelize(item.fineType)} · Grace {item.graceDays} days</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-950">{money(item.amount)}</p>
                      <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                    </div>
                  </div>
                ))}
                {!fines.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No fine rules found.</p> : null}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'ledger' ? (
          <div className="space-y-5">
            <Card title="Student Fee Ledger" subtitle="Student-wise debit, credit, and running balance.">
              <div className="mb-4 max-w-xl">
                <Field label="Student">
                  <select className={inputClass} value={ledgerStudentId} onChange={(event) => setLedgerStudentId(event.target.value)}>
                    {students.map((student) => <option key={student.id} value={student.id}>{student.fullName} ({student.admissionNo})</option>)}
                  </select>
                </Field>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <StatCard label="Student" value={selectedLedgerStudent?.fullName ?? '-'} note={selectedLedgerStudent?.admissionNo ?? ''} />
                <StatCard label="Class" value={classes.find((item) => item.id === selectedLedgerStudent?.classId)?.name ?? '-'} />
                <StatCard label="Entries" value={String(ledgerQuery.data?.length ?? 0)} />
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th><th className="px-4 py-3 text-right">Balance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(ledgerQuery.data ?? []).map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">{dateValue(entry.createdAt)}</td>
                        <td className="px-4 py-3"><Badge tone={entry.entryType === 'PAYMENT' ? 'success' : 'info'}>{labelize(entry.entryType)}</Badge></td>
                        <td className="px-4 py-3">{entry.description}</td>
                        <td className="px-4 py-3 text-right">{money(entry.debit)}</td>
                        <td className="px-4 py-3 text-right">{money(entry.credit)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-950">{money(entry.balance)}</td>
                      </tr>
                    ))}
                    {!ledgerQuery.data?.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No ledger entries found for this student.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'reports' ? (
          <div className="space-y-5">
            <Card title="Fee Reports" subtitle="Collection, due, outstanding, discount, fine, and class-wise fee reports." actions={<ExportButtons onPrint={() => window.print()} onCsv={() => downloadCsv('fee-collection-report.csv', (reports?.payments ?? []).map((payment) => ({ payment: payment.paymentNumber, student: payment.student?.fullName ?? '', admission: payment.student?.admissionNo ?? '', amount: numberValue(payment.amount), mode: payment.paymentMode, paidAt: payment.paidAt })))} />}>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <Field label="From">
                  <input type="date" className={inputClass} value={reportRange.from} onChange={(event) => setReportRange((current) => ({ ...current, from: event.target.value }))} />
                </Field>
                <Field label="To">
                  <input type="date" className={inputClass} value={reportRange.to} onChange={(event) => setReportRange((current) => ({ ...current, to: event.target.value }))} />
                </Field>
                <div className="flex items-end">
                  <PrimaryButton onClick={() => reportsQuery.refetch()} disabled={reportsQuery.isFetching}>Run Report</PrimaryButton>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Collected" value={money(reports?.totalCollected)} />
                <StatCard label="Invoiced" value={money(reports?.totalInvoiced)} />
                <StatCard label="Outstanding" value={money(reports?.totalOutstanding)} />
              </div>
            </Card>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card title="Class-wise Due Report">
                <div className="space-y-3">
                  {Object.entries(reports?.classWise ?? {}).map(([className, row]) => (
                    <div key={className} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-black text-slate-950">{className}</p>
                        <p className="text-sm font-bold text-slate-600">Due {money(row.due)}</p>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-red-500" style={{ width: `${Math.max(4, Math.min(100, (row.due / Math.max(row.invoiced, 1)) * 100))}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Invoiced {money(row.invoiced)}</p>
                    </div>
                  ))}
                  {!Object.keys(reports?.classWise ?? {}).length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No class-wise data yet.</p> : null}
                </div>
              </Card>

              <Card title="Daily Collection">
                <div className="space-y-3">
                  {Object.entries(reports?.dailyCollection ?? {}).map(([date, amount]) => (
                    <div key={date} className="grid gap-2 sm:grid-cols-[8rem_1fr_7rem] sm:items-center">
                      <span className="text-sm font-bold text-slate-600">{date}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.max(4, (amount / reportMaxDaily) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-black text-slate-950 sm:text-right">{money(amount)}</span>
                    </div>
                  ))}
                  {!Object.keys(reports?.dailyCollection ?? {}).length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No daily collection data yet.</p> : null}
                </div>
              </Card>
            </div>

            <Card title="Collection Report">
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Mode</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(reports?.payments ?? []).map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-3 font-bold text-slate-900">{payment.paymentNumber}</td>
                        <td className="px-4 py-3">{payment.student?.fullName ?? '-'}<p className="text-xs text-slate-500">{payment.student?.admissionNo ?? ''}</p></td>
                        <td className="px-4 py-3">{labelize(payment.paymentMode)}</td>
                        <td className="px-4 py-3">{dateValue(payment.paidAt)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-950">{money(payment.amount)}</td>
                      </tr>
                    ))}
                    {!reports?.payments?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No collection rows found.</td></tr> : null}
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
