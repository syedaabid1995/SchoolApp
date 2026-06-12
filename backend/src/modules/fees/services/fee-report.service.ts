import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../config/db';
import { HttpError } from '../../../middlewares/error.middleware';

const uuidSchema = z.string().uuid();
const feeInvoiceStatuses = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
export const feeReportTypes = [
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
] as const;
export const feeReportFormats = ['pdf', 'xlsx', 'csv'] as const;

export type FeeReportScope = {
  schoolId: string;
  academicSessionId: string;
};

export const feeReportQuerySchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  type: z.enum(feeReportTypes).default('daily_collection'),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  feeTypeId: uuidSchema.optional(),
  feeStructureId: uuidSchema.optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']).optional(),
  status: z.string().trim().optional(),
  collectedById: uuidSchema.optional(),
});

export type FeeReportQuery = z.infer<typeof feeReportQuerySchema>;
export type FeeReportType = (typeof feeReportTypes)[number];
export type FeeReportRow = Record<string, string | number | null>;

const tenantScopeOnly = (scope: FeeReportScope) => ({
  schoolId: scope.schoolId,
  academicSessionId: scope.academicSessionId,
});

const decimalNumber = (value: Prisma.Decimal | number | string | null | undefined) => Number(value ?? 0);

const reportDateRange = (from?: Date, to?: Date): Prisma.DateTimeFilter | undefined => {
  if (!from && !to) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    filter.gte = start;
  }
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
};

const dateKey = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const monthKey = (value: Date | string | null | undefined) => {
  if (!value) return 'Unassigned';
  if (typeof value === 'string' && value.trim()) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unassigned' : date.toISOString().slice(0, 7);
};

const buildClassSection = (className?: string | null, sectionName?: string | null) =>
  [className || 'Unassigned', sectionName || ''].filter(Boolean).join(' / ');

const addGroupAmount = <T extends Record<string, any>>(groups: Map<string, T>, key: string, seed: T, updater: (row: T) => void) => {
  if (!groups.has(key)) groups.set(key, seed);
  updater(groups.get(key)!);
};

export const parseFeeReportQuery = (query: unknown) => feeReportQuerySchema.parse(query);

export const buildFeeReport = async (scope: FeeReportScope, query: FeeReportQuery) => {
  const dateFrom = query.dateFrom ?? query.from;
  const dateTo = query.dateTo ?? query.to;
  if (dateFrom && dateTo && dateTo < dateFrom) throw new HttpError(400, 'dateTo cannot be before dateFrom');

  const dateFilter = reportDateRange(dateFrom, dateTo);
  const invoiceStatus = feeInvoiceStatuses.includes(query.status as any) ? query.status : undefined;
  const invoiceWhere: Prisma.FeeInvoiceWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
    ...(query.feeStructureId ? { feeStructureId: query.feeStructureId } : {}),
    ...(invoiceStatus ? { status: invoiceStatus as any } : {}),
    ...(dateFilter ? { issueDate: dateFilter } : {}),
  };
  const invoiceRelationFilter: Prisma.FeeInvoiceWhereInput = {
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
    ...(query.feeStructureId ? { feeStructureId: query.feeStructureId } : {}),
    ...(invoiceStatus ? { status: invoiceStatus as any } : {}),
  };
  const paymentWhere: Prisma.FeePaymentWhereInput = {
    ...tenantScopeOnly(scope),
    status: 'SUCCESS',
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.paymentMode ? { paymentMode: query.paymentMode } : {}),
    ...(query.collectedById ? { collectedById: query.collectedById } : {}),
    ...(dateFilter ? { paidAt: dateFilter } : {}),
    ...(Object.keys(invoiceRelationFilter).length ? { invoice: invoiceRelationFilter } : {}),
  };
  const receiptWhere: Prisma.FeeReceiptWhereInput = {
    ...tenantScopeOnly(scope),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(dateFilter ? { receiptDate: dateFilter } : {}),
    ...(Object.keys(invoiceRelationFilter).length ? { invoice: invoiceRelationFilter } : {}),
    ...(query.paymentMode || query.collectedById ? { payment: { ...(query.paymentMode ? { paymentMode: query.paymentMode } : {}), ...(query.collectedById ? { collectedById: query.collectedById } : {}) } } : {}),
  };
  const discountWhere: Prisma.FeeDiscountWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
    ...(query.status ? { approvalStatus: query.status as any } : {}),
  };
  const ledgerWhere: Prisma.FeeLedgerWhereInput = {
    ...tenantScopeOnly(scope),
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(dateFilter ? { entryDate: dateFilter } : {}),
    ...(Object.keys(invoiceRelationFilter).length ? { invoice: invoiceRelationFilter } : {}),
  };

  const [payments, invoices, discounts, fines, fineLedgers, receipts, ledgers] = await Promise.all([
    prisma.feePayment.findMany({
      where: paymentWhere,
      include: {
        student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        invoice: { select: { invoiceNumber: true, feeMonth: true, class: { select: { name: true } }, section: { select: { name: true } }, feeType: { select: { name: true } } } },
        receipt: { select: { receiptNumber: true, receiptDate: true } },
      },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.feeInvoice.findMany({
      where: invoiceWhere,
      include: {
        student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        class: { select: { name: true } },
        section: { select: { name: true } },
        feeType: { select: { name: true } },
      },
      orderBy: { issueDate: 'desc' },
    }),
    prisma.feeDiscount.findMany({
      where: discountWhere,
      include: {
        student: { select: { fullName: true, admissionNo: true } },
        class: { select: { name: true } },
        section: { select: { name: true } },
        category: { select: { name: true } },
        feeType: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.feeFine.findMany({ where: { ...tenantScopeOnly(scope), deletedAt: null, ...(query.status ? { status: query.status as any } : {}) }, orderBy: { createdAt: 'desc' } }),
    prisma.feeLedger.findMany({
      where: { ...ledgerWhere, OR: [{ type: 'FINE_DEBIT' }, { fineId: { not: null } }] },
      include: {
        student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        invoice: { select: { invoiceNumber: true } },
        fine: { select: { name: true, fineType: true } },
      },
      orderBy: { entryDate: 'desc' },
    }),
    prisma.feeReceipt.findMany({
      where: receiptWhere,
      include: {
        student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } }, section: { select: { name: true } } } },
        invoice: { select: { invoiceNumber: true } },
        payment: { select: { paymentMode: true, collectedById: true } },
      },
      orderBy: { receiptDate: 'desc' },
    }),
    prisma.feeLedger.findMany({
      where: ledgerWhere,
      include: { student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } }, section: { select: { name: true } } } } },
      orderBy: { entryDate: 'asc' },
    }),
  ]);

  const nonCancelledInvoices = invoices.filter((invoice) => invoice.status !== 'CANCELLED');
  const totalCollected = payments.reduce((sum, item) => sum + decimalNumber(item.amount), 0);
  const totalBilled = nonCancelledInvoices.reduce((sum, item) => sum + decimalNumber(item.totalAmount), 0);
  const totalDue = nonCancelledInvoices.reduce((sum, item) => sum + decimalNumber(item.dueAmount), 0);
  const totalDiscount = nonCancelledInvoices.reduce((sum, item) => sum + decimalNumber(item.discountAmount), 0);
  const totalFine = nonCancelledInvoices.reduce((sum, item) => sum + decimalNumber(item.fineAmount), 0);
  const totalCancelled = invoices.filter((item) => item.status === 'CANCELLED').reduce((sum, item) => sum + decimalNumber(item.totalAmount), 0);
  const dailyCollection = payments.reduce<Record<string, number>>((result, item) => {
    const key = dateKey(item.paidAt);
    result[key] = (result[key] ?? 0) + decimalNumber(item.amount);
    return result;
  }, {});
  const classWise = invoices.reduce<Record<string, { invoiced: number; due: number }>>((result, item) => {
    const key = item.class?.name ?? item.student.class?.name ?? 'Unassigned';
    result[key] = result[key] ?? { invoiced: 0, due: 0 };
    result[key].invoiced += decimalNumber(item.totalAmount);
    result[key].due += decimalNumber(item.dueAmount);
    return result;
  }, {});

  const buildRows = (type: FeeReportType): FeeReportRow[] => {
    if (type === 'daily_collection') {
      return payments.map((payment) => ({
        date: dateKey(payment.paidAt),
        receiptNumber: payment.receipt?.receiptNumber ?? '',
        student: payment.student.fullName,
        admissionNumber: payment.student.admissionNo,
        classSection: buildClassSection(payment.student.class?.name, payment.student.section?.name),
        paymentMode: payment.paymentMode,
        amount: decimalNumber(payment.amount),
        collectedBy: payment.collectedById ?? '',
      }));
    }
    if (type === 'monthly_collection') {
      const groups = new Map<string, { month: string; totalInvoices: number; totalBilled: number; totalCollected: number; totalDue: number }>();
      invoices.forEach((invoice) => addGroupAmount(groups, monthKey(invoice.feeMonth ?? invoice.issueDate), { month: monthKey(invoice.feeMonth ?? invoice.issueDate), totalInvoices: 0, totalBilled: 0, totalCollected: 0, totalDue: 0 }, (row) => {
        row.totalInvoices += 1;
        row.totalBilled += decimalNumber(invoice.totalAmount);
        row.totalDue += decimalNumber(invoice.dueAmount);
      }));
      payments.forEach((payment) => addGroupAmount(groups, monthKey(payment.paidAt), { month: monthKey(payment.paidAt), totalInvoices: 0, totalBilled: 0, totalCollected: 0, totalDue: 0 }, (row) => {
        row.totalCollected += decimalNumber(payment.amount);
      }));
      return Array.from(groups.values());
    }
    if (type === 'class_wise_due' || type === 'section_wise_due') {
      const groups = new Map<string, { class: string; section: string; students: Set<string>; totalBilled: number; paid: number; due: number }>();
      invoices.forEach((invoice) => {
        const className = invoice.class?.name ?? invoice.student.class?.name ?? 'Unassigned';
        const sectionName = invoice.section?.name ?? invoice.student.section?.name ?? '';
        const key = type === 'section_wise_due' ? `${className}:${sectionName}` : className;
        addGroupAmount(groups, key, { class: className, section: type === 'section_wise_due' ? sectionName : 'All', students: new Set<string>(), totalBilled: 0, paid: 0, due: 0 }, (row) => {
          row.students.add(invoice.studentId);
          row.totalBilled += decimalNumber(invoice.totalAmount);
          row.paid += decimalNumber(invoice.paidAmount);
          row.due += decimalNumber(invoice.dueAmount);
        });
      });
      return Array.from(groups.values()).map((row) => ({ class: row.class, section: row.section, studentsCount: row.students.size, totalBilled: row.totalBilled, paid: row.paid, due: row.due }));
    }
    if (type === 'student_wise_due' || type === 'outstanding_report') {
      const groups = new Map<string, { student: string; admissionNumber: string; classSection: string; billed: number; paid: number; due: number }>();
      invoices.forEach((invoice) => addGroupAmount(groups, invoice.studentId, { student: invoice.student.fullName, admissionNumber: invoice.student.admissionNo, classSection: buildClassSection(invoice.student.class?.name, invoice.student.section?.name), billed: 0, paid: 0, due: 0 }, (row) => {
        row.billed += decimalNumber(invoice.totalAmount);
        row.paid += decimalNumber(invoice.paidAmount);
        row.due += decimalNumber(invoice.dueAmount);
      }));
      return Array.from(groups.values()).filter((row) => type === 'student_wise_due' || row.due > 0);
    }
    if (type === 'discount_report') {
      return discounts.map((discount) => ({
        discountName: discount.discountName ?? discount.discountType,
        studentOrTarget: discount.student?.fullName ?? discount.class?.name ?? discount.section?.name ?? discount.category?.name ?? discount.feeType?.name ?? discount.targetType,
        discountType: discount.valueType,
        amount: decimalNumber(discount.amount ?? discount.value),
        status: discount.approvalStatus,
        approvedBy: discount.approvedById ?? '',
      }));
    }
    if (type === 'fine_report') {
      return fineLedgers.map((ledger) => ({
        student: ledger.student.fullName,
        invoice: ledger.invoice?.invoiceNumber ?? '',
        fineRule: ledger.fine?.name ?? ledger.description,
        fineType: ledger.fine?.fineType ?? '',
        fineAmount: decimalNumber(ledger.debitAmount),
        appliedDate: dateKey(ledger.entryDate),
      }));
    }
    if (type === 'cancelled_invoice_report') {
      return invoices.filter((invoice) => invoice.status === 'CANCELLED').map((invoice) => ({
        invoiceNumber: invoice.invoiceNumber,
        student: invoice.student.fullName,
        amount: decimalNumber(invoice.totalAmount),
        cancelledBy: invoice.createdById ?? '',
        cancelledDate: dateKey(invoice.updatedAt),
        reason: '',
      }));
    }
    if (type === 'payment_mode_report') {
      const groups = new Map<string, { paymentMode: string; transactionCount: number; totalAmount: number }>();
      payments.forEach((payment) => addGroupAmount(groups, payment.paymentMode, { paymentMode: payment.paymentMode, transactionCount: 0, totalAmount: 0 }, (row) => {
        row.transactionCount += 1;
        row.totalAmount += decimalNumber(payment.amount);
      }));
      return Array.from(groups.values());
    }
    if (type === 'accountant_wise_collection') {
      const groups = new Map<string, { accountant: string; receiptCount: number; cashTotal: number; onlineTotal: number; totalCollected: number }>();
      payments.forEach((payment) => addGroupAmount(groups, payment.collectedById ?? 'Unassigned', { accountant: payment.collectedById ?? 'Unassigned', receiptCount: 0, cashTotal: 0, onlineTotal: 0, totalCollected: 0 }, (row) => {
        row.receiptCount += payment.receipt ? 1 : 0;
        if (payment.paymentMode === 'CASH') row.cashTotal += decimalNumber(payment.amount);
        else row.onlineTotal += decimalNumber(payment.amount);
        row.totalCollected += decimalNumber(payment.amount);
      }));
      return Array.from(groups.values());
    }
    if (type === 'receipt_report') {
      return receipts.map((receipt) => ({
        receiptNumber: receipt.receiptNumber,
        date: dateKey(receipt.receiptDate),
        student: receipt.student.fullName,
        admissionNumber: receipt.student.admissionNo,
        invoiceNumber: receipt.invoice.invoiceNumber,
        paymentMode: receipt.payment.paymentMode,
        amount: decimalNumber(receipt.amount),
        collectedBy: receipt.payment.collectedById ?? '',
      }));
    }
    if (type === 'ledger_summary') {
      const groups = new Map<string, { student: string; admissionNumber: string; classSection: string; openingBalance: number; debit: number; credit: number; closingBalance: number; initialized: boolean }>();
      ledgers.forEach((ledger) => addGroupAmount(groups, ledger.studentId, { student: ledger.student.fullName, admissionNumber: ledger.student.admissionNo, classSection: buildClassSection(ledger.student.class?.name, ledger.student.section?.name), openingBalance: 0, debit: 0, credit: 0, closingBalance: 0, initialized: false }, (row) => {
        const debit = decimalNumber(ledger.debitAmount);
        const credit = decimalNumber(ledger.creditAmount);
        const balance = decimalNumber(ledger.balanceAfter);
        if (!row.initialized) {
          row.openingBalance = balance - debit + credit;
          row.initialized = true;
        }
        row.debit += debit;
        row.credit += credit;
        row.closingBalance = balance;
      }));
      return Array.from(groups.values()).map(({ initialized: _initialized, ...row }) => row);
    }
    return [];
  };

  const rows = buildRows(query.type);
  return {
    type: query.type,
    filters: {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      dateFrom: dateFrom ? dateKey(dateFrom) : null,
      dateTo: dateTo ? dateKey(dateTo) : null,
      classId: query.classId ?? null,
      sectionId: query.sectionId ?? null,
      studentId: query.studentId ?? null,
      feeTypeId: query.feeTypeId ?? null,
      feeStructureId: query.feeStructureId ?? null,
      paymentMode: query.paymentMode ?? null,
      status: query.status ?? null,
      collectedById: query.collectedById ?? null,
    },
    summary: {
      totalBilled,
      totalCollected,
      totalDiscount,
      totalFine,
      totalDue,
      totalCancelled,
      totalReceipts: receipts.length,
    },
    rows,
    totalCollected,
    totalInvoiced: totalBilled,
    totalOutstanding: totalDue,
    payments,
    invoices,
    discounts,
    fines,
    dailyCollection,
    classWise,
  };
};
