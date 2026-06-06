import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FeeLedgerEntryType, Prisma, type FeeDiscount, type Student, type StudentFeeAssignment } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import {
  calculateFeeInvoiceAmountsFromPreloaded,
  type FeeCalculationDiscount,
  type FeeInvoiceCalculation,
} from '../services/feeCalculation.service';
import { createLedgerEntry } from '../services/feeLedger.service';
import { getNextNumber } from '../services/numberSequence.service';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();
const uuidParam = (req: Request, name = 'id') => uuidSchema.parse(req.params[name]);
const decimalInput = z.coerce.number().min(0).max(100000000);
const positiveDecimalInput = z.coerce.number().positive('Amount must be greater than 0').max(100000000);
const dateInput = z.coerce.date().optional().nullable();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const feeInvoiceStatuses = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
const feeReportTypes = [
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
const feeReportFormats = ['pdf', 'xlsx', 'csv'] as const;

const defaultFeeParticulars = [
  'Monthly Tuition Fee',
  'Admission Fee',
  'Registration Fee',
  'Annual Fee',
  'Examination Fee',
  'Books Fee',
  'Uniform Fee',
  'Art Material Fee',
  'Computer Fee',
  'Library Fee',
  'Laboratory Fee',
  'Smart Class Fee',
  'Sports Fee',
  'Activity Fee',
  'Transport Fee',
  'Hostel Fee',
  'Fine',
  'Other Charges',
  'Previous Balance',
  'Discount',
];

const defaultFeeTypes = [
  { name: 'Monthly', code: 'MONTHLY', schedule: 'MONTHLY' },
  { name: 'Quarterly', code: 'QUARTERLY', schedule: 'QUARTERLY' },
  { name: 'Half-Yearly', code: 'HALF_YEARLY', schedule: 'HALF_YEARLY' },
  { name: 'Yearly', code: 'YEARLY', schedule: 'YEARLY' },
  { name: 'One Time', code: 'ONE_TIME', schedule: 'ONE_TIME' },
] as const;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeName = (value: string) => normalizeText(value).toLowerCase();
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};
const slugCode = (value: string) =>
  normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
const toDecimal = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value);
const decimalNumber = (value: Prisma.Decimal | number | string | null | undefined) => Number(value ?? 0);

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireFeeManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.role === 'SCHOOL_ADMIN' || req.auth.role === 'ACCOUNTANT') {
    if (!req.auth.schoolId) throw new HttpError(403, 'School scope is required');
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'Only School Admin or Accountant can manage fees');
};

const resolveAcademicSessionId = async (schoolId: string, requested?: string | null) => {
  if (requested) {
    const found = await prisma.academicYear.findFirst({ where: { id: requested, schoolId }, select: { id: true } });
    if (!found) throw new HttpError(404, 'Academic session not found');
    return requested;
  }

  const active = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (active) return active.id;

  const latest = await prisma.academicYear.findFirst({
    where: { schoolId },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (!latest) throw new HttpError(400, 'Create an academic session before using fees');
  return latest.id;
};

const resolveScope = async (req: Request, body?: { schoolId?: string | null; academicSessionId?: string | null }) => {
  const { schoolId, userId } = requireFeeManager(req, getRequestedSchoolId(req, body?.schoolId));
  const academicSessionId = await resolveAcademicSessionId(
    schoolId,
    body?.academicSessionId ?? (typeof req.query.academicSessionId === 'string' ? req.query.academicSessionId : undefined),
  );
  return { schoolId, academicSessionId, userId };
};

const pagination = (req: Request) => {
  const page = pageSchema.parse(req.query.page ?? 1);
  const limit = limitSchema.parse(req.query.limit ?? 20);
  return { page, limit, skip: (page - 1) * limit };
};

const handleUniqueError = (err: unknown, message: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, message);
  }
  throw err;
};

const uniqueTargetIncludes = (err: unknown, field: string) =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === 'P2002' &&
  Array.isArray(err.meta?.target) &&
  (err.meta.target as unknown[]).includes(field);

const isUniqueConstraintError = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const referenceRequiredPaymentModes = new Set(['UPI', 'BANK_TRANSFER', 'CARD', 'ONLINE_GATEWAY']);
const paymentModes = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY'] as const;
const paymentStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
const paymentSortFields = ['paidAt', 'paymentDate', 'createdAt', 'amount'] as const;
const discountSortFields = ['createdAt', 'validFrom', 'validTo', 'discountName'] as const;
const fineSortFields = ['createdAt', 'name', 'amount'] as const;
const assignmentTargetTypes = ['CLASS', 'SECTION', 'STUDENT', 'GROUP', 'CATEGORY', 'TRANSPORT_ROUTE'] as const;
const assignableStudentStatus = 'ENROLLED' as const;

const legacyDiscountTypes = ['SCHOLARSHIP', 'SIBLING_DISCOUNT', 'STAFF_CHILD_DISCOUNT', 'SPECIAL_DISCOUNT'] as const;
const discountValueTypes = ['PERCENTAGE', 'FIXED'] as const;
const discountApprovalStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'] as const;
const discountTargetTypes = ['STUDENT', 'CLASS', 'SECTION', 'CATEGORY', 'FEE_TYPE', 'ALL'] as const;
const approvedDiscountStatuses = ['APPROVED', 'ACTIVE'] as const;

type LegacyDiscountType = (typeof legacyDiscountTypes)[number];
type FeeDiscountValueType = (typeof discountValueTypes)[number];
type FeeDiscountStatus = (typeof discountApprovalStatuses)[number];
type FeeDiscountTarget = (typeof discountTargetTypes)[number];
type FeePaymentModeValue = (typeof paymentModes)[number];
type FeePaymentStatusValue = (typeof paymentStatuses)[number];
type FeeAssignmentTarget = (typeof assignmentTargetTypes)[number];
type FeeTenantScope = { schoolId: string; academicSessionId: string };

type NormalizedDiscountPayload = {
  schoolId?: string | null;
  academicSessionId?: string | null;
  discountName: string;
  targetType: FeeDiscountTarget;
  studentId: string | null;
  classId: string | null;
  sectionId: string | null;
  categoryId: string | null;
  feeTypeId: string | null;
  particularId: string | null;
  discountType: LegacyDiscountType;
  valueType: FeeDiscountValueType;
  value: Prisma.Decimal;
  amount: Prisma.Decimal | null;
  validFrom: Date | null;
  validTo: Date | null;
  approvalStatus: FeeDiscountStatus;
  reason: string | null;
  note: string | null;
};

const ensureFeeDefaults = async (schoolId: string, academicSessionId: string) => {
  const [particularCount, typeCount] = await Promise.all([
    prisma.feeParticular.count({ where: { schoolId, academicSessionId } }),
    prisma.feeType.count({ where: { schoolId, academicSessionId } }),
  ]);

  if (!particularCount) {
    await prisma.feeParticular.createMany({
      skipDuplicates: true,
      data: defaultFeeParticulars.map((name, index) => ({
        schoolId,
        academicSessionId,
        name,
        normalizedName: normalizeName(name),
        code: slugCode(name),
        type:
          name === 'Discount'
            ? 'DISCOUNT'
            : name === 'Fine'
              ? 'FINE'
              : name === 'Previous Balance'
                ? 'PREVIOUS_BALANCE'
                : name === 'Transport Fee'
                  ? 'TRANSPORT'
                  : name === 'Hostel Fee'
                    ? 'HOSTEL'
                    : 'CHARGE',
        isMandatory: ['Monthly Tuition Fee', 'Admission Fee'].includes(name),
        isSystemGenerated: true,
        status: 'ACTIVE',
        sortOrder: index + 1,
      })),
    });
  }

  if (!typeCount) {
    await prisma.feeType.createMany({
      skipDuplicates: true,
      data: defaultFeeTypes.map((item, index) => ({
        schoolId,
        academicSessionId,
        name: item.name,
        normalizedName: normalizeName(item.name),
        code: item.code,
        schedule: item.schedule,
        status: 'ACTIVE',
        sortOrder: index + 1,
      })),
    });
  }
};

const assertClass = async (schoolId: string, classId: string) => {
  const found = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Class not found');
};

const assertSection = async (schoolId: string, sectionId?: string | null) => {
  if (!sectionId) return;
  const found = await prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Section not found');
};

const assertStudent = async (schoolId: string, studentId: string, academicSessionId?: string) => {
  const found = await prisma.student.findFirst({
    where: { id: studentId, schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Student not found');
};

const assertFeeType = async (schoolId: string, academicSessionId: string, feeTypeId: string) => {
  const found = await prisma.feeType.findFirst({
    where: { id: feeTypeId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee type not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee type cannot be used');
};

const assertStudentCategory = async (schoolId: string, categoryId: string) => {
  const found = await prisma.studentCategory.findFirst({ where: { id: categoryId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student category not found');
};

const assertStudentGroup = async (schoolId: string, groupId: string) => {
  const found = await prisma.studentGroup.findFirst({ where: { id: groupId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student group not found');
};

const assertTransportRoute = async (schoolId: string, transportRouteId: string) => {
  const found = await prisma.transportRoute.findFirst({ where: { id: transportRouteId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Transport route not found');
};

const assertParticulars = async (schoolId: string, academicSessionId: string, ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids));
  const found = await prisma.feeParticular.findMany({
    where: { id: { in: uniqueIds }, schoolId, academicSessionId, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== uniqueIds.length) throw new HttpError(404, 'One or more fee particulars were not found');
};

const discountSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  discountName: z.string().trim().min(1).max(160).optional().nullable(),
  targetType: z.enum(discountTargetTypes).optional(),
  studentId: uuidSchema.optional().nullable(),
  classId: uuidSchema.optional().nullable(),
  sectionId: uuidSchema.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  feeTypeId: uuidSchema.optional().nullable(),
  particularId: uuidSchema.optional().nullable(),
  discountType: z.string().trim().optional(),
  valueType: z.enum(discountValueTypes).optional(),
  discountValue: decimalInput.optional(),
  value: decimalInput.optional(),
  amount: decimalInput.optional().nullable(),
  validFrom: dateInput,
  validTo: dateInput,
  status: z.enum(discountApprovalStatuses).optional(),
  approvalStatus: z.enum(discountApprovalStatuses).optional(),
  reason: z.string().trim().max(1000).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
});

const normalizeDiscountPayload = (payload: z.infer<typeof discountSchema>, fallbackStatus: FeeDiscountStatus = 'PENDING_APPROVAL'): NormalizedDiscountPayload => {
  const rawDiscountType = payload.discountType?.trim();
  const usesValueTypeAsDiscountType = rawDiscountType === 'FIXED' || rawDiscountType === 'PERCENTAGE';
  const valueType = (payload.valueType ?? (usesValueTypeAsDiscountType ? rawDiscountType : undefined)) as FeeDiscountValueType | undefined;
  if (!valueType || !discountValueTypes.includes(valueType)) throw new HttpError(400, 'discountType or valueType must be FIXED or PERCENTAGE');

  const valueSource = payload.discountValue ?? payload.value;
  if (valueSource === undefined || valueSource === null) throw new HttpError(400, 'discountValue is required');
  const value = toDecimal(valueSource);
  if (value.lte(0)) throw new HttpError(400, 'Discount value must be greater than 0');
  if (valueType === 'PERCENTAGE' && value.gt(100)) throw new HttpError(400, 'Percentage discount cannot exceed 100%');

  const legacyType = rawDiscountType && legacyDiscountTypes.includes(rawDiscountType as LegacyDiscountType)
    ? (rawDiscountType as LegacyDiscountType)
    : 'SPECIAL_DISCOUNT';
  const targetType =
    payload.targetType ??
    (payload.studentId
      ? 'STUDENT'
      : payload.sectionId
        ? 'SECTION'
        : payload.classId
          ? 'CLASS'
          : payload.categoryId
            ? 'CATEGORY'
            : payload.feeTypeId
              ? 'FEE_TYPE'
              : 'ALL');
  const validFrom = payload.validFrom ?? null;
  const validTo = payload.validTo ?? null;
  if (validFrom && validTo && validTo < validFrom) throw new HttpError(400, 'validTo cannot be before validFrom');

  const normalized: NormalizedDiscountPayload = {
    schoolId: payload.schoolId ?? null,
    academicSessionId: payload.academicSessionId ?? null,
    discountName: normalizeText(payload.discountName || rawDiscountType || 'Fee Discount'),
    targetType,
    studentId: payload.studentId ?? null,
    classId: payload.classId ?? null,
    sectionId: payload.sectionId ?? null,
    categoryId: payload.categoryId ?? null,
    feeTypeId: payload.feeTypeId ?? null,
    particularId: payload.particularId ?? null,
    discountType: legacyType,
    valueType,
    value,
    amount: payload.amount === undefined || payload.amount === null ? null : toDecimal(payload.amount),
    validFrom,
    validTo,
    approvalStatus: payload.status ?? payload.approvalStatus ?? fallbackStatus,
    reason: nullableText(payload.reason),
    note: nullableText(payload.note),
  };

  validateDiscountTarget(normalized);
  return normalized;
};

function validateDiscountTarget(payload: NormalizedDiscountPayload) {
  if (payload.targetType === 'STUDENT') {
    if (!payload.studentId) throw new HttpError(400, 'studentId is required for STUDENT discount');
    if (payload.classId || payload.sectionId || payload.categoryId) throw new HttpError(400, 'STUDENT discount cannot include class, section, or category target');
  }
  if (payload.targetType === 'CLASS') {
    if (!payload.classId) throw new HttpError(400, 'classId is required for CLASS discount');
    if (payload.studentId || payload.sectionId || payload.categoryId) throw new HttpError(400, 'CLASS discount cannot include student, section, or category target');
  }
  if (payload.targetType === 'SECTION') {
    if (!payload.sectionId) throw new HttpError(400, 'sectionId is required for SECTION discount');
    if (payload.studentId || payload.categoryId) throw new HttpError(400, 'SECTION discount cannot include student or category target');
  }
  if (payload.targetType === 'CATEGORY') {
    if (!payload.categoryId) throw new HttpError(400, 'categoryId is required for CATEGORY discount');
    if (payload.studentId || payload.classId || payload.sectionId) throw new HttpError(400, 'CATEGORY discount cannot include student, class, or section target');
  }
  if (payload.targetType === 'FEE_TYPE') {
    if (!payload.feeTypeId) throw new HttpError(400, 'feeTypeId is required for FEE_TYPE discount');
    if (payload.studentId || payload.classId || payload.sectionId || payload.categoryId) throw new HttpError(400, 'FEE_TYPE discount cannot include student, class, section, or category target');
  }
  if (payload.targetType === 'ALL' && (payload.studentId || payload.classId || payload.sectionId || payload.categoryId || payload.feeTypeId)) {
    throw new HttpError(400, 'ALL discount cannot include a specific target field');
  }
}

const assertDiscountReferences = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload) => {
  if (payload.studentId) await assertStudent(scope.schoolId, payload.studentId, scope.academicSessionId);
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId) await assertSection(scope.schoolId, payload.sectionId);
  if (payload.categoryId) await assertStudentCategory(scope.schoolId, payload.categoryId);
  if (payload.feeTypeId) await assertFeeType(scope.schoolId, scope.academicSessionId, payload.feeTypeId);
  if (payload.particularId) await assertParticulars(scope.schoolId, scope.academicSessionId, [payload.particularId]);
};

const requireDiscountApprover = (req: Request) => {
  if (req.auth?.role !== 'SCHOOL_ADMIN') throw new HttpError(403, 'Only School Admin can approve or reject discounts');
};

const assertDiscountApprovalAllowed = (req: Request, status: FeeDiscountStatus) => {
  if (['APPROVED', 'ACTIVE', 'REJECTED'].includes(status)) requireDiscountApprover(req);
};

const assertNoDuplicateActiveDiscount = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload, excludeId?: string) => {
  if (!approvedDiscountStatuses.includes(payload.approvalStatus as (typeof approvedDiscountStatuses)[number])) return;
  const and: Prisma.FeeDiscountWhereInput[] = [];
  if (payload.validTo) and.push({ OR: [{ validFrom: null }, { validFrom: { lte: payload.validTo } }] });
  if (payload.validFrom) and.push({ OR: [{ validTo: null }, { validTo: { gte: payload.validFrom } }] });
  const duplicate = await prisma.feeDiscount.findFirst({
    where: {
      ...tenantScopeOnly(scope),
      ...(excludeId ? { id: { not: excludeId } } : {}),
      deletedAt: null,
      approvalStatus: { in: [...approvedDiscountStatuses] },
      targetType: payload.targetType,
      studentId: payload.studentId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      categoryId: payload.categoryId,
      feeTypeId: payload.feeTypeId,
      ...(and.length ? { AND: and } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Duplicate active discount exists for the same target, fee type, and date range');
};

const buildDiscountInvoiceWhere = (scope: FeeTenantScope, discount: Pick<NormalizedDiscountPayload, 'targetType' | 'studentId' | 'classId' | 'sectionId' | 'categoryId' | 'feeTypeId'>): Prisma.FeeInvoiceWhereInput => ({
  ...tenantScopeOnly(scope),
  deletedAt: null,
  status: { in: ['PAID', 'PARTIALLY_PAID'] },
  discountAmount: { gt: 0 },
  ...(discount.feeTypeId ? { feeTypeId: discount.feeTypeId } : {}),
  ...(discount.targetType === 'STUDENT' && discount.studentId ? { studentId: discount.studentId } : {}),
  ...(discount.targetType === 'CLASS' && discount.classId ? { classId: discount.classId } : {}),
  ...(discount.targetType === 'SECTION' && discount.sectionId ? { sectionId: discount.sectionId } : {}),
  ...(discount.targetType === 'CATEGORY' && discount.categoryId ? { student: { studentCategoryId: discount.categoryId } } : {}),
});

const assertDiscountNotLockedByPayment = async (scope: FeeTenantScope, discount: FeeDiscount) => {
  const paidCount = await prisma.feeInvoice.count({ where: buildDiscountInvoiceWhere(scope, discount) });
  if (paidCount > 0) {
    throw new HttpError(409, 'Discount is already applied to a paid or partially paid invoice. Use reversal or adjustment flow.');
  }
};

const assertDiscountDoesNotExceedCurrentPayable = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload) => {
  if (!payload.studentId || payload.valueType !== 'FIXED') return;
  const payable = toDecimal(
    (
      await prisma.feeInvoice.aggregate({
        where: {
          ...tenantScopeOnly(scope),
          studentId: payload.studentId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        _sum: { dueAmount: true },
      })
    )._sum.dueAmount ?? 0,
  );
  const discountAmount = toDecimal(payload.amount ?? payload.value);
  if (payable.gt(0) && discountAmount.gt(payable)) throw new HttpError(400, 'Discount cannot exceed payable amount');
};

const buildDiscountTargetInvoiceWhere = (
  scope: FeeTenantScope,
  discount: Pick<FeeDiscount, 'targetType' | 'studentId' | 'classId' | 'sectionId' | 'categoryId' | 'feeTypeId'>,
): Prisma.FeeInvoiceWhereInput => ({
  ...tenantScopeOnly(scope),
  deletedAt: null,
  ...(discount.feeTypeId ? { feeTypeId: discount.feeTypeId } : {}),
  ...(discount.targetType === 'STUDENT' && discount.studentId ? { studentId: discount.studentId } : {}),
  ...(discount.targetType === 'CLASS' && discount.classId ? { classId: discount.classId } : {}),
  ...(discount.targetType === 'SECTION' && discount.sectionId ? { sectionId: discount.sectionId } : {}),
  ...(discount.targetType === 'CATEGORY' && discount.categoryId ? { student: { studentCategoryId: discount.categoryId } } : {}),
});

const discountAmountForInvoice = (
  discount: Pick<FeeDiscount, 'valueType' | 'value' | 'amount'>,
  invoice: Pick<Prisma.FeeInvoiceGetPayload<{}>, 'totalAmount' | 'dueAmount'>,
) => {
  const value = toDecimal(discount.amount ?? discount.value);
  const rawAmount = discount.valueType === 'PERCENTAGE' ? toDecimal(invoice.totalAmount).mul(value).div(100) : value;
  return Prisma.Decimal.min(rawAmount, toDecimal(invoice.dueAmount));
};

const applyApprovedDiscountToOpenInvoices = async (
  tx: Prisma.TransactionClient,
  scope: FeeTenantScope & { userId: string },
  discount: FeeDiscount,
) => {
  if (!approvedDiscountStatuses.includes(discount.approvalStatus as (typeof approvedDiscountStatuses)[number])) return;

  const existingLedger = await tx.feeLedger.count({
    where: {
      ...tenantScopeOnly(scope),
      discountId: discount.id,
      type: 'DISCOUNT_CREDIT',
    },
  });
  if (existingLedger) return;

  const targetWhere = buildDiscountTargetInvoiceWhere(scope, discount);
  const lockedInvoice = await tx.feeInvoice.findFirst({
    where: {
      ...targetWhere,
      status: { in: ['PAID', 'CANCELLED'] },
    },
    select: { id: true },
  });
  if (lockedInvoice) throw new HttpError(409, 'Cannot apply discount directly to paid or cancelled invoice');

  const invoices = await tx.feeInvoice.findMany({
    where: {
      ...targetWhere,
      status: { in: ['ISSUED', 'OVERDUE', 'PARTIALLY_PAID'] },
      dueAmount: { gt: 0 },
    },
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }],
  });

  for (const invoice of invoices) {
    const discountAmount = discountAmountForInvoice(discount, invoice);
    if (discountAmount.lte(0)) continue;
    const newDiscountAmount = toDecimal(invoice.discountAmount).plus(discountAmount);
    const newDueAmount = calculateInvoiceDueFromParts({ ...invoice, discountAmount: newDiscountAmount });
    await tx.feeInvoice.update({
      where: { id: invoice.id },
      data: {
        discountAmount: newDiscountAmount,
        dueAmount: newDueAmount,
        status: newDueAmount.eq(0) ? 'PAID' : invoice.status,
      },
    });
    await createLedgerEntry(tx, {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      studentId: invoice.studentId,
      invoiceId: invoice.id,
      discountId: discount.id,
      type: 'DISCOUNT_CREDIT',
      description: `${discount.discountName ?? discount.discountType.replace(/_/g, ' ')} discount applied`,
      creditAmount: discountAmount,
      createdById: scope.userId,
    });
  }
};

const assignmentSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  feeStructureId: uuidSchema,
  targetType: z.enum(assignmentTargetTypes).optional(),
  mode: z.enum(['CLASS', 'SECTION', 'STUDENTS']).optional(),
  classId: uuidSchema.optional().nullable(),
  sectionId: uuidSchema.optional().nullable(),
  studentId: uuidSchema.optional().nullable(),
  studentIds: z.array(uuidSchema).optional(),
  groupId: uuidSchema.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  transportRouteId: uuidSchema.optional().nullable(),
  overrideAmount: decimalInput.optional().nullable(),
  startMonth: z.string().trim().max(30).optional().nullable(),
  endMonth: z.string().trim().max(30).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  autoAssigned: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const monthNames = new Map(
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].map((name, index) => [name, index + 1]),
);

const currentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const monthIndex = (value?: string | null) => {
  if (!value || value === 'CURRENT') return null;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(trimmed);
  if (iso) return Number(iso[1]) * 12 + Number(iso[2]);
  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (named) {
    const month = monthNames.get(named[1].toLowerCase());
    if (month) return Number(named[2]) * 12 + month;
  }
  throw new HttpError(400, 'Month must be in YYYY-MM or Month YYYY format');
};

const assertMonthRange = (startMonth: string, endMonth?: string | null) => {
  const start = monthIndex(startMonth);
  const end = monthIndex(endMonth);
  if (start !== null && end !== null && end < start) throw new HttpError(400, 'endMonth cannot be before startMonth');
};

const isAssignmentActiveForMonth = (assignment: { startMonth?: string | null; endMonth?: string | null }, feeMonth?: string | null) => {
  const invoiceMonth = monthIndex(feeMonth && feeMonth !== 'CURRENT' ? feeMonth : null);
  if (invoiceMonth === null) return true;
  const start = monthIndex(assignment.startMonth);
  const end = monthIndex(assignment.endMonth);
  return (start === null || start <= invoiceMonth) && (end === null || end >= invoiceMonth);
};

const activeStudentWhere = (scope: FeeTenantScope, extra: Prisma.StudentWhereInput = {}): Prisma.StudentWhereInput => ({
  schoolId: scope.schoolId,
  academicSessionId: scope.academicSessionId,
  status: assignableStudentStatus,
  ...extra,
});

const assignmentTargetFromPayload = (payload: z.infer<typeof assignmentSchema>): FeeAssignmentTarget => {
  if (payload.targetType) return payload.targetType;
  if (payload.mode === 'STUDENTS' || payload.studentId || payload.studentIds?.length) return 'STUDENT';
  if (payload.mode === 'SECTION' || payload.sectionId) return 'SECTION';
  return 'CLASS';
};

const assertAssignmentTargetFields = (targetType: FeeAssignmentTarget, payload: z.infer<typeof assignmentSchema>) => {
  if (targetType === 'CLASS' && !payload.classId) throw new HttpError(400, 'classId is required for CLASS assignment');
  if (targetType === 'SECTION' && !payload.sectionId) throw new HttpError(400, 'sectionId is required for SECTION assignment');
  if (targetType === 'STUDENT' && !payload.studentId && !payload.studentIds?.length) throw new HttpError(400, 'studentId or studentIds is required for STUDENT assignment');
  if (targetType === 'GROUP' && !payload.groupId) throw new HttpError(400, 'groupId is required for GROUP assignment');
  if (targetType === 'CATEGORY' && !payload.categoryId) throw new HttpError(400, 'categoryId is required for CATEGORY assignment');
  if (targetType === 'TRANSPORT_ROUTE' && !payload.transportRouteId) throw new HttpError(400, 'transportRouteId is required for TRANSPORT_ROUTE assignment');
};

const assignmentDuplicateWhere = (
  scope: FeeTenantScope,
  payload: z.infer<typeof assignmentSchema>,
  targetType: FeeAssignmentTarget,
  studentId?: string | null,
  excludeId?: string,
): Prisma.StudentFeeAssignmentWhereInput => ({
  ...tenantScopeOnly(scope),
  ...(excludeId ? { id: { not: excludeId } } : {}),
  feeStructureId: payload.feeStructureId,
  targetType,
  status: 'ACTIVE',
  deletedAt: null,
  ...(targetType === 'CLASS' ? { classId: payload.classId ?? null } : {}),
  ...(targetType === 'SECTION' ? { sectionId: payload.sectionId ?? null } : {}),
  ...(targetType === 'STUDENT' ? { studentId: studentId ?? payload.studentId ?? null } : {}),
  ...(targetType === 'GROUP' ? { groupId: payload.groupId ?? null } : {}),
  ...(targetType === 'CATEGORY' ? { categoryId: payload.categoryId ?? null } : {}),
  ...(targetType === 'TRANSPORT_ROUTE' ? { transportRouteId: payload.transportRouteId ?? null } : {}),
});

const assignmentPriority: Record<FeeAssignmentTarget, number> = {
  STUDENT: 1,
  GROUP: 2,
  CATEGORY: 2,
  TRANSPORT_ROUTE: 2,
  SECTION: 3,
  CLASS: 4,
};


const includeStructure = {
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  feeType: { select: { id: true, name: true, schedule: true } },
  items: {
    include: { particular: { select: { id: true, name: true, code: true, type: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  _count: { select: { assignments: true, invoices: true } },
} satisfies Prisma.FeeStructureInclude;

const includeAssignment = {
  student: { select: { id: true, admissionNo: true, fullName: true, class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, classId: true } },
  group: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  transportRoute: { select: { id: true, title: true, fare: true } },
  feeStructure: { include: includeStructure },
} satisfies Prisma.StudentFeeAssignmentInclude;

const includeInvoiceStudent = {
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

type InvoiceStudent = Prisma.StudentGetPayload<{ include: typeof includeInvoiceStudent }>;

const assignmentData = (
  scope: FeeTenantScope,
  payload: z.infer<typeof assignmentSchema>,
  targetType: FeeAssignmentTarget,
  studentId: string | null,
  userId: string,
): Prisma.StudentFeeAssignmentCreateInput => ({
  school: { connect: { id: scope.schoolId } },
  academicSession: { connect: { id: scope.academicSessionId } },
  feeStructure: { connect: { id: payload.feeStructureId } },
  targetType,
  class: targetType === 'CLASS' || targetType === 'SECTION' ? (payload.classId ? { connect: { id: payload.classId } } : undefined) : undefined,
  section: targetType === 'SECTION' && payload.sectionId ? { connect: { id: payload.sectionId } } : undefined,
  student: targetType === 'STUDENT' && studentId ? { connect: { id: studentId } } : undefined,
  group: targetType === 'GROUP' && payload.groupId ? { connect: { id: payload.groupId } } : undefined,
  category: targetType === 'CATEGORY' && payload.categoryId ? { connect: { id: payload.categoryId } } : undefined,
  transportRoute: targetType === 'TRANSPORT_ROUTE' && payload.transportRouteId ? { connect: { id: payload.transportRouteId } } : undefined,
  overrideAmount: payload.overrideAmount === undefined || payload.overrideAmount === null ? null : toDecimal(payload.overrideAmount),
  startMonth: payload.startMonth || currentMonthValue(),
  endMonth: nullableText(payload.endMonth),
  status: payload.status ?? 'ACTIVE',
  autoAssigned: payload.autoAssigned ?? targetType !== 'STUDENT',
  notes: nullableText(payload.notes),
  createdById: userId,
});

const assignmentScalarUpdateData = (
  payload: z.infer<typeof assignmentSchema>,
  targetType: FeeAssignmentTarget,
  studentId: string | null,
  userId: string,
): Prisma.StudentFeeAssignmentUncheckedUpdateInput => ({
  feeStructureId: payload.feeStructureId,
  targetType,
  classId: targetType === 'CLASS' || targetType === 'SECTION' ? payload.classId ?? null : null,
  sectionId: targetType === 'SECTION' ? payload.sectionId ?? null : null,
  studentId: targetType === 'STUDENT' ? studentId : null,
  groupId: targetType === 'GROUP' ? payload.groupId ?? null : null,
  categoryId: targetType === 'CATEGORY' ? payload.categoryId ?? null : null,
  transportRouteId: targetType === 'TRANSPORT_ROUTE' ? payload.transportRouteId ?? null : null,
  overrideAmount: payload.overrideAmount === undefined || payload.overrideAmount === null ? null : toDecimal(payload.overrideAmount),
  startMonth: payload.startMonth || currentMonthValue(),
  endMonth: nullableText(payload.endMonth),
  status: payload.status ?? 'ACTIVE',
  autoAssigned: payload.autoAssigned ?? targetType !== 'STUDENT',
  notes: nullableText(payload.notes),
  updatedById: userId,
});

const assertAssignmentReferences = async (scope: FeeTenantScope, payload: z.infer<typeof assignmentSchema>, targetType: FeeAssignmentTarget) => {
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId) await assertSection(scope.schoolId, payload.sectionId);
  if (payload.groupId) await assertStudentGroup(scope.schoolId, payload.groupId);
  if (payload.categoryId) await assertStudentCategory(scope.schoolId, payload.categoryId);
  if (payload.transportRouteId) await assertTransportRoute(scope.schoolId, payload.transportRouteId);
  if (targetType === 'STUDENT') {
    const ids = Array.from(new Set(payload.studentIds?.length ? payload.studentIds : [payload.studentId].filter(Boolean) as string[]));
    const found = await prisma.student.findMany({ where: activeStudentWhere(scope, { id: { in: ids } }), select: { id: true } });
    if (found.length !== ids.length) throw new HttpError(400, 'One or more selected students are inactive, transferred, disabled, or not found');
  }
};

const resolveAssignmentStudents = async (
  scope: FeeTenantScope,
  payload: z.infer<typeof assignmentSchema>,
  targetType: FeeAssignmentTarget,
  studentIds: string[] = [],
) => {
  const include = { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true, classId: true } } };
  if (targetType === 'STUDENT') {
    return prisma.student.findMany({ where: activeStudentWhere(scope, { id: { in: studentIds } }), include, orderBy: { fullName: 'asc' } });
  }
  if (targetType === 'TRANSPORT_ROUTE') {
    const rows = await prisma.studentTransportAssignment.findMany({
      where: { schoolId: scope.schoolId, routeId: payload.transportRouteId ?? '', active: true },
      select: { studentId: true },
    });
    return prisma.student.findMany({ where: activeStudentWhere(scope, { id: { in: rows.map((row) => row.studentId) } }), include, orderBy: { fullName: 'asc' } });
  }
  return prisma.student.findMany({
    where: activeStudentWhere(scope, {
      ...(targetType === 'CLASS' && payload.classId ? { classId: payload.classId } : {}),
      ...(targetType === 'SECTION' && payload.sectionId ? { sectionId: payload.sectionId } : {}),
      ...(targetType === 'GROUP' && payload.groupId ? { studentGroupId: payload.groupId } : {}),
      ...(targetType === 'CATEGORY' && payload.categoryId ? { studentCategoryId: payload.categoryId } : {}),
    }),
    include,
    orderBy: { fullName: 'asc' },
  });
};

const assignmentMatchesStudent = (
  assignment: Pick<StudentFeeAssignment, 'targetType' | 'studentId' | 'classId' | 'sectionId' | 'groupId' | 'categoryId' | 'transportRouteId' | 'status' | 'deletedAt'>,
  student: Pick<Student, 'id' | 'classId' | 'sectionId' | 'studentGroupId' | 'studentCategoryId'>,
  routeIds?: Set<string>,
) => {
  if ((assignment.status ?? 'ACTIVE') !== 'ACTIVE' || assignment.deletedAt) return false;
  if (assignment.targetType === 'STUDENT') return assignment.studentId === student.id;
  if (assignment.targetType === 'CLASS') return assignment.classId === student.classId;
  if (assignment.targetType === 'SECTION') return assignment.sectionId === student.sectionId;
  if (assignment.targetType === 'GROUP') return assignment.groupId === student.studentGroupId;
  if (assignment.targetType === 'CATEGORY') return assignment.categoryId === student.studentCategoryId;
  if (assignment.targetType === 'TRANSPORT_ROUTE') return Boolean(assignment.transportRouteId && routeIds?.has(assignment.transportRouteId));
  return false;
};

const includeInvoice = {
  student: { select: { id: true, admissionNo: true, fullName: true, phone: true, parentEmail: true, parentPhone: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  feeType: { select: { id: true, name: true, schedule: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { orderBy: { paidAt: 'desc' } },
  receipts: { orderBy: { receiptDate: 'desc' } },
} satisfies Prisma.FeeInvoiceInclude;

const includePaymentResult = {
  receipt: true,
  invoice: { include: includeInvoice },
  allocations: {
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          feeMonth: true,
          dueDate: true,
          totalAmount: true,
          discountAmount: true,
          fineAmount: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          feeType: { select: { id: true, name: true, schedule: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.FeePaymentInclude;

type PaymentResultRecord = Prisma.FeePaymentGetPayload<{ include: typeof includePaymentResult }>;
type PaymentScope = { schoolId: string; academicSessionId: string; userId: string };
type PaymentAllocationRequest = { invoiceId: string; amount: Prisma.Decimal };
type InvoiceAmountSnapshot = {
  totalAmount: Prisma.Decimal | number | string;
  fineAmount: Prisma.Decimal | number | string;
  discountAmount: Prisma.Decimal | number | string;
  paidAmount: Prisma.Decimal | number | string;
  dueAmount?: Prisma.Decimal | number | string | null;
};

const calculateInvoiceDueAmount = (invoice: InvoiceAmountSnapshot) =>
  Prisma.Decimal.max(
    invoice.dueAmount !== undefined && invoice.dueAmount !== null
      ? toDecimal(invoice.dueAmount)
      : toDecimal(invoice.totalAmount).plus(invoice.fineAmount).minus(invoice.discountAmount).minus(invoice.paidAmount),
    0,
  );

const calculateInvoiceDueFromParts = ({
  totalAmount,
  discountAmount,
  fineAmount,
  paidAmount,
}: InvoiceAmountSnapshot) =>
  Prisma.Decimal.max(toDecimal(totalAmount).minus(discountAmount).plus(fineAmount).minus(paidAmount), 0);

const lockFeeInvoicesForPayment = async (tx: Prisma.TransactionClient, scope: PaymentScope, invoiceIds: string[]) => {
  if (!invoiceIds.length) return;
  const query = Prisma.sql`
    SELECT id
    FROM fee_invoices
    WHERE id = ANY(ARRAY[${Prisma.join(invoiceIds)}]::uuid[])
      AND school_id = ${scope.schoolId}::uuid
      AND academic_session_id = ${scope.academicSessionId}::uuid
      AND deleted_at IS NULL
    FOR UPDATE
  `;
  const rawClient = tx as Prisma.TransactionClient & {
    $queryRaw?: <T = unknown>(query: Prisma.Sql) => Promise<T>;
    $queryRawUnsafe?: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  };
  if (typeof rawClient.$queryRaw === 'function') {
    await rawClient.$queryRaw<{ id: string }[]>(query);
    return;
  }
  if (typeof rawClient.$queryRawUnsafe === 'function') {
    await rawClient.$queryRawUnsafe<{ id: string }[]>(
      'SELECT id FROM fee_invoices WHERE id = ANY($1::uuid[]) AND school_id = $2::uuid AND academic_session_id = $3::uuid AND deleted_at IS NULL FOR UPDATE',
      invoiceIds,
      scope.schoolId,
      scope.academicSessionId,
    );
  }
};

const findIdempotentPayment = async (
  client: Pick<Prisma.TransactionClient, 'feePayment'>,
  schoolId: string,
  idempotencyKey: string,
) =>
  client.feePayment.findFirst({
    where: { schoolId, idempotencyKey },
    include: includePaymentResult,
  });

const assertIdempotentPaymentMatches = (
  existing: PaymentResultRecord,
  scope: PaymentScope,
  payload: { studentId: string; paymentMode: string; allocations: PaymentAllocationRequest[] },
  amount: Prisma.Decimal,
  transactionReference: string | null,
) => {
  const existingAllocations = existing.allocations.length
    ? existing.allocations.map((item) => ({ invoiceId: item.invoiceId, amount: toDecimal(item.allocatedAmount) }))
    : [{ invoiceId: existing.invoiceId, amount: toDecimal(existing.amount) }];
  const normalize = (items: PaymentAllocationRequest[]) =>
    items
      .map((item) => `${item.invoiceId}:${item.amount.toFixed(2)}`)
      .sort()
      .join('|');
  const sameRequest =
    existing.academicSessionId === scope.academicSessionId &&
    existing.studentId === payload.studentId &&
    existing.paymentMode === payload.paymentMode &&
    toDecimal(existing.amount).eq(amount) &&
    nullableText(existing.transactionReference) === transactionReference &&
    normalize(existingAllocations) === normalize(payload.allocations);

  if (!sameRequest) throw new HttpError(409, 'Idempotency key was already used for a different payment request');
};

const paymentResponse = (record: PaymentResultRecord, idempotent: boolean) => {
  const { receipt, invoice, allocations, ...payment } = record;
  return {
    payment,
    receipt,
    invoice,
    invoices: allocations.length ? allocations.map((allocation) => allocation.invoice) : [invoice],
    allocations,
    idempotent,
  };
};

export const getFeeMetadata = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);

  const [academicSessions, classes, sections, students, studentGroups, studentCategories, particulars, feeTypes, structures, transportRoutes] = await Promise.all([
    prisma.academicYear.findMany({ where: { schoolId: scope.schoolId }, orderBy: { startDate: 'desc' }, select: { id: true, name: true, isActive: true } }),
    prisma.class.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.section.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true, classId: true } }),
    prisma.student.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId, status: assignableStudentStatus },
      orderBy: { fullName: 'asc' },
      take: 300,
      select: { id: true, admissionNo: true, fullName: true, classId: true, sectionId: true },
    }),
    prisma.studentGroup.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.studentCategory.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.feeParticular.findMany({ where: { ...tenantScopeOnly(scope), deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.feeType.findMany({ where: { ...tenantScopeOnly(scope), deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.feeStructure.findMany({ where: { ...tenantScopeOnly(scope), deletedAt: null }, include: includeStructure, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.transportRoute.findMany({ where: { schoolId: scope.schoolId }, orderBy: { title: 'asc' }, select: { id: true, title: true, fare: true } }),
  ]);

  res.status(200).json({ ...tenantScopeOnly(scope), academicSessions, classes, sections, students, studentGroups, studentCategories, particulars, feeTypes, structures, transportRoutes });
};

const particularSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(160),
  code: z.string().max(80).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(['CHARGE', 'DISCOUNT', 'FINE', 'PREVIOUS_BALANCE', 'TRANSPORT', 'HOSTEL']).default('CHARGE'),
  isMandatory: z.boolean().optional(),
  isSystemGenerated: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const assertUniqueFeeParticularName = async (scope: FeeTenantScope, normalizedName: string, excludeId?: string) => {
  const duplicate = await prisma.feeParticular.findFirst({
    where: {
      ...tenantScopeOnly(scope),
      normalizedName,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Fee particular name already exists for this session');
};

export const listFeeParticulars = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where: Prisma.FeeParticularWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(status === 'ACTIVE' || status === 'INACTIVE' ? { status } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.feeParticular.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], skip, take: limit }),
    prisma.feeParticular.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

export const createFeeParticular = async (req: Request, res: Response) => {
  const payload = particularSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const name = normalizeText(payload.name);
  const normalizedName = normalizeName(payload.name);
  await assertUniqueFeeParticularName(scope, normalizedName);
  try {
    const item = await prisma.feeParticular.create({
      data: {
        ...tenantScopeOnly(scope),
        name,
        normalizedName,
        code: slugCode(payload.code || payload.name),
        description: nullableText(payload.description),
        type: payload.type,
        isMandatory: payload.isMandatory ?? false,
        isSystemGenerated: payload.isSystemGenerated ?? false,
        status: payload.status ?? 'ACTIVE',
        sortOrder: payload.sortOrder ?? 0,
      },
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PARTICULAR', entityId: item.id, action: 'CREATE', afterState: item });
    res.status(201).json(item);
  } catch (err) {
    if (uniqueTargetIncludes(err, 'normalized_name')) throw new HttpError(409, 'Fee particular name already exists for this session');
    handleUniqueError(err, 'Fee particular code already exists for this session');
  }
};

export const updateFeeParticular = async (req: Request, res: Response) => {
  const payload = particularSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeParticular.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee particular not found');
  const normalizedName = payload.name === undefined ? undefined : normalizeName(payload.name);
  if (normalizedName) await assertUniqueFeeParticularName(scope, normalizedName, existing.id);
  try {
    const item = await prisma.feeParticular.update({
      where: { id: existing.id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        normalizedName,
        code: payload.code === undefined ? undefined : slugCode(payload.code || payload.name || existing.name),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
        type: payload.type,
        isMandatory: payload.isMandatory,
        isSystemGenerated: payload.isSystemGenerated,
        status: payload.status,
        sortOrder: payload.sortOrder,
      },
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PARTICULAR', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
    res.status(200).json(item);
  } catch (err) {
    if (uniqueTargetIncludes(err, 'normalized_name')) throw new HttpError(409, 'Fee particular name already exists for this session');
    handleUniqueError(err, 'Fee particular code already exists for this session');
  }
};

export const deleteFeeParticular = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeParticular.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee particular not found');
  const usage = await prisma.feeStructureItem.count({
    where: {
      particularId: existing.id,
      structure: { ...tenantScopeOnly(scope), deletedAt: null },
    },
  });
  if (usage) throw new HttpError(409, 'Cannot delete fee particular while fee structures use it');
  const item = await prisma.feeParticular.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PARTICULAR', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

const feeTypeSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(120),
  code: z.string().max(80).optional().nullable(),
  schedule: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME']),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const assertUniqueFeeTypeName = async (scope: FeeTenantScope, normalizedName: string, excludeId?: string) => {
  const duplicate = await prisma.feeType.findFirst({
    where: {
      ...tenantScopeOnly(scope),
      normalizedName,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Fee type name already exists for this session');
};

export const listFeeTypes = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);
  const items = await prisma.feeType.findMany({ where: { ...tenantScopeOnly(scope), deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  res.status(200).json(items);
};

export const createFeeType = async (req: Request, res: Response) => {
  const payload = feeTypeSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const name = normalizeText(payload.name);
  const normalizedName = normalizeName(payload.name);
  await assertUniqueFeeTypeName(scope, normalizedName);
  try {
    const item = await prisma.feeType.create({
      data: {
        ...tenantScopeOnly(scope),
        name,
        normalizedName,
        code: slugCode(payload.code || payload.name),
        schedule: payload.schedule,
        description: nullableText(payload.description),
        status: payload.status ?? 'ACTIVE',
        sortOrder: payload.sortOrder ?? 0,
      },
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_TYPE', entityId: item.id, action: 'CREATE', afterState: item });
    res.status(201).json(item);
  } catch (err) {
    if (uniqueTargetIncludes(err, 'normalized_name')) throw new HttpError(409, 'Fee type name already exists for this session');
    handleUniqueError(err, 'Fee type code already exists for this session');
  }
};

export const updateFeeType = async (req: Request, res: Response) => {
  const payload = feeTypeSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeType.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee type not found');
  const normalizedName = payload.name === undefined ? undefined : normalizeName(payload.name);
  if (normalizedName) await assertUniqueFeeTypeName(scope, normalizedName, existing.id);
  try {
    const item = await prisma.feeType.update({
      where: { id: existing.id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        normalizedName,
        code: payload.code === undefined ? undefined : slugCode(payload.code || payload.name || existing.name),
        schedule: payload.schedule,
        description: payload.description === undefined ? undefined : nullableText(payload.description),
        status: payload.status,
        sortOrder: payload.sortOrder,
      },
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_TYPE', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
    res.status(200).json(item);
  } catch (err) {
    if (uniqueTargetIncludes(err, 'normalized_name')) throw new HttpError(409, 'Fee type name already exists for this session');
    handleUniqueError(err, 'Fee type code already exists for this session');
  }
};

export const deleteFeeType = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeType.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee type not found');
  const usage = await prisma.feeStructure.count({ where: { feeTypeId: existing.id, deletedAt: null } });
  if (usage) throw new HttpError(409, 'Cannot delete fee type while structures use it');
  const item = await prisma.feeType.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_TYPE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

const structureItemSchema = z.object({
  particularId: uuidSchema,
  amount: positiveDecimalInput,
  isOptional: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const structureSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  classId: uuidSchema,
  sectionId: uuidSchema.optional().nullable(),
  feeTypeId: uuidSchema,
  name: z.string().max(180).optional().nullable(),
  effectiveFrom: dateInput,
  effectiveTo: dateInput,
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  items: z.array(structureItemSchema).min(1),
});

export const listFeeStructures = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const where: Prisma.FeeStructureWhereInput = { ...tenantScopeOnly(scope), deletedAt: null, ...(classId ? { classId } : {}) };
  const [items, total] = await Promise.all([
    prisma.feeStructure.findMany({ where, include: includeStructure, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.feeStructure.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

export const createFeeStructure = async (req: Request, res: Response) => {
  const payload = structureSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  await Promise.all([
    assertClass(scope.schoolId, payload.classId),
    assertSection(scope.schoolId, payload.sectionId),
    assertFeeType(scope.schoolId, scope.academicSessionId, payload.feeTypeId),
    assertParticulars(scope.schoolId, scope.academicSessionId, payload.items.map((item) => item.particularId)),
  ]);
  try {
    const item = await prisma.feeStructure.create({
      data: {
        ...tenantScopeOnly(scope),
        classId: payload.classId,
        sectionId: payload.sectionId ?? null,
        feeTypeId: payload.feeTypeId,
        name: normalizeText(payload.name || 'Class Fee Structure'),
        effectiveFrom: payload.effectiveFrom ?? null,
        effectiveTo: payload.effectiveTo ?? null,
        status: payload.status ?? 'ACTIVE',
        items: {
          create: payload.items.map((row, index) => ({
            particularId: row.particularId,
            amount: toDecimal(row.amount),
            isOptional: row.isOptional ?? false,
            sortOrder: row.sortOrder ?? index + 1,
          })),
        },
      },
      include: includeStructure,
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_STRUCTURE', entityId: item.id, action: 'CREATE', afterState: item });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'A fee structure already exists for this class, section, session, and fee type');
  }
};

export const updateFeeStructure = async (req: Request, res: Response) => {
  const payload = structureSchema.partial({ items: true }).parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeStructure.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null }, include: includeStructure });
  if (!existing) throw new HttpError(404, 'Fee structure not found');
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId !== undefined) await assertSection(scope.schoolId, payload.sectionId);
  if (payload.feeTypeId) await assertFeeType(scope.schoolId, scope.academicSessionId, payload.feeTypeId);
  if (payload.items) await assertParticulars(scope.schoolId, scope.academicSessionId, payload.items.map((item) => item.particularId));

  try {
    const item = await prisma.$transaction(async (tx) => {
      if (payload.items) {
        await tx.feeStructureItem.deleteMany({ where: { structureId: existing.id } });
      }
      return tx.feeStructure.update({
        where: { id: existing.id },
        data: {
          classId: payload.classId,
          sectionId: payload.sectionId,
          feeTypeId: payload.feeTypeId,
          name: payload.name === undefined ? undefined : normalizeText(payload.name || existing.name),
          effectiveFrom: payload.effectiveFrom,
          effectiveTo: payload.effectiveTo,
          status: payload.status,
          items: payload.items
            ? {
                create: payload.items.map((row, index) => ({
                  particularId: row.particularId,
                  amount: toDecimal(row.amount),
                  isOptional: row.isOptional ?? false,
                  sortOrder: row.sortOrder ?? index + 1,
                })),
              }
            : undefined,
        },
        include: includeStructure,
      });
    });
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_STRUCTURE', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'A fee structure already exists for this class, section, session, and fee type');
  }
};

export const deleteFeeStructure = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeStructure.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null }, include: { _count: { select: { assignments: true, invoices: true } } } });
  if (!existing) throw new HttpError(404, 'Fee structure not found');
  if (existing._count.assignments + existing._count.invoices > 0) throw new HttpError(409, 'Cannot delete fee structure while students or invoices use it');
  const item = await prisma.feeStructure.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_STRUCTURE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

export const duplicateFeeStructure = async (req: Request, res: Response) => {
  const payload = z.object({ schoolId: uuidSchema.optional(), academicSessionId: uuidSchema.optional(), classId: uuidSchema, sectionId: uuidSchema.optional().nullable(), feeTypeId: uuidSchema.optional() }).parse(req.body);
  const scope = await resolveScope(req, payload);
  const source = await prisma.feeStructure.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null }, include: includeStructure });
  if (!source) throw new HttpError(404, 'Fee structure not found');
  const created = await createFeeStructure(
    {
      ...req,
      body: {
        ...tenantScopeOnly(scope),
        classId: payload.classId,
        sectionId: payload.sectionId ?? null,
        feeTypeId: payload.feeTypeId ?? source.feeTypeId,
        name: `${source.name} Copy`,
        effectiveFrom: source.effectiveFrom,
        effectiveTo: source.effectiveTo,
        status: source.status,
        items: source.items.map((item) => ({ particularId: item.particularId, amount: decimalNumber(item.amount), isOptional: item.isOptional, sortOrder: item.sortOrder })),
      },
    } as Request,
    res,
  );
  return created;
};

export const listFeeAssignments = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const feeStructureId = typeof req.query.feeStructureId === 'string' ? req.query.feeStructureId : undefined;
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined;
  const sortBy = req.query.sortBy === 'createdAt' ? 'createdAt' : 'assignedAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const filterClauses: Prisma.StudentFeeAssignmentWhereInput[] = [
    ...(classId ? [{ OR: [{ classId }, { student: { is: { classId } } }] }] : []),
    ...(sectionId ? [{ OR: [{ sectionId }, { student: { is: { sectionId } } }] }] : []),
    ...(search
      ? [{
          OR: [
            { notes: { contains: search, mode: 'insensitive' as const } },
            { feeStructure: { name: { contains: search, mode: 'insensitive' as const } } },
            { student: { is: { fullName: { contains: search, mode: 'insensitive' as const } } } },
            { student: { is: { admissionNo: { contains: search, mode: 'insensitive' as const } } } },
            { class: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            { section: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            { group: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            { category: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            { transportRoute: { is: { title: { contains: search, mode: 'insensitive' as const } } } },
          ],
        }]
      : []),
  ];
  const where: Prisma.StudentFeeAssignmentWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(feeStructureId ? { feeStructureId } : {}),
    ...(status ? { status } : {}),
    ...(filterClauses.length ? { AND: filterClauses } : {}),
  };
  const [items, total, activeAssignments] = await Promise.all([
    prisma.studentFeeAssignment.findMany({
      where,
      include: includeAssignment,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.studentFeeAssignment.count({ where }),
    prisma.studentFeeAssignment.findMany({
      where: { ...where, status: 'ACTIVE' },
      include: includeAssignment,
      orderBy: { assignedAt: 'desc' },
      take: 2000,
    }),
  ]);
  const students = await prisma.student.findMany({
    where: activeStudentWhere(scope, { ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) }),
    include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true, classId: true } } },
    orderBy: { fullName: 'asc' },
    take: 1000,
  });
  const routeRows = await prisma.studentTransportAssignment.findMany({
    where: { schoolId: scope.schoolId, active: true, studentId: { in: students.map((student) => student.id) } },
    select: { studentId: true, routeId: true },
  });
  const routesByStudent = new Map<string, Set<string>>();
  for (const row of routeRows) {
    if (!routesByStudent.has(row.studentId)) routesByStudent.set(row.studentId, new Set());
    routesByStudent.get(row.studentId)?.add(row.routeId);
  }
  const assignedStudents = students.filter((student) =>
    activeAssignments.some((assignment) => assignmentMatchesStudent(assignment, student, routesByStudent.get(student.id))),
  );
  const assignedIds = new Set(assignedStudents.map((student) => student.id));
  const unassignedStudents = students.filter((student) => !assignedIds.has(student.id));
  res.status(200).json({
    items,
    assignedStudents,
    unassignedStudents,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

export const assignStudentFees = async (req: Request, res: Response) => {
  const payload = assignmentSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const targetType = assignmentTargetFromPayload(payload);
  assertAssignmentTargetFields(targetType, payload);
  assertMonthRange(payload.startMonth ?? currentMonthValue(), payload.endMonth);
  if (payload.overrideAmount !== undefined && payload.overrideAmount !== null && toDecimal(payload.overrideAmount).lte(0)) throw new HttpError(400, 'overrideAmount must be greater than 0');
  const structure = await prisma.feeStructure.findFirst({ where: { id: payload.feeStructureId, ...tenantScopeOnly(scope), deletedAt: null, status: 'ACTIVE' } });
  if (!structure) throw new HttpError(404, 'Active fee structure not found');
  await assertAssignmentReferences(scope, payload, targetType);
  const studentIds = targetType === 'STUDENT' ? Array.from(new Set(payload.studentIds?.length ? payload.studentIds : [payload.studentId].filter(Boolean) as string[])) : [null];
  const students = await resolveAssignmentStudents(scope, payload, targetType, studentIds.filter(Boolean) as string[]);
  if (!students.length) throw new HttpError(404, 'No matching active students found');
  for (const studentId of studentIds) {
    const duplicate = await prisma.studentFeeAssignment.findFirst({
      where: assignmentDuplicateWhere(scope, payload, targetType, studentId),
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, 'Duplicate active assignment exists for the same target, structure, and academic session');
  }
  const created = await prisma.$transaction(async (tx) =>
    Promise.all(
      studentIds.map((studentId) =>
        tx.studentFeeAssignment.create({
          data: assignmentData(scope, payload, targetType, studentId, req.auth?.userId ?? scope.userId),
          include: includeAssignment,
        }),
      ),
    ),
  );
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: payload.feeStructureId, action: 'CREATE', afterState: { assignmentIds: created.map((item) => item.id), assignedStudentIds: students.map((student) => student.id), targetType } });
  res.status(201).json({ assigned: students.length, requested: students.length, assignments: created, assignedStudents: students });
};

export const updateFeeAssignment = async (req: Request, res: Response) => {
  const payload = assignmentSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.studentFeeAssignment.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee assignment not found');
  const targetType = assignmentTargetFromPayload(payload);
  assertAssignmentTargetFields(targetType, payload);
  assertMonthRange(payload.startMonth ?? currentMonthValue(), payload.endMonth);
  if (payload.overrideAmount !== undefined && payload.overrideAmount !== null && toDecimal(payload.overrideAmount).lte(0)) throw new HttpError(400, 'overrideAmount must be greater than 0');
  const structure = await prisma.feeStructure.findFirst({ where: { id: payload.feeStructureId, ...tenantScopeOnly(scope), deletedAt: null, status: 'ACTIVE' } });
  if (!structure) throw new HttpError(404, 'Active fee structure not found');
  await assertAssignmentReferences(scope, payload, targetType);
  const studentId = targetType === 'STUDENT' ? payload.studentId ?? payload.studentIds?.[0] ?? null : null;
  const duplicate = await prisma.studentFeeAssignment.findFirst({
    where: assignmentDuplicateWhere(scope, payload, targetType, studentId, existing.id),
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Duplicate active assignment exists for the same target, structure, and academic session');
  const item = await prisma.studentFeeAssignment.update({
    where: { id: existing.id },
    data: assignmentScalarUpdateData(payload, targetType, studentId, scope.userId),
    include: includeAssignment,
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const deleteFeeAssignment = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.studentFeeAssignment.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee assignment not found');
  const item = await prisma.studentFeeAssignment.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: 'INACTIVE', updatedById: scope.userId },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const activateFeeAssignment = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.studentFeeAssignment.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee assignment not found');
  const payload = assignmentSchema.parse({
    academicSessionId: scope.academicSessionId,
    feeStructureId: existing.feeStructureId,
    targetType: existing.targetType,
    classId: existing.classId,
    sectionId: existing.sectionId,
    studentId: existing.studentId,
    groupId: existing.groupId,
    categoryId: existing.categoryId,
    transportRouteId: existing.transportRouteId,
    overrideAmount: existing.overrideAmount === null ? null : decimalNumber(existing.overrideAmount),
    startMonth: existing.startMonth,
    endMonth: existing.endMonth,
    status: 'ACTIVE',
  });
  const duplicate = await prisma.studentFeeAssignment.findFirst({
    where: assignmentDuplicateWhere(scope, payload, existing.targetType, existing.studentId, existing.id),
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Duplicate active assignment exists for the same target, structure, and academic session');
  const item = await prisma.studentFeeAssignment.update({ where: { id: existing.id }, data: { status: 'ACTIVE', updatedById: scope.userId }, include: includeAssignment });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: item.id, action: 'ACTIVE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const deactivateFeeAssignment = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.studentFeeAssignment.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee assignment not found');
  const item = await prisma.studentFeeAssignment.update({ where: { id: existing.id }, data: { status: 'INACTIVE', updatedById: scope.userId }, include: includeAssignment });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: item.id, action: 'INACTIVE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

const invoiceGenerationSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  target: z.enum(['STUDENT', 'CLASS', 'SECTION', 'SCHOOL']).default('STUDENT'),
  studentId: uuidSchema.optional(),
  studentIds: z.array(uuidSchema).optional().nullable(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  feeStructureId: uuidSchema.optional(),
  feeTypeId: uuidSchema.optional(),
  feeMonth: z.string().trim().min(1, 'feeMonth is required').max(30),
  dueDate: z.coerce.date(),
  emailInvoice: z.boolean().optional(),
});

const requestedInvoiceStudentIds = (payload: z.infer<typeof invoiceGenerationSchema>) =>
  Array.from(new Set([...(payload.studentIds ?? []), ...(payload.studentId ? [payload.studentId] : [])]));

const invoiceMonthStart = (feeMonth: string) => {
  const trimmed = normalizeText(feeMonth);
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(trimmed);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, 1));
  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (named) {
    const month = monthNames.get(named[1].toLowerCase());
    if (month) return new Date(Date.UTC(Number(named[2]), month - 1, 1));
  }
  throw new HttpError(400, 'Month must be in YYYY-MM or Month YYYY format');
};

const dateOnlyUtc = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

const normalizeInvoiceFeeMonth = (feeMonth: string) => {
  const normalized = normalizeText(feeMonth);
  monthIndex(normalized);
  return normalized;
};

const assertDueDateForFeeMonth = (feeMonth: string, dueDate: Date) => {
  const monthStart = invoiceMonthStart(feeMonth);
  if (dateOnlyUtc(dueDate).getTime() < monthStart.getTime()) {
    throw new HttpError(400, 'dueDate cannot be before invoice month start');
  }
};

const assertFeeStructureActive = async (scope: FeeTenantScope, feeStructureId?: string) => {
  if (!feeStructureId) return;
  const found = await prisma.feeStructure.findFirst({
    where: { id: feeStructureId, ...tenantScopeOnly(scope), deletedAt: null },
    select: { id: true, status: true, feeType: { select: { status: true, deletedAt: true } } },
  });
  if (!found) throw new HttpError(404, 'Fee structure not found');
  if (found.status !== 'ACTIVE' || found.feeType.deletedAt || found.feeType.status !== 'ACTIVE') {
    throw new HttpError(400, 'Inactive fee structure cannot be used');
  }
};

const validateInvoiceGenerationPayload = async (scope: FeeTenantScope, payload: z.infer<typeof invoiceGenerationSchema>) => {
  const feeMonth = normalizeInvoiceFeeMonth(payload.feeMonth);
  assertDueDateForFeeMonth(feeMonth, payload.dueDate);
  if (payload.feeTypeId) await assertFeeType(scope.schoolId, scope.academicSessionId, payload.feeTypeId);
  await assertFeeStructureActive(scope, payload.feeStructureId);
  return feeMonth;
};

const findInvoiceStudents = async (scope: { schoolId: string; academicSessionId: string }, payload: z.infer<typeof invoiceGenerationSchema>) => {
  const studentIds = requestedInvoiceStudentIds(payload);
  if (payload.target === 'STUDENT' || studentIds.length) {
    if (!studentIds.length) throw new HttpError(400, 'studentId or studentIds is required');
    return prisma.student.findMany({ where: activeStudentWhere(scope, { id: { in: studentIds } }), include: includeInvoiceStudent });
  }
  return prisma.student.findMany({
    where: activeStudentWhere(scope, {
      ...(payload.target === 'CLASS' && payload.classId ? { classId: payload.classId } : {}),
      ...(payload.target === 'SECTION' && payload.sectionId ? { sectionId: payload.sectionId } : {}),
    }),
    include: includeInvoiceStudent,
  });
};

const resolveInvoiceAssignment = async (
  scope: FeeTenantScope,
  payload: z.infer<typeof invoiceGenerationSchema>,
  student: Student,
  feeMonth: string,
) => {
  const routeRows = await prisma.studentTransportAssignment.findMany({
    where: { schoolId: scope.schoolId, studentId: student.id, active: true },
    select: { routeId: true },
  });
  const routeIds = routeRows.map((row) => row.routeId);
  const targets: Prisma.StudentFeeAssignmentWhereInput[] = [
    { targetType: 'STUDENT', studentId: student.id },
  ];
  if (student.studentGroupId) targets.push({ targetType: 'GROUP', groupId: student.studentGroupId });
  if (student.studentCategoryId) targets.push({ targetType: 'CATEGORY', categoryId: student.studentCategoryId });
  if (routeIds.length) targets.push({ targetType: 'TRANSPORT_ROUTE', transportRouteId: { in: routeIds } });
  if (student.sectionId) targets.push({ targetType: 'SECTION', sectionId: student.sectionId });
  if (student.classId) targets.push({ targetType: 'CLASS', classId: student.classId });

  const candidates = await prisma.studentFeeAssignment.findMany({
    where: {
      ...tenantScopeOnly(scope),
      status: 'ACTIVE',
      deletedAt: null,
      OR: targets,
      feeStructure: {
        deletedAt: null,
        status: 'ACTIVE',
        feeType: { deletedAt: null, status: 'ACTIVE' },
        ...(payload.feeStructureId ? { id: payload.feeStructureId } : {}),
        ...(payload.feeTypeId ? { feeTypeId: payload.feeTypeId } : {}),
      },
    },
    include: { feeStructure: { include: includeStructure } },
    orderBy: { assignedAt: 'desc' },
  });
  return candidates
    .filter((assignment) => isAssignmentActiveForMonth(assignment, feeMonth))
    .sort((a, b) => assignmentPriority[a.targetType] - assignmentPriority[b.targetType] || b.assignedAt.getTime() - a.assignedAt.getTime())[0] ?? null;
};

type InvoiceStructure = Prisma.FeeStructureGetPayload<{ include: typeof includeStructure }>;
type InvoiceAssignment = Prisma.StudentFeeAssignmentGetPayload<{ include: { feeStructure: { include: typeof includeStructure } } }>;
type InvoiceCandidate = {
  student: InvoiceStudent;
  assignment: InvoiceAssignment | null;
  structure: InvoiceStructure | null;
  duplicate: { id: string; invoiceNumber: string } | null;
  calculation: FeeInvoiceCalculation | null;
  warnings: string[];
};

const invoicePeriodKey = (studentId: string, feeStructureId?: string | null, feeTypeId?: string | null, feeMonth?: string | null) =>
  `${studentId}:${feeStructureId ?? ''}:${feeTypeId ?? ''}:${feeMonth ?? ''}`;

const uniqueStrings = (values: Array<string | null | undefined>) => Array.from(new Set(values.filter(Boolean) as string[]));
function tenantScope(scope: FeeTenantScope) {
  return {
    schoolId: scope.schoolId,
    academicSessionId: scope.academicSessionId,
  };
}
const tenantScopeOnly = tenantScope;

const resolveInvoiceAssignmentsForStudents = async (
  scope: FeeTenantScope,
  payload: z.infer<typeof invoiceGenerationSchema>,
  students: InvoiceStudent[],
  feeMonth: string,
) => {
  const studentIds = students.map((student) => student.id);
  const routeRows = studentIds.length
    ? await prisma.studentTransportAssignment.findMany({
        where: { schoolId: scope.schoolId, studentId: { in: studentIds }, active: true },
        select: { studentId: true, routeId: true },
      })
    : [];
  const routeIdsByStudentId = new Map<string, Set<string>>();
  for (const row of routeRows) {
    if (!routeIdsByStudentId.has(row.studentId)) routeIdsByStudentId.set(row.studentId, new Set());
    routeIdsByStudentId.get(row.studentId)?.add(row.routeId);
  }

  const routeIds = uniqueStrings(routeRows.map((row) => row.routeId));
  const assignmentTargets: Prisma.StudentFeeAssignmentWhereInput[] = [
    ...(studentIds.length ? [{ targetType: 'STUDENT' as const, studentId: { in: studentIds } }] : []),
    ...uniqueStrings(students.map((student) => student.studentGroupId)).map((groupId) => ({ targetType: 'GROUP' as const, groupId })),
    ...uniqueStrings(students.map((student) => student.studentCategoryId)).map((categoryId) => ({ targetType: 'CATEGORY' as const, categoryId })),
    ...(routeIds.length ? [{ targetType: 'TRANSPORT_ROUTE' as const, transportRouteId: { in: routeIds } }] : []),
    ...uniqueStrings(students.map((student) => student.sectionId)).map((sectionId) => ({ targetType: 'SECTION' as const, sectionId })),
    ...uniqueStrings(students.map((student) => student.classId)).map((classId) => ({ targetType: 'CLASS' as const, classId })),
  ];

  const assignments = assignmentTargets.length
    ? await prisma.studentFeeAssignment.findMany({
        where: {
          ...tenantScopeOnly(scope),
          status: 'ACTIVE',
          deletedAt: null,
          OR: assignmentTargets,
          feeStructure: {
            deletedAt: null,
            status: 'ACTIVE',
            feeType: { deletedAt: null, status: 'ACTIVE' },
            ...(payload.feeStructureId ? { id: payload.feeStructureId } : {}),
            ...(payload.feeTypeId ? { feeTypeId: payload.feeTypeId } : {}),
          },
        },
        include: { feeStructure: { include: includeStructure } },
        orderBy: { assignedAt: 'desc' },
      })
    : [];

  const assignmentByStudentId = new Map<string, InvoiceAssignment>();
  for (const student of students) {
    const routeIdsForStudent = routeIdsByStudentId.get(student.id);
    const assignment = assignments
      .filter((item) => isAssignmentActiveForMonth(item, feeMonth) && assignmentMatchesStudent(item, student, routeIdsForStudent))
      .sort((a, b) => assignmentPriority[a.targetType] - assignmentPriority[b.targetType] || b.assignedAt.getTime() - a.assignedAt.getTime())[0];
    if (assignment) assignmentByStudentId.set(student.id, assignment);
  }
  return assignmentByStudentId;
};

const loadDirectInvoiceStructure = async (scope: FeeTenantScope, payload: z.infer<typeof invoiceGenerationSchema>) => {
  if (!payload.feeStructureId) return null;
  return prisma.feeStructure.findFirst({
    where: { id: payload.feeStructureId, ...tenantScopeOnly(scope), deletedAt: null, status: 'ACTIVE', feeType: { deletedAt: null, status: 'ACTIVE' } },
    include: includeStructure,
  });
};

const loadExistingInvoiceMap = async (
  scope: FeeTenantScope,
  candidates: Array<{ student: InvoiceStudent; structure: InvoiceStructure | null }>,
  feeMonth: string,
) => {
  const invoiceCandidates = candidates.filter((candidate) => candidate.structure);
  if (!invoiceCandidates.length) return new Map<string, { id: string; invoiceNumber: string }>();
  if (invoiceCandidates.length === 1) {
    const candidate = invoiceCandidates[0];
    const duplicate = await prisma.feeInvoice.findFirst({
      where: {
        ...tenantScopeOnly(scope),
        studentId: candidate.student.id,
        feeStructureId: candidate.structure?.id,
        feeTypeId: candidate.structure?.feeTypeId,
        feeMonth,
      },
      select: { id: true, invoiceNumber: true },
    });
    return duplicate ? new Map([[invoicePeriodKey(candidate.student.id, candidate.structure?.id, candidate.structure?.feeTypeId, feeMonth), duplicate]]) : new Map();
  }
  const structureIds = uniqueStrings(invoiceCandidates.map((candidate) => candidate.structure?.id));
  const feeTypeIds = uniqueStrings(invoiceCandidates.map((candidate) => candidate.structure?.feeTypeId));
  const rows = await prisma.feeInvoice.findMany({
    where: {
      ...tenantScopeOnly(scope),
      studentId: { in: uniqueStrings(invoiceCandidates.map((candidate) => candidate.student.id)) },
      feeStructureId: { in: structureIds },
      feeTypeId: { in: feeTypeIds },
      feeMonth,
    },
    select: { id: true, invoiceNumber: true, studentId: true, feeStructureId: true, feeTypeId: true },
  });
  return new Map(rows.map((row) => [invoicePeriodKey(row.studentId, row.feeStructureId, row.feeTypeId, feeMonth), { id: row.id, invoiceNumber: row.invoiceNumber }]));
};

const loadPreviousBalanceMap = async (_scope: FeeTenantScope, students: InvoiceStudent[]) => {
  return new Map(students.map((student) => [student.id, toDecimal(0)]));
};

const discountAppliesToStudent = (discount: FeeCalculationDiscount & {
  targetType: string;
  studentId?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  categoryId?: string | null;
  feeTypeId?: string | null;
}, student: InvoiceStudent, feeTypeId: string) => {
  if (!discount.targetType) return true;
  if (discount.feeTypeId && discount.feeTypeId !== feeTypeId) return false;
  if (discount.targetType === 'ALL') return true;
  if (discount.targetType === 'FEE_TYPE') return discount.feeTypeId === feeTypeId;
  if (discount.targetType === 'STUDENT') return discount.studentId === student.id;
  if (discount.targetType === 'CLASS') return discount.classId === student.classId;
  if (discount.targetType === 'SECTION') return discount.sectionId === student.sectionId;
  if (discount.targetType === 'CATEGORY') return discount.categoryId === student.studentCategoryId;
  return false;
};

const loadDiscountMap = async (scope: FeeTenantScope, students: InvoiceStudent[], structuresByStudentId: Map<string, InvoiceStructure>, dueDate: Date) => {
  if (!students.length) return new Map<string, FeeCalculationDiscount[]>();
  const feeTypeIds = uniqueStrings(Array.from(structuresByStudentId.values()).map((structure) => structure.feeTypeId));
  if (!feeTypeIds.length) return new Map<string, FeeCalculationDiscount[]>();
  const studentIds = students.map((student) => student.id);
  const discountTargets: Prisma.FeeDiscountWhereInput[] = [
    { targetType: 'ALL' },
    feeTypeIds.length === 1 ? { targetType: 'FEE_TYPE', feeTypeId: feeTypeIds[0] } : { targetType: 'FEE_TYPE', feeTypeId: { in: feeTypeIds } },
    studentIds.length === 1 ? { targetType: 'STUDENT', studentId: studentIds[0] } : { targetType: 'STUDENT', studentId: { in: studentIds } },
    ...uniqueStrings(students.map((student) => student.classId)).map((classId) => ({ targetType: 'CLASS' as const, classId })),
    ...uniqueStrings(students.map((student) => student.sectionId)).map((sectionId) => ({ targetType: 'SECTION' as const, sectionId })),
    ...uniqueStrings(students.map((student) => student.studentCategoryId)).map((categoryId) => ({ targetType: 'CATEGORY' as const, categoryId })),
  ];
  const discounts = await prisma.feeDiscount.findMany({
    where: {
      ...tenantScopeOnly(scope),
      deletedAt: null,
      approvalStatus: { in: [...approvedDiscountStatuses] },
      OR: discountTargets,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: dueDate } }] },
        { OR: [{ validTo: null }, { validTo: { gte: dueDate } }] },
        feeTypeIds.length === 1
          ? { OR: [{ feeTypeId: null }, { feeTypeId: feeTypeIds[0] }] }
          : { OR: [{ feeTypeId: null }, { feeTypeId: { in: feeTypeIds } }] },
      ],
    },
  });
  const discountsByStudentId = new Map<string, FeeCalculationDiscount[]>();
  for (const student of students) {
    const structure = structuresByStudentId.get(student.id);
    if (!structure) continue;
    discountsByStudentId.set(
      student.id,
      discounts.filter((discount) => discountAppliesToStudent(discount, student, structure.feeTypeId)),
    );
  }
  return discountsByStudentId;
};

const buildInvoicePreviewCandidates = async (
  scope: FeeTenantScope,
  payload: z.infer<typeof invoiceGenerationSchema>,
  feeMonth: string,
) => {
  const students = await findInvoiceStudents(scope, payload);
  const requestedStudentIds = requestedInvoiceStudentIds(payload);
  const foundStudentIds = new Set(students.map((student) => student.id));
  const excludedStudentIds = requestedStudentIds.filter((studentId) => !foundStudentIds.has(studentId));
  const assignmentByStudentId = await resolveInvoiceAssignmentsForStudents(scope, payload, students, feeMonth);
  const directStructure = await loadDirectInvoiceStructure(scope, payload);
  const rawCandidates = students.map((student) => {
    const assignment = assignmentByStudentId.get(student.id) ?? null;
    const structure = assignment?.feeStructure ?? directStructure;
    const warnings: string[] = [];
    if (!structure) warnings.push('Missing active fee assignment or structure');
    return { student, assignment, structure, warnings };
  });
  const duplicateMap = await loadExistingInvoiceMap(scope, rawCandidates, feeMonth);
  const calculationCandidates = rawCandidates.filter((candidate) =>
    candidate.structure && !duplicateMap.has(invoicePeriodKey(candidate.student.id, candidate.structure.id, candidate.structure.feeTypeId, feeMonth)),
  );
  const calculationStudents = calculationCandidates.map((candidate) => candidate.student);
  const structuresByStudentId = new Map(calculationCandidates.map((candidate) => [candidate.student.id, candidate.structure as InvoiceStructure]));
  const [previousBalanceByStudentId, discountsByStudentId] = await Promise.all([
    loadPreviousBalanceMap(scope, calculationStudents),
    loadDiscountMap(scope, calculationStudents, structuresByStudentId, payload.dueDate),
    calculationStudents.length > 1 ? prisma.feeFine.findMany({ where: { ...tenantScopeOnly(scope), status: 'ACTIVE', deletedAt: null }, select: { id: true } }) : Promise.resolve([]),
  ]);
  const candidates: InvoiceCandidate[] = rawCandidates.map(({ student, assignment, structure, warnings }) => {
    let duplicate: { id: string; invoiceNumber: string } | null = null;
    let calculation: FeeInvoiceCalculation | null = null;
    if (structure) {
      duplicate = duplicateMap.get(invoicePeriodKey(student.id, structure.id, structure.feeTypeId, feeMonth)) ?? null;
      if (duplicate) warnings.push(`Duplicate invoice exists (${duplicate.invoiceNumber})`);
      if (!duplicate) {
        calculation = calculateFeeInvoiceAmountsFromPreloaded({
          structure,
          assignment,
          previousBalance: previousBalanceByStudentId.get(student.id) ?? toDecimal(0),
          discounts: discountsByStudentId.get(student.id) ?? [],
        });
        if (calculation.netAmount.lte(0)) warnings.push('Net payable is zero or invalid');
      }
    }
    return { student, assignment, structure, duplicate, calculation, warnings };
  });

  return { candidates, excludedStudentIds, totalStudents: requestedStudentIds.length || students.length };
};

const buildInvoicePreviewResponse = (
  candidates: Array<{
    student: InvoiceStudent;
    structure: (Prisma.FeeStructureGetPayload<{ include: typeof includeStructure }> | null);
    duplicate: { id: string; invoiceNumber: string } | null;
    calculation: FeeInvoiceCalculation | null;
    warnings: string[];
  }>,
  excludedStudentIds: string[],
  feeMonth: string,
  dueDate: Date,
) => {
  const rows = candidates.map(({ student, structure, duplicate, calculation, warnings }) => {
    const canGenerate = Boolean(structure && calculation && !duplicate && calculation.netAmount.gt(0));
    return {
      studentId: student.id,
      studentName: student.fullName,
      admissionNumber: student.admissionNo,
      className: student.class?.name ?? null,
      sectionName: student.section?.name ?? null,
      feeStructureName: structure?.name ?? null,
      feeTypeName: structure?.feeType?.name ?? null,
      feeMonth,
      dueDate: dueDate.toISOString(),
      baseAmount: decimalNumber(calculation?.baseAmount),
      discountAmount: decimalNumber(calculation?.discountAmount),
      fineAmount: decimalNumber(calculation?.fineAmount),
      previousBalance: decimalNumber(calculation?.previousBalance),
      netPayable: decimalNumber(calculation?.netAmount),
      duplicateInvoiceExists: Boolean(duplicate),
      warnings,
      canGenerate,
    };
  });
  const generatableRows = rows.filter((row) => row.canGenerate);
  return {
    rows,
    excludedStudentIds,
    totals: {
      totalStudents: rows.length,
      totalBaseAmount: generatableRows.reduce((sum, row) => sum + row.baseAmount, 0),
      totalDiscount: generatableRows.reduce((sum, row) => sum + row.discountAmount, 0),
      totalFine: generatableRows.reduce((sum, row) => sum + row.fineAmount, 0),
      totalPreviousBalance: generatableRows.reduce((sum, row) => sum + row.previousBalance, 0),
      totalNetPayable: generatableRows.reduce((sum, row) => sum + row.netPayable, 0),
      duplicatesSkipped: rows.filter((row) => row.duplicateInvoiceExists).length,
      excludedStudents: excludedStudentIds.length,
      generatableStudents: generatableRows.length,
    },
  };
};

export const previewFeeInvoices = async (req: Request, res: Response) => {
  const payload = invoiceGenerationSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const feeMonth = await validateInvoiceGenerationPayload(scope, payload);
  const { candidates, excludedStudentIds } = await buildInvoicePreviewCandidates(scope, payload, feeMonth);
  res.status(200).json(buildInvoicePreviewResponse(candidates, excludedStudentIds, feeMonth, payload.dueDate));
};

export const generateFeeInvoices = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const payload = invoiceGenerationSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const tenantScope = tenantScopeOnly(scope);
  const feeMonth = await validateInvoiceGenerationPayload(scope, payload);
  const { candidates, excludedStudentIds, totalStudents } = await buildInvoicePreviewCandidates(scope, payload, feeMonth);
  if (!candidates.length) throw new HttpError(404, 'No students found for invoice generation');

  const generated: Prisma.FeeInvoiceGetPayload<{ include: typeof includeInvoice }>[] = [];
  const failed: Array<{ studentId: string; reason: string }> = [];
  const skipped: Array<{ studentId: string; reason: string }> = [];
  let skippedDuplicateCount = 0;
  let skippedNoAssignmentCount = 0;
  let skippedInvalidAmountCount = 0;

  const invoiceCandidates = [];
  for (const candidate of candidates) {
    if (!candidate.structure) {
      skipped.push({ studentId: candidate.student.id, reason: 'No active fee assignment or structure' });
      skippedNoAssignmentCount += 1;
      continue;
    }
    if (candidate.duplicate) {
      skipped.push({ studentId: candidate.student.id, reason: `Invoice already exists (${candidate.duplicate.invoiceNumber})` });
      skippedDuplicateCount += 1;
      continue;
    }
    if (!candidate.calculation || candidate.calculation.netAmount.lte(0)) {
      skipped.push({ studentId: candidate.student.id, reason: 'Net payable is zero or invalid' });
      skippedInvalidAmountCount += 1;
      continue;
    }
    invoiceCandidates.push(candidate);
  }

  const chunkSize = 100;
  for (let index = 0; index < invoiceCandidates.length; index += chunkSize) {
    const chunk = invoiceCandidates.slice(index, index + chunkSize);
    for (const { student, structure, calculation } of chunk) {
      if (!structure || !calculation) continue;
      const {
        invoiceItems,
        previousBalance,
        discountAmount,
        fineAmount,
        totalAmount,
        netAmount,
      } = calculation;
      const receivableDebitAmount = totalAmount.plus(fineAmount);
      const invoicePeriodWhere: Prisma.FeeInvoiceWhereInput = {
        ...tenantScope,
        studentId: student.id,
        feeStructureId: structure.id,
        feeTypeId: structure.feeTypeId,
        feeMonth,
      };

      try {
        const invoice = await prisma.$transaction(async (tx) => {
          const invoiceNumber = await getNextNumber({ ...tenantScope, type: 'INVOICE', prefix: 'INV' }, tx);
          const created = await tx.feeInvoice.create({
            data: {
              ...tenantScope,
              studentId: student.id,
              classId: student.classId,
              sectionId: student.sectionId,
              feeStructureId: structure.id,
              feeTypeId: structure.feeTypeId,
              invoiceNumber,
              feeMonth,
              dueDate: payload.dueDate,
              previousBalance,
              discountAmount,
              fineAmount,
              totalAmount,
              paidAmount: toDecimal(0),
              dueAmount: netAmount,
              status: 'ISSUED',
              createdById: scope.userId,
              items: {
                create: invoiceItems,
              },
              notifications: payload.emailInvoice
                ? {
                    create: {
                    schoolId: scope.schoolId,
                    academicSessionId: scope.academicSessionId,
                      studentId: student.id,
                      type: 'INVOICE_GENERATED',
                      channel: 'EMAIL',
                      recipient: student.parentEmail || student.email || '',
                      subject: `Fee invoice ${invoiceNumber}`,
                      message: `Fee invoice ${invoiceNumber} generated for ${student.fullName}.`,
                      status: student.parentEmail || student.email ? 'QUEUED' : 'FAILED',
                    },
                  }
                : undefined,
            },
            include: includeInvoice,
          });
          await createLedgerEntry(tx, {
            schoolId: scope.schoolId,
            academicSessionId: scope.academicSessionId,
            studentId: student.id,
            invoiceId: created.id,
            type: 'INVOICE_DEBIT',
            description: `Invoice ${created.invoiceNumber}`,
            debitAmount: receivableDebitAmount,
            createdById: scope.userId,
          });
          if (discountAmount.gt(0)) {
            await createLedgerEntry(tx, {
              schoolId: scope.schoolId,
              academicSessionId: scope.academicSessionId,
              studentId: student.id,
              invoiceId: created.id,
              type: 'DISCOUNT_CREDIT',
              description: `Discount applied on invoice ${created.invoiceNumber}`,
              creditAmount: discountAmount,
              createdById: scope.userId,
            });
          }
          return created;
        });

        await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_INVOICE', entityId: invoice.id, action: 'CREATE', afterState: invoice });
        generated.push(invoice);
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          const existing = await prisma.feeInvoice.findFirst({
            where: invoicePeriodWhere,
            select: { id: true, invoiceNumber: true },
          });
          if (existing) {
            skipped.push({ studentId: student.id, reason: `Invoice already exists (${existing.invoiceNumber})` });
            skippedDuplicateCount += 1;
            continue;
          }
        }
        failed.push({ studentId: student.id, reason: err instanceof Error ? err.message : 'Invoice generation failed' });
      }
    }
  }

  const durationMs = Date.now() - startedAt;
  console.info('[fees] bulk invoice generation', {
    schoolId: scope.schoolId,
    academicSessionId: scope.academicSessionId,
    totalStudents,
    eligibleStudents: invoiceCandidates.length,
    generatedCount: generated.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    durationMs,
  });

  res.status(201).json({
    generated,
    skipped,
    failed,
    totalStudents,
    eligibleStudents: invoiceCandidates.length,
    generatedCount: generated.length,
    skippedNoAssignmentCount,
    skippedInactiveStudentCount: excludedStudentIds.length,
    skippedDuplicateCount,
    skippedInvalidAmountCount,
    failedCount: failed.length,
    durationMs,
    invoiceIds: generated.map((invoice) => invoice.id),
  });
};

export const listFeeInvoices = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const query = z.object({
    search: z.string().trim().optional(),
    studentId: uuidSchema.optional(),
    admissionNumber: z.string().trim().optional(),
    invoiceNumber: z.string().trim().optional(),
    classId: uuidSchema.optional(),
    sectionId: uuidSchema.optional(),
    feeTypeId: uuidSchema.optional(),
    feeStructureId: uuidSchema.optional(),
    feeMonth: z.string().trim().optional(),
    status: z.enum(feeInvoiceStatuses).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    dueDateFrom: z.coerce.date().optional(),
    dueDateTo: z.coerce.date().optional(),
    sortBy: z.enum(['invoiceDate', 'dueDate', 'feeMonth', 'totalAmount', 'paidAmount', 'balanceAmount', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }).parse(req.query);
  const dateRange = (from?: Date, to?: Date): Prisma.DateTimeFilter | undefined => {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (from) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      filter.gte = start;
    }
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.lte = end;
    }
    return filter;
  };
  const search = nullableText(query.search);
  const invoiceDateFilter = dateRange(query.dateFrom, query.dateTo);
  const dueDateFilter = dateRange(query.dueDateFrom, query.dueDateTo);
  const where: Prisma.FeeInvoiceWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.classId ? { classId: query.classId } : {}),
    ...(query.sectionId ? { sectionId: query.sectionId } : {}),
    ...(query.feeTypeId ? { feeTypeId: query.feeTypeId } : {}),
    ...(query.feeStructureId ? { feeStructureId: query.feeStructureId } : {}),
    ...(nullableText(query.feeMonth) ? { feeMonth: nullableText(query.feeMonth) } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(invoiceDateFilter ? { issueDate: invoiceDateFilter } : {}),
    ...(dueDateFilter ? { dueDate: dueDateFilter } : {}),
    ...(nullableText(query.admissionNumber) ? { student: { admissionNo: { contains: normalizeText(query.admissionNumber!), mode: 'insensitive' } } } : {}),
    ...(nullableText(query.invoiceNumber) ? { invoiceNumber: { contains: normalizeText(query.invoiceNumber!), mode: 'insensitive' } } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { student: { fullName: { contains: search, mode: 'insensitive' } } },
            { student: { admissionNo: { contains: search, mode: 'insensitive' } } },
            { class: { name: { contains: search, mode: 'insensitive' } } },
            { section: { name: { contains: search, mode: 'insensitive' } } },
            { feeType: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const sortFieldMap: Record<typeof query.sortBy, keyof Prisma.FeeInvoiceOrderByWithRelationInput> = {
    invoiceDate: 'issueDate',
    dueDate: 'dueDate',
    feeMonth: 'feeMonth',
    totalAmount: 'totalAmount',
    paidAmount: 'paidAmount',
    balanceAmount: 'dueAmount',
    createdAt: 'createdAt',
  };
  const orderBy = { [sortFieldMap[query.sortBy]]: query.sortOrder } as Prisma.FeeInvoiceOrderByWithRelationInput;
  const [items, total] = await Promise.all([
    prisma.feeInvoice.findMany({ where, include: includeInvoice, orderBy, skip, take: limit }),
    prisma.feeInvoice.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  res.status(200).json({ data: items, items, page, limit, total, totalPages, pagination: { page, limit, total, totalPages } });
};

const cancelInvoiceSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  reason: z.string().max(500).optional().nullable(),
});

export const cancelFeeInvoice = async (req: Request, res: Response) => {
  const payload = cancelInvoiceSchema.parse(req.body ?? {});
  const scope = await resolveScope(req, payload);
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null },
    include: { payments: { select: { id: true } } },
  });
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  if (invoice.status === 'CANCELLED') throw new HttpError(409, 'Invoice is already cancelled');
  if (invoice.payments.length || toDecimal(invoice.paidAmount).gt(0)) throw new HttpError(409, 'Cannot cancel invoice after payment collection');

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.feeInvoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED', dueAmount: toDecimal(0) },
      include: includeInvoice,
    });
    await createLedgerEntry(tx, {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      studentId: invoice.studentId,
      invoiceId: invoice.id,
      type: 'CANCELLATION_REVERSAL',
      description: `Invoice ${invoice.invoiceNumber} cancelled${payload.reason ? ` - ${payload.reason}` : ''}`,
      creditAmount: toDecimal(invoice.dueAmount),
      createdById: scope.userId,
    });
    return item;
  });

  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_INVOICE', entityId: updated.id, action: 'CANCEL', beforeState: invoice, afterState: updated });
  res.status(200).json(updated);
};

export const searchFeeCollectionStudents = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const students = await prisma.student.findMany({
    where: {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      status: assignableStudentStatus,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { admissionNo: { contains: search, mode: 'insensitive' } },
              { rollNo: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { parentPhone: { contains: search, mode: 'insensitive' } },
              { fatherPhone: { contains: search, mode: 'insensitive' } },
              { motherPhone: { contains: search, mode: 'insensitive' } },
              { class: { name: { contains: search, mode: 'insensitive' } } },
              { section: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true, classId: true } },
    },
    orderBy: { fullName: 'asc' },
    take: 25,
  });
  const dueRows = students.length
    ? await prisma.feeInvoice.groupBy({
        by: ['studentId'],
        where: {
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId: { in: students.map((student) => student.id) },
          deletedAt: null,
          status: { notIn: ['PAID', 'CANCELLED'] },
          dueAmount: { gt: 0 },
        },
        _count: { _all: true },
        _sum: { dueAmount: true },
      })
    : [];
  const dueByStudent = new Map(dueRows.map((row) => [row.studentId, row]));
  res.status(200).json({
    items: students.map((student) => {
      const due = dueByStudent.get(student.id);
      return {
        ...student,
        pendingInvoiceCount: due?._count._all ?? 0,
        pendingAmount: due?._sum.dueAmount ?? toDecimal(0),
      };
    }),
  });
};

export const listStudentCollectionInvoices = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await assertStudent(scope.schoolId, uuidParam(req, 'studentId'), scope.academicSessionId);
  const items = await prisma.feeInvoice.findMany({
    where: {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      studentId: uuidParam(req, 'studentId'),
      deletedAt: null,
      status: { notIn: ['PAID', 'CANCELLED'] },
      dueAmount: { gt: 0 },
    },
    include: includeInvoice,
    orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }],
  });
  res.status(200).json({
    items: items.map((invoice) => ({
      ...invoice,
      balanceAmount: calculateInvoiceDueAmount(invoice),
    })),
  });
};

const paymentAllocationSchema = z.object({
  invoiceId: uuidSchema,
  amount: decimalInput,
});

const paymentSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  invoiceId: uuidSchema.optional(),
  amount: decimalInput.optional(),
  paymentDate: z.coerce.date().optional(),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']),
  transactionReference: z.string().max(160).optional().nullable(),
  chequeNumber: z.string().max(80).optional().nullable(),
  bankName: z.string().max(160).optional().nullable(),
  idempotencyKey: z.string().max(160).optional().nullable(),
  gateway: z.string().max(80).optional().nullable(),
  gatewayPaymentId: z.string().max(160).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  allocations: z.array(paymentAllocationSchema).optional(),
});

export const collectFeePayment = async (req: Request, res: Response) => {
  const payload = paymentSchema.parse(req.body);
  const allocations = (payload.allocations?.length
    ? payload.allocations
    : payload.invoiceId && payload.amount !== undefined
      ? [{ invoiceId: payload.invoiceId, amount: payload.amount }]
      : []
  ).map((allocation) => ({ invoiceId: allocation.invoiceId, amount: toDecimal(allocation.amount) }));
  if (!allocations.length) throw new HttpError(400, 'At least one invoice allocation is required');
  const duplicateInvoiceIds = allocations.map((allocation) => allocation.invoiceId).filter((invoiceId, index, all) => all.indexOf(invoiceId) !== index);
  if (duplicateInvoiceIds.length) throw new HttpError(400, 'Duplicate invoice allocations are not allowed');
  for (const allocation of allocations) {
    if (allocation.amount.lte(0)) throw new HttpError(400, 'Allocation amount must be greater than zero');
  }
  const allocationTotal = allocations.reduce((sum, allocation) => sum.plus(allocation.amount), toDecimal(0));
  const amount = payload.amount === undefined ? allocationTotal : toDecimal(payload.amount);
  if (amount.lte(0)) throw new HttpError(400, 'Payment amount must be greater than zero');
  if (!allocationTotal.eq(amount)) throw new HttpError(400, 'Total allocation must equal payment amount');
  const transactionReference = nullableText(payload.transactionReference);
  if (referenceRequiredPaymentModes.has(payload.paymentMode) && !transactionReference) {
    throw new HttpError(400, `${payload.paymentMode} payment requires a transaction reference`);
  }
  const chequeNumber = nullableText(payload.chequeNumber);
  const bankName = nullableText(payload.bankName);
  if (payload.paymentMode === 'CHEQUE' && (!chequeNumber || !bankName)) {
    throw new HttpError(400, 'CHEQUE payment requires cheque number and bank name');
  }
  const idempotencyKey = nullableText(payload.idempotencyKey);
  const scope = await resolveScope(req, payload);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const paymentDate = payload.paymentDate ?? new Date();

  let result: ReturnType<typeof paymentResponse>;
  try {
    result = await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await findIdempotentPayment(tx, scope.schoolId, idempotencyKey);
        if (existing) {
          assertIdempotentPaymentMatches(
            existing,
            scope,
            { studentId: payload.studentId ?? existing.studentId, paymentMode: payload.paymentMode, allocations },
            amount,
            transactionReference,
          );
          return paymentResponse(existing, true);
        }
      }

      const invoiceIds = allocations.map((allocation) => allocation.invoiceId);
      await lockFeeInvoicesForPayment(tx, scope, invoiceIds);
      const invoices = await tx.feeInvoice.findMany({
        where: { id: { in: invoiceIds }, ...tenantScope, deletedAt: null },
        include: includeInvoice,
      });
      if (invoices.length !== invoiceIds.length) throw new HttpError(404, 'One or more invoices were not found');
      const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
      const studentId = payload.studentId ?? invoices[0]?.studentId;
      if (!studentId) throw new HttpError(400, 'studentId is required');
      if (invoices.some((invoice) => invoice.studentId !== studentId)) {
        throw new HttpError(400, 'All allocated invoices must belong to the selected student');
      }
      for (const allocation of allocations) {
        const invoice = invoicesById.get(allocation.invoiceId);
        if (!invoice) throw new HttpError(404, 'Invoice not found');
        if (invoice.status === 'CANCELLED') throw new HttpError(409, 'Cannot collect payment for cancelled invoice');
        if (invoice.status === 'PAID') throw new HttpError(409, 'Invoice is already paid');
        const currentDueAmount = calculateInvoiceDueAmount(invoice);
        if (currentDueAmount.lte(0)) throw new HttpError(409, 'Invoice is already paid');
        if (allocation.amount.gt(currentDueAmount)) throw new HttpError(400, 'Allocation cannot exceed invoice due amount');
      }

      const paymentNumber = await getNextNumber({ ...tenantScope, type: 'PAYMENT', prefix: 'PAY' }, tx);
      const receiptNumber = await getNextNumber({ ...tenantScope, type: 'RECEIPT', prefix: 'RCP' }, tx);
      const primaryInvoice = invoicesById.get(allocations[0].invoiceId)!;
      const payment = await tx.feePayment.create({
        data: {
          ...tenantScope,
          studentId,
          invoiceId: primaryInvoice.id,
          paymentNumber,
          paymentMode: payload.paymentMode,
          amount,
          transactionReference,
          idempotencyKey,
          gateway: nullableText(payload.gateway),
          gatewayPaymentId: nullableText(payload.gatewayPaymentId),
          chequeNumber,
          bankName,
          status: 'SUCCESS',
          paidAt: paymentDate,
          note: nullableText(payload.note),
          collectedById: scope.userId,
        },
      });
      const receipt = await tx.feeReceipt.create({
        data: {
          ...tenantScope,
          studentId,
          invoiceId: primaryInvoice.id,
          paymentId: payment.id,
          receiptNumber,
          amount,
          receiptDate: paymentDate,
        },
      });
      const createdAllocations = [];
      const updatedInvoices = [];
      for (const allocation of allocations) {
        const invoice = invoicesById.get(allocation.invoiceId)!;
        const currentDueAmount = calculateInvoiceDueAmount(invoice);
        const paidAmount = toDecimal(invoice.paidAmount).plus(allocation.amount);
        const dueAmount = currentDueAmount.minus(allocation.amount);
        const status = dueAmount.eq(0) ? 'PAID' : 'PARTIALLY_PAID';
        const updatedInvoice = await tx.feeInvoice.update({
          where: { id: invoice.id },
          data: { paidAmount, dueAmount, status },
          include: includeInvoice,
        });
        const createdAllocation = await tx.feePaymentAllocation.create({
          data: {
            ...tenantScope,
            studentId,
            paymentId: payment.id,
            invoiceId: invoice.id,
            allocatedAmount: allocation.amount,
          },
        });
        await createLedgerEntry(tx, {
          ...tenantScope,
          studentId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          receiptId: receipt.id,
          type: 'PAYMENT_CREDIT',
          description: `Payment ${payment.paymentNumber} against invoice ${invoice.invoiceNumber}`,
          creditAmount: allocation.amount,
          createdById: scope.userId,
        });
        createdAllocations.push({ ...createdAllocation, invoice: updatedInvoice });
        updatedInvoices.push(updatedInvoice);
      }
      await tx.feeNotification.create({
        data: {
          ...tenantScope,
          studentId,
          invoiceId: primaryInvoice.id,
          type: 'PAYMENT_SUCCESS',
          channel: 'IN_APP',
          recipient: studentId,
          message: `Payment ${payment.paymentNumber} received for ${allocations.length} invoice${allocations.length === 1 ? '' : 's'}.`,
          status: 'QUEUED',
        },
      });
      return { payment, receipt, invoice: updatedInvoices[0], invoices: updatedInvoices, allocations: createdAllocations, idempotent: false } as ReturnType<typeof paymentResponse>;
    });
  } catch (err) {
    if (idempotencyKey && isUniqueConstraintError(err)) {
      const existing = await findIdempotentPayment(prisma, scope.schoolId, idempotencyKey);
      if (existing) {
        assertIdempotentPaymentMatches(
          existing,
          scope,
          { studentId: payload.studentId ?? existing.studentId, paymentMode: payload.paymentMode, allocations },
          amount,
          transactionReference,
        );
        result = paymentResponse(existing, true);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (!result.idempotent) {
    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PAYMENT', entityId: result.payment.id, action: 'CREATE', afterState: result });
  }
  res.status(result.idempotent ? 200 : 201).json(result);
};

export const listFeePayments = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const paymentMode = typeof req.query.paymentMode === 'string' && paymentModes.includes(req.query.paymentMode as FeePaymentModeValue)
    ? (req.query.paymentMode as FeePaymentModeValue)
    : undefined;
  const status = typeof req.query.status === 'string' && paymentStatuses.includes(req.query.status as FeePaymentStatusValue)
    ? (req.query.status as FeePaymentStatusValue)
    : undefined;
  const requestedSortBy = typeof req.query.sortBy === 'string' && paymentSortFields.includes(req.query.sortBy as (typeof paymentSortFields)[number])
    ? req.query.sortBy
    : 'paidAt';
  const sortBy = requestedSortBy === 'paymentDate' ? 'paidAt' : requestedSortBy;
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const where: Prisma.FeePaymentWhereInput = {
    ...tenantScopeOnly(scope),
    ...(paymentMode ? { paymentMode } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { paymentNumber: { contains: search, mode: 'insensitive' } },
            { transactionReference: { contains: search, mode: 'insensitive' } },
            { chequeNumber: { contains: search, mode: 'insensitive' } },
            { bankName: { contains: search, mode: 'insensitive' } },
            { student: { fullName: { contains: search, mode: 'insensitive' } } },
            { student: { admissionNo: { contains: search, mode: 'insensitive' } } },
            { receipt: { is: { receiptNumber: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feePayment.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true } },
        student: { select: { fullName: true, admissionNo: true } },
        receipt: true,
        allocations: { include: { invoice: { select: { invoiceNumber: true, feeMonth: true, dueAmount: true, status: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.feePayment.count({ where }),
  ]);
  res.status(200).json({
    items,
    data: items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

const ledgerInclude = {
  student: {
    select: {
      id: true,
      admissionNo: true,
      fullName: true,
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
    },
  },
  invoice: { select: { id: true, invoiceNumber: true } },
  payment: { select: { id: true, paymentNumber: true, receipt: { select: { id: true, receiptNumber: true } } } },
  receipt: { select: { id: true, receiptNumber: true } },
} satisfies Prisma.FeeLedgerInclude;

type LedgerRecord = Prisma.FeeLedgerGetPayload<{ include: typeof ledgerInclude }>;

const ledgerQuerySchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  studentId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  entryType: z.nativeEnum(FeeLedgerEntryType).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(20),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

const formatLedgerEntry = (item: LedgerRecord) => ({
  id: item.id,
  schoolId: item.schoolId,
  academicSessionId: item.academicSessionId,
  studentId: item.studentId,
  invoiceId: item.invoiceId,
  paymentId: item.paymentId,
  receiptId: item.receiptId,
  type: item.type,
  entryType: item.type,
  debitAmount: item.debitAmount,
  creditAmount: item.creditAmount,
  balanceAfter: item.balanceAfter,
  description: item.description,
  createdById: item.createdById,
  entryDate: item.entryDate,
  createdAt: item.createdAt,
  student: item.student,
  invoice: item.invoice,
  payment: item.payment,
  receipt: item.receipt ?? item.payment?.receipt ?? null,
  referenceInvoiceNumber: item.invoice?.invoiceNumber ?? null,
  referencePaymentNumber: item.payment?.paymentNumber ?? null,
  referenceReceiptNumber: item.receipt?.receiptNumber ?? item.payment?.receipt?.receiptNumber ?? null,
});

const buildLedgerData = async (req: Request, options?: { export?: boolean }) => {
  const payload = ledgerQuerySchema.parse({
    ...req.query,
    studentId: req.params.studentId ? uuidParam(req, 'studentId') : req.query.studentId,
    limit: options?.export ? req.query.limit ?? 5000 : req.query.limit,
  });
  if (payload.dateFrom && payload.dateTo && payload.dateFrom > payload.dateTo) {
    throw new HttpError(400, 'dateFrom must be before dateTo');
  }
  const scope = await resolveScope(req, payload);
  if (payload.studentId) await assertStudent(scope.schoolId, payload.studentId, scope.academicSessionId);
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId) await assertSection(scope.schoolId, payload.sectionId);

  const createdAt = payload.dateFrom || payload.dateTo ? { ...(payload.dateFrom ? { gte: payload.dateFrom } : {}), ...(payload.dateTo ? { lte: payload.dateTo } : {}) } : undefined;
  const where: Prisma.FeeLedgerWhereInput = {
    schoolId: scope.schoolId,
    academicSessionId: scope.academicSessionId,
    ...(payload.studentId ? { studentId: payload.studentId } : {}),
    ...(payload.entryType ? { type: payload.entryType } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(payload.classId || payload.sectionId
      ? {
          student: {
            ...(payload.classId ? { classId: payload.classId } : {}),
            ...(payload.sectionId ? { sectionId: payload.sectionId } : {}),
          },
        }
      : {}),
  };
  const skip = (payload.page - 1) * payload.limit;
  const [items, total, opening] = await Promise.all([
    prisma.feeLedger.findMany({
      where,
      include: ledgerInclude,
      orderBy: [{ [payload.sortBy]: payload.sortOrder }, { id: payload.sortOrder }],
      skip: options?.export ? 0 : skip,
      take: payload.limit,
    }),
    prisma.feeLedger.count({ where }),
    payload.studentId && payload.dateFrom
      ? prisma.feeLedger.findFirst({
          where: {
            schoolId: scope.schoolId,
            academicSessionId: scope.academicSessionId,
            studentId: payload.studentId,
            createdAt: { lt: payload.dateFrom },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { balanceAfter: true },
        })
      : Promise.resolve(null),
  ]);
  const openingBalance = toDecimal(opening?.balanceAfter ?? 0);
  const formatted = items.map(formatLedgerEntry);
  const openingEntry =
    payload.studentId && payload.dateFrom
      ? {
          id: `opening-${payload.studentId}-${payload.dateFrom.toISOString()}`,
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId: payload.studentId,
          invoiceId: null,
          paymentId: null,
          receiptId: null,
          type: 'OPENING_BALANCE' as const,
          entryType: 'OPENING_BALANCE' as const,
          debitAmount: toDecimal(0),
          creditAmount: toDecimal(0),
          balanceAfter: openingBalance,
          description: `Opening balance as of ${payload.dateFrom.toISOString().slice(0, 10)}`,
          createdById: null,
          entryDate: payload.dateFrom,
          createdAt: payload.dateFrom,
          student: formatted[0]?.student ?? null,
          invoice: null,
          payment: null,
          receipt: null,
          referenceInvoiceNumber: null,
          referencePaymentNumber: null,
          referenceReceiptNumber: null,
        }
      : null;

  return {
    scope,
    query: payload,
    items: openingEntry && payload.page === 1 && !options?.export ? [openingEntry, ...formatted] : formatted,
    exportItems: openingEntry ? [openingEntry, ...formatted] : formatted,
    openingBalance,
    pagination: {
      page: payload.page,
      limit: payload.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / payload.limit)),
    },
  };
};

export const getStudentFeeLedger = async (req: Request, res: Response) => {
  const result = await buildLedgerData(req);
  res.status(200).json({
    schoolId: result.scope.schoolId,
    academicSessionId: result.scope.academicSessionId,
    openingBalance: result.openingBalance,
    items: result.items,
    pagination: result.pagination,
  });
};

const ledgerExportFilename = (extension: 'pdf' | 'xlsx') => `fee-ledger-${new Date().toISOString().slice(0, 10)}.${extension}`;

const decimalText = (value: Prisma.Decimal | number | string | null | undefined) => toDecimal(value ?? 0).toFixed(2);

export const exportFeeLedgerExcel = async (req: Request, res: Response) => {
  const result = await buildLedgerData(req, { export: true });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fee Ledger');
  sheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Student', key: 'student', width: 28 },
    { header: 'Admission No', key: 'admissionNo', width: 16 },
    { header: 'Class', key: 'className', width: 16 },
    { header: 'Section', key: 'sectionName', width: 16 },
    { header: 'Type', key: 'type', width: 24 },
    { header: 'Description', key: 'description', width: 42 },
    { header: 'Invoice', key: 'invoiceNumber', width: 18 },
    { header: 'Receipt', key: 'receiptNumber', width: 18 },
    { header: 'Debit', key: 'debit', width: 14 },
    { header: 'Credit', key: 'credit', width: 14 },
    { header: 'Running Balance', key: 'balance', width: 18 },
  ];
  result.exportItems.forEach((item) => {
    sheet.addRow({
      date: item.createdAt.toISOString().slice(0, 10),
      student: item.student?.fullName ?? '',
      admissionNo: item.student?.admissionNo ?? '',
      className: item.student?.class?.name ?? '',
      sectionName: item.student?.section?.name ?? '',
      type: item.type,
      description: item.description,
      invoiceNumber: item.referenceInvoiceNumber ?? '',
      receiptNumber: item.referenceReceiptNumber ?? '',
      debit: Number(decimalText(item.debitAmount)),
      credit: Number(decimalText(item.creditAmount)),
      balance: Number(decimalText(item.balanceAfter)),
    });
  });
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  await logAudit(req, {
    schoolId: result.scope.schoolId,
    entityType: 'FEE_LEDGER_EXPORT',
    entityId: result.query.studentId ?? 'ALL',
    action: 'EXPORT_XLSX',
    afterState: { rows: result.exportItems.length },
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${ledgerExportFilename('xlsx')}"`);
  res.status(200).send(Buffer.from(buffer));
};

export const exportFeeLedgerPdf = async (req: Request, res: Response) => {
  const result = await buildLedgerData(req, { export: true });
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Student Fee Ledger', { align: 'center' });
    doc.moveDown();
    doc.fontSize(9).text(`School: ${result.scope.schoolId}`);
    doc.text(`Academic Session: ${result.scope.academicSessionId}`);
    if (result.query.studentId) doc.text(`Student: ${result.query.studentId}`);
    doc.moveDown();
    result.exportItems.forEach((item) => {
      const line = [
        item.createdAt.toISOString().slice(0, 10),
        item.student?.fullName ?? '',
        item.student?.admissionNo ?? '',
        item.type,
        item.description,
        `Dr ${decimalText(item.debitAmount)}`,
        `Cr ${decimalText(item.creditAmount)}`,
        `Bal ${decimalText(item.balanceAfter)}`,
        item.referenceInvoiceNumber ? `Invoice ${item.referenceInvoiceNumber}` : '',
        item.referenceReceiptNumber ? `Receipt ${item.referenceReceiptNumber}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      doc.fontSize(8).text(line, { lineGap: 2 });
    });
    doc.end();
  });
  await logAudit(req, {
    schoolId: result.scope.schoolId,
    entityType: 'FEE_LEDGER_EXPORT',
    entityId: result.query.studentId ?? 'ALL',
    action: 'EXPORT_PDF',
    afterState: { rows: result.exportItems.length },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${ledgerExportFilename('pdf')}"`);
  res.status(200).send(buffer);
};

export const listFeeDiscounts = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const status = typeof req.query.status === 'string' && discountApprovalStatuses.includes(req.query.status as FeeDiscountStatus) ? (req.query.status as FeeDiscountStatus) : undefined;
  const targetType = typeof req.query.targetType === 'string' && discountTargetTypes.includes(req.query.targetType as FeeDiscountTarget) ? (req.query.targetType as FeeDiscountTarget) : undefined;
  const dateFrom = typeof req.query.dateFrom === 'string' ? new Date(req.query.dateFrom) : null;
  const dateTo = typeof req.query.dateTo === 'string' ? new Date(req.query.dateTo) : null;
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const sortBy = typeof req.query.sortBy === 'string' && discountSortFields.includes(req.query.sortBy as (typeof discountSortFields)[number])
    ? req.query.sortBy
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const where: Prisma.FeeDiscountWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(status ? { approvalStatus: status } : {}),
    ...(targetType ? { targetType } : {}),
    ...(typeof req.query.studentId === 'string' ? { studentId: req.query.studentId } : {}),
    ...(typeof req.query.classId === 'string' ? { classId: req.query.classId } : {}),
    ...(typeof req.query.sectionId === 'string' ? { sectionId: req.query.sectionId } : {}),
    ...(typeof req.query.categoryId === 'string' ? { categoryId: req.query.categoryId } : {}),
    ...(typeof req.query.feeTypeId === 'string' ? { feeTypeId: req.query.feeTypeId } : {}),
    ...(search
      ? {
          OR: [
            { discountName: { contains: search, mode: 'insensitive' } },
            { reason: { contains: search, mode: 'insensitive' } },
            { note: { contains: search, mode: 'insensitive' } },
            { student: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
            { student: { is: { admissionNo: { contains: search, mode: 'insensitive' } } } },
            { class: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { section: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { category: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { feeType: { is: { name: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(dateFrom || dateTo
      ? {
          AND: [
            ...(dateTo ? [{ OR: [{ validFrom: null }, { validFrom: { lte: dateTo } }] }] : []),
            ...(dateFrom ? [{ OR: [{ validTo: null }, { validTo: { gte: dateFrom } }] }] : []),
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feeDiscount.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, admissionNo: true } },
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        feeType: { select: { id: true, name: true, schedule: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.feeDiscount.count({ where }),
  ]);
  res.status(200).json({
    items,
    data: items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

export const createFeeDiscount = async (req: Request, res: Response) => {
  const rawPayload = discountSchema.parse(req.body);
  const payload = normalizeDiscountPayload(rawPayload);
  const scope = await resolveScope(req, payload);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  assertDiscountApprovalAllowed(req, payload.approvalStatus);
  await assertDiscountReferences(tenantScope, payload);
  await assertNoDuplicateActiveDiscount(tenantScope, payload);
  await assertDiscountDoesNotExceedCurrentPayable(tenantScope, payload);
  const item = await prisma.$transaction(async (tx) => {
    const discount = await tx.feeDiscount.create({
      data: {
        ...tenantScope,
        discountName: payload.discountName,
        targetType: payload.targetType,
        studentId: payload.studentId ?? null,
        classId: payload.classId ?? null,
        sectionId: payload.sectionId ?? null,
        categoryId: payload.categoryId ?? null,
        feeTypeId: payload.feeTypeId ?? null,
        particularId: payload.particularId ?? null,
        discountType: payload.discountType,
        valueType: payload.valueType,
        value: payload.value,
        amount: payload.amount,
        validFrom: payload.validFrom ?? null,
        validTo: payload.validTo ?? null,
        approvalStatus: payload.approvalStatus,
        approvedById: approvedDiscountStatuses.includes(payload.approvalStatus as (typeof approvedDiscountStatuses)[number]) ? scope.userId : null,
        approvedAt: approvedDiscountStatuses.includes(payload.approvalStatus as (typeof approvedDiscountStatuses)[number]) ? new Date() : null,
        reason: payload.reason,
        note: nullableText(payload.note),
        createdById: scope.userId,
      },
    });
    await applyApprovedDiscountToOpenInvoices(tx, scope, discount);
    return discount;
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

export const updateFeeDiscount = async (req: Request, res: Response) => {
  const rawPayload = discountSchema.partial().parse(req.body);
  const scope = await resolveScope(req, rawPayload);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const existing = await prisma.feeDiscount.findFirst({ where: { id: uuidParam(req), ...tenantScope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Discount not found');
  await assertDiscountNotLockedByPayment(tenantScope, existing);

  const merged = normalizeDiscountPayload({
    ...existing,
    discountValue: decimalNumber(existing.value),
    value: decimalNumber(existing.value),
    amount: existing.amount === null ? null : decimalNumber(existing.amount),
    status: existing.approvalStatus,
    ...rawPayload,
  });
  assertDiscountApprovalAllowed(req, merged.approvalStatus);
  await assertDiscountReferences(tenantScope, merged);
  await assertNoDuplicateActiveDiscount(tenantScope, merged, existing.id);
  await assertDiscountDoesNotExceedCurrentPayable(tenantScope, merged);
  const item = await prisma.$transaction(async (tx) => {
    const discount = await tx.feeDiscount.update({
      where: { id: existing.id },
      data: {
        discountName: merged.discountName,
        targetType: merged.targetType,
        studentId: merged.studentId,
        classId: merged.classId,
        sectionId: merged.sectionId,
        categoryId: merged.categoryId,
        feeTypeId: merged.feeTypeId,
        particularId: merged.particularId,
        discountType: merged.discountType,
        valueType: merged.valueType,
        value: merged.value,
        amount: merged.amount,
        validFrom: merged.validFrom,
        validTo: merged.validTo,
        approvalStatus: merged.approvalStatus,
        approvedById: approvedDiscountStatuses.includes(merged.approvalStatus as (typeof approvedDiscountStatuses)[number]) ? scope.userId : existing.approvedById,
        approvedAt: approvedDiscountStatuses.includes(merged.approvalStatus as (typeof approvedDiscountStatuses)[number]) ? new Date() : existing.approvedAt,
        reason: merged.reason,
        note: merged.note,
        updatedById: scope.userId,
      },
    });
    await applyApprovedDiscountToOpenInvoices(tx, scope, discount);
    return discount;
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const deleteFeeDiscount = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const existing = await prisma.feeDiscount.findFirst({ where: { id: uuidParam(req), ...tenantScope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Discount not found');
  await assertDiscountNotLockedByPayment(tenantScope, existing);
  const item = await prisma.feeDiscount.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), approvalStatus: 'INACTIVE', updatedById: scope.userId },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

const reviewFeeDiscount = async (req: Request, status: Extract<FeeDiscountStatus, 'APPROVED' | 'ACTIVE' | 'REJECTED'>) => {
  requireDiscountApprover(req);
  const scope = await resolveScope(req);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const existing = await prisma.feeDiscount.findFirst({ where: { id: uuidParam(req), ...tenantScope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Discount not found');
  const normalized = normalizeDiscountPayload({
    ...existing,
    discountValue: decimalNumber(existing.value),
    value: decimalNumber(existing.value),
    amount: existing.amount === null ? null : decimalNumber(existing.amount),
    status,
    reason: typeof req.body?.reason === 'string' ? req.body.reason : existing.reason,
  });
  await assertNoDuplicateActiveDiscount(tenantScope, normalized, existing.id);
  await assertDiscountDoesNotExceedCurrentPayable(tenantScope, normalized);
  const item = await prisma.$transaction(async (tx) => {
    const discount = await tx.feeDiscount.update({
      where: { id: existing.id },
      data: {
        approvalStatus: status,
        approvedById: scope.userId,
        approvedAt: new Date(),
        reason: normalized.reason,
        updatedById: scope.userId,
      },
    });
    await applyApprovedDiscountToOpenInvoices(tx, scope, discount);
    return discount;
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: status, beforeState: existing, afterState: item });
  return item;
};

export const approveFeeDiscount = async (req: Request, res: Response) => {
  const item = await reviewFeeDiscount(req, 'APPROVED');
  res.status(200).json(item);
};

export const rejectFeeDiscount = async (req: Request, res: Response) => {
  const item = await reviewFeeDiscount(req, 'REJECTED');
  res.status(200).json(item);
};

export const activateFeeDiscount = async (req: Request, res: Response) => {
  const item = await reviewFeeDiscount(req, 'ACTIVE');
  res.status(200).json(item);
};

export const deactivateFeeDiscount = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const existing = await prisma.feeDiscount.findFirst({ where: { id: uuidParam(req), ...tenantScope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Discount not found');
  await assertDiscountNotLockedByPayment(tenantScope, existing);
  const item = await prisma.feeDiscount.update({
    where: { id: existing.id },
    data: { approvalStatus: 'INACTIVE', updatedById: scope.userId },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: 'INACTIVE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

const fineSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  studentId: uuidSchema.optional().nullable(),
  invoiceId: uuidSchema.optional().nullable(),
  particularId: uuidSchema.optional().nullable(),
  name: z.string().min(1).max(160),
  fineType: z.enum(['FIXED', 'DAILY', 'MONTHLY']),
  amount: decimalInput,
  graceDays: z.coerce.number().int().min(0).max(365).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listFeeFines = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined;
  const sortBy = typeof req.query.sortBy === 'string' && fineSortFields.includes(req.query.sortBy as (typeof fineSortFields)[number])
    ? req.query.sortBy
    : 'createdAt';
  const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';
  const where: Prisma.FeeFineWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { particular: { is: { name: { contains: search, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feeFine.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: limit }),
    prisma.feeFine.count({ where }),
  ]);
  res.status(200).json({
    items,
    data: items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

export const deleteFeeFine = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeFine.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fine rule not found');
  const item = await prisma.feeFine.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const createFeeFine = async (req: Request, res: Response) => {
  const payload = fineSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  if (payload.studentId) await assertStudent(scope.schoolId, payload.studentId, scope.academicSessionId);
  if (payload.particularId) await assertParticulars(scope.schoolId, scope.academicSessionId, [payload.particularId]);
  const fineAmount = toDecimal(payload.amount);
  const fineName = normalizeText(payload.name);
  const invoice = payload.invoiceId
    ? await prisma.feeInvoice.findFirst({ where: { id: payload.invoiceId, ...tenantScope, deletedAt: null } })
    : null;
  if (payload.invoiceId && !invoice) throw new HttpError(404, 'Invoice not found');
  if (invoice?.status === 'CANCELLED') throw new HttpError(409, 'Cannot apply fine to cancelled invoice');
  if (invoice?.status === 'PAID') throw new HttpError(409, 'Cannot apply fine to paid invoice');
  const ledgerStudentId = payload.studentId ?? invoice?.studentId ?? null;
  const item = await prisma.$transaction(async (tx) => {
    if (invoice) {
      const duplicate = await tx.feeFine.findFirst({
        where: {
          ...tenantScope,
          invoiceId: invoice.id,
          name: fineName,
          fineType: payload.fineType,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) throw new HttpError(409, 'Fine already applied to this invoice');
    }
    const fine = await tx.feeFine.create({
      data: {
        ...tenantScope,
        invoiceId: invoice?.id ?? null,
        particularId: payload.particularId ?? null,
        name: fineName,
        fineType: payload.fineType,
        amount: fineAmount,
        graceDays: payload.graceDays ?? 0,
        status: payload.status ?? 'ACTIVE',
      },
    });
    if (invoice) {
      const newFineAmount = toDecimal(invoice.fineAmount).plus(fineAmount);
      await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          fineAmount: newFineAmount,
          dueAmount: calculateInvoiceDueFromParts({ ...invoice, fineAmount: newFineAmount }),
          status: invoice.status === 'ISSUED' || invoice.status === 'OVERDUE' ? invoice.status : 'PARTIALLY_PAID',
        },
      });
    }
    if (ledgerStudentId) {
      await createLedgerEntry(tx, {
        schoolId: scope.schoolId,
        academicSessionId: scope.academicSessionId,
        studentId: ledgerStudentId,
        invoiceId: invoice?.id ?? null,
        fineId: fine.id,
        type: 'FINE_DEBIT',
        description: `${fine.name} fine applied`,
        debitAmount: fineAmount,
        createdById: scope.userId,
      });
    }
    return fine;
  }).catch((error) => {
    if (isUniqueConstraintError(error)) throw new HttpError(409, 'Fine already applied to this invoice');
    throw error;
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

const reportQuerySchema = z.object({
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

type FeeReportType = (typeof feeReportTypes)[number];
type FeeReportRow = Record<string, string | number | null>;

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

const buildFeeReport = async (req: Request) => {
  const query = reportQuerySchema.parse(req.query);
  const scope = await resolveScope(req, query);
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

export const getFeeReports = async (req: Request, res: Response) => {
  res.status(200).json(await buildFeeReport(req));
};

export const exportFeeReports = async (req: Request, res: Response) => {
  const format = z.enum(feeReportFormats).default('pdf').parse(req.query.format ?? 'pdf');
  const report = await buildFeeReport(req);
  const rows = report.rows;
  const filename = `fee-${report.type}-report.${format}`;
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Fee Report');
    const columns = Object.keys(rows[0] ?? { message: 'No rows' });
    sheet.columns = columns.map((key) => ({ header: key, key, width: 22 }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.addRow({});
    sheet.addRow(report.summary);
    const buffer = await workbook.xlsx.writeBuffer();
    await logAudit(req, {
      schoolId: report.filters.schoolId,
      entityType: 'FEE_REPORT_EXPORT',
      entityId: report.type,
      action: 'EXPORT_XLSX',
      afterState: { rows: rows.length, filters: report.filters },
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
    return;
  }
  if (format === 'csv') {
    const columns = Object.keys(rows[0] ?? { message: 'No rows' });
    const csv = [
      columns.join(','),
      ...rows.map((row) => columns.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    await logAudit(req, {
      schoolId: report.filters.schoolId,
      entityType: 'FEE_REPORT_EXPORT',
      entityId: report.type,
      action: 'EXPORT_CSV',
      afterState: { rows: rows.length, filters: report.filters },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
    return;
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  doc.fontSize(16).text(`Fee Report: ${report.type}`, { underline: true });
  doc.moveDown();
  Object.entries(report.summary).forEach(([key, value]) => doc.fontSize(10).text(`${key}: ${value}`));
  doc.moveDown();
  rows.slice(0, 80).forEach((row, index) => {
    doc.fontSize(9).text(`${index + 1}. ${Object.entries(row).map(([key, value]) => `${key}: ${value ?? ''}`).join(' | ')}`);
  });
  if (!rows.length) doc.fontSize(10).text('No rows found for selected filters.');
  doc.end();
  await new Promise<void>((resolve) => doc.on('end', resolve));
  await logAudit(req, {
    schoolId: report.filters.schoolId,
    entityType: 'FEE_REPORT_EXPORT',
    entityId: report.type,
    action: 'EXPORT_PDF',
    afterState: { rows: rows.length, filters: report.filters },
  });
  res.send(Buffer.concat(chunks));
};


