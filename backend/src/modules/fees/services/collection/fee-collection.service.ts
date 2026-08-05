import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FeeLedgerEntryType, Prisma, type FeeDiscount, type Student, type StudentFeeAssignment } from '@prisma/client';
import { z } from 'zod';
import { FeeCollectionRepository } from '../../repositories/collection.repository';
import { HttpError } from '../../../../middlewares/error.middleware';
import {
  calculateFeeInvoiceAmountsFromPreloaded,
  type FeeCalculationDiscount,
  type FeeInvoiceCalculation,
} from '../../../../services/feeCalculation.service';
import { createLedgerEntry } from '../../../../services/feeLedger.service';
import { getNextNumber } from '../../../../services/numberSequence.service';
import { sendNotification } from '../../../../services/notification.service';
import { FeeRepository, type FeeTenantScope as RepositoryFeeTenantScope } from '../../repositories/fee.repository';
import { FeeAuditService } from '../fee-audit.service';
import {
  buildFeeReport as buildFeeReportData,
  feeReportFormats,
  parseFeeReportQuery,
} from '../fee-report.service';

const uuidSchema = z.string().uuid();
const uuidParam = (req: Request, name = 'id') => uuidSchema.parse(req.params[name]);
const decimalInput = z.coerce.number().min(0).max(100000000);
const positiveDecimalInput = z.coerce.number().positive('Amount must be greater than 0').max(100000000);
const dateInput = z.coerce.date().optional().nullable();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const feeInvoiceStatuses = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'] as const;
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
const formatMoney = (value: Prisma.Decimal | number | string | null | undefined) => {
  const amount = decimalNumber(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};
const displayStudentName = (student: { fullName?: string | null; firstName: string; lastName: string }) =>
  student.fullName?.trim() || `${student.firstName} ${student.lastName}`.trim() || 'Student';
const displayParentName = (parent: { firstName: string; lastName: string }) =>
  `${parent.firstName} ${parent.lastName}`.trim() || 'Parent';
const formatNotificationDate = (value: Date | null | undefined) => {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireFeeManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
    if (!req.auth.schoolId) throw new HttpError(403, 'School scope is required');
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'School scope is required to manage fees');
};

const resolveAcademicSessionId = async (schoolId: string, requested?: string | null) => {
  if (requested) {
    const found = await FeeCollectionRepository.academicYear.findFirst({ where: { id: requested, schoolId }, select: { id: true } });
    if (!found) throw new HttpError(404, 'Academic session not found');
    return requested;
  }

  const active = await FeeCollectionRepository.academicYear.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (active) return active.id;

  const latest = await FeeCollectionRepository.academicYear.findFirst({
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
const paymentStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REVERSED', 'REVERSED'] as const;
const paymentSortFields = ['paidAt', 'paymentDate', 'createdAt', 'amount'] as const;
const discountSortFields = ['createdAt', 'validFrom', 'validTo', 'discountName'] as const;
const fineSortFields = ['createdAt', 'name', 'amount'] as const;
const assignmentTargetTypes = ['CLASS', 'SECTION', 'STUDENT', 'GROUP', 'CATEGORY', 'TRANSPORT_ROUTE'] as const;
const assignableStudentStatus = 'ENROLLED' as const;

const legacyDiscountTypes = ['SCHOLARSHIP', 'SIBLING_DISCOUNT', 'STAFF_CHILD_DISCOUNT', 'SPECIAL_DISCOUNT'] as const;
const discountValueTypes = ['PERCENTAGE', 'FIXED'] as const;
const discountApprovalStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE'] as const;
const discountTargetTypes = ['STUDENT', 'CLASS', 'SECTION', 'CATEGORY', 'FEE_TYPE', 'FEE_GROUP', 'FEE_MASTER', 'ALL'] as const;
const approvedDiscountStatuses = ['APPROVED', 'ACTIVE'] as const;

type LegacyDiscountType = (typeof legacyDiscountTypes)[number];
type FeeDiscountValueType = (typeof discountValueTypes)[number];
type FeeDiscountStatus = (typeof discountApprovalStatuses)[number];
type FeeDiscountTarget = (typeof discountTargetTypes)[number];
type FeePaymentModeValue = (typeof paymentModes)[number];
type FeePaymentStatusValue = (typeof paymentStatuses)[number];
type FeeAssignmentTarget = (typeof assignmentTargetTypes)[number];
type FeeTenantScope = RepositoryFeeTenantScope;
const tenantScopeOnly = FeeRepository.tenantScope;

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
  feeGroupId: string | null;
  feeMasterId: string | null;
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
    FeeCollectionRepository.feeParticular.count({ where: { schoolId, academicSessionId } }),
    FeeCollectionRepository.feeType.count({ where: { schoolId, academicSessionId } }),
  ]);

  if (!particularCount) {
    await FeeCollectionRepository.feeParticular.createMany({
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
    await FeeCollectionRepository.feeType.createMany({
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
  const found = await FeeCollectionRepository.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Class not found');
};

const assertSection = async (schoolId: string, sectionId?: string | null) => {
  if (!sectionId) return;
  const found = await FeeCollectionRepository.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Section not found');
};

const assertStudent = async (schoolId: string, studentId: string, academicSessionId?: string) => {
  const found = await FeeCollectionRepository.student.findFirst({
    where: { id: studentId, schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Student not found');
};


const assertFeeType = async (schoolId: string, academicSessionId: string, feeTypeId: string) => {
  const found = await FeeCollectionRepository.feeType.findFirst({
    where: { id: feeTypeId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee type not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee type cannot be used');
};

const assertFeeGroup = async (schoolId: string, academicSessionId: string, feeGroupId: string) => {
  const found = await FeeCollectionRepository.feeGroup.findFirst({
    where: { id: feeGroupId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee group not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee group cannot be used');
};

const assertFeeMaster = async (schoolId: string, academicSessionId: string, feeMasterId: string) => {
  const found = await FeeCollectionRepository.feeMaster.findFirst({
    where: { id: feeMasterId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee master not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee master cannot be used');
};

const assertStudentCategory = async (schoolId: string, categoryId: string) => {
  const found = await FeeCollectionRepository.studentCategory.findFirst({ where: { id: categoryId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student category not found');
};

const assertStudentGroup = async (schoolId: string, groupId: string) => {
  const found = await FeeCollectionRepository.studentGroup.findFirst({ where: { id: groupId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student group not found');
};

const assertTransportRoute = async (schoolId: string, transportRouteId: string) => {
  const found = await FeeCollectionRepository.transportRoute.findFirst({ where: { id: transportRouteId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Transport route not found');
};

const assertParticulars = async (schoolId: string, academicSessionId: string, ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids));
  const found = await FeeCollectionRepository.feeParticular.findMany({
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
  feeGroupId: uuidSchema.optional().nullable(),
  feeMasterId: uuidSchema.optional().nullable(),
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
            : payload.feeMasterId
              ? 'FEE_MASTER'
              : payload.feeGroupId
                ? 'FEE_GROUP'
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
    feeGroupId: payload.feeGroupId ?? null,
    feeMasterId: payload.feeMasterId ?? null,
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
    if (payload.classId || payload.sectionId || payload.categoryId || payload.feeGroupId || payload.feeMasterId) throw new HttpError(400, 'STUDENT discount cannot include class, section, category, fee group, or fee master target');
  }
  if (payload.targetType === 'CLASS') {
    if (!payload.classId) throw new HttpError(400, 'classId is required for CLASS discount');
    if (payload.studentId || payload.sectionId || payload.categoryId || payload.feeGroupId || payload.feeMasterId) throw new HttpError(400, 'CLASS discount cannot include student, section, category, fee group, or fee master target');
  }
  if (payload.targetType === 'SECTION') {
    if (!payload.sectionId) throw new HttpError(400, 'sectionId is required for SECTION discount');
    if (payload.studentId || payload.categoryId || payload.feeGroupId || payload.feeMasterId) throw new HttpError(400, 'SECTION discount cannot include student, category, fee group, or fee master target');
  }
  if (payload.targetType === 'CATEGORY') {
    if (!payload.categoryId) throw new HttpError(400, 'categoryId is required for CATEGORY discount');
    if (payload.studentId || payload.classId || payload.sectionId || payload.feeGroupId || payload.feeMasterId) throw new HttpError(400, 'CATEGORY discount cannot include student, class, section, fee group, or fee master target');
  }
  if (payload.targetType === 'FEE_TYPE') {
    if (!payload.feeTypeId) throw new HttpError(400, 'feeTypeId is required for FEE_TYPE discount');
    if (payload.studentId || payload.classId || payload.sectionId || payload.categoryId || payload.feeGroupId || payload.feeMasterId) throw new HttpError(400, 'FEE_TYPE discount cannot include student, class, section, category, fee group, or fee master target');
  }
  if (payload.targetType === 'FEE_GROUP') {
    if (!payload.feeGroupId) throw new HttpError(400, 'feeGroupId is required for FEE_GROUP discount');
    if (payload.studentId || payload.classId || payload.sectionId || payload.categoryId || payload.feeTypeId || payload.feeMasterId) throw new HttpError(400, 'FEE_GROUP discount cannot include another target field');
  }
  if (payload.targetType === 'FEE_MASTER') {
    if (!payload.feeMasterId) throw new HttpError(400, 'feeMasterId is required for FEE_MASTER discount');
    if (payload.studentId || payload.classId || payload.sectionId || payload.categoryId || payload.feeTypeId || payload.feeGroupId) throw new HttpError(400, 'FEE_MASTER discount cannot include another target field');
  }
  if (payload.targetType === 'ALL' && (payload.studentId || payload.classId || payload.sectionId || payload.categoryId || payload.feeTypeId || payload.feeGroupId || payload.feeMasterId)) {
    throw new HttpError(400, 'ALL discount cannot include a specific target field');
  }
}

const assertDiscountReferences = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload) => {
  if (payload.studentId) await assertStudent(scope.schoolId, payload.studentId, scope.academicSessionId);
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId) await assertSection(scope.schoolId, payload.sectionId);
  if (payload.categoryId) await assertStudentCategory(scope.schoolId, payload.categoryId);
  if (payload.feeTypeId) await assertFeeType(scope.schoolId, scope.academicSessionId, payload.feeTypeId);
  if (payload.feeGroupId) await assertFeeGroup(scope.schoolId, scope.academicSessionId, payload.feeGroupId);
  if (payload.feeMasterId) await assertFeeMaster(scope.schoolId, scope.academicSessionId, payload.feeMasterId);
  if (payload.particularId) await assertParticulars(scope.schoolId, scope.academicSessionId, [payload.particularId]);
};

const requireDiscountApprover = (req: Request) => {
  if (!req.auth?.schoolId && req.auth?.role !== 'SUPER_ADMIN') throw new HttpError(403, 'School scope is required to approve or reject discounts');
};

const assertDiscountApprovalAllowed = (req: Request, status: FeeDiscountStatus) => {
  if (['APPROVED', 'ACTIVE', 'REJECTED'].includes(status)) requireDiscountApprover(req);
};

const assertNoDuplicateActiveDiscount = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload, excludeId?: string) => {
  if (!approvedDiscountStatuses.includes(payload.approvalStatus as (typeof approvedDiscountStatuses)[number])) return;
  const and: Prisma.FeeDiscountWhereInput[] = [];
  if (payload.validTo) and.push({ OR: [{ validFrom: null }, { validFrom: { lte: payload.validTo } }] });
  if (payload.validFrom) and.push({ OR: [{ validTo: null }, { validTo: { gte: payload.validFrom } }] });
  const duplicate = await FeeCollectionRepository.feeDiscount.findFirst({
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
      feeGroupId: payload.feeGroupId,
      feeMasterId: payload.feeMasterId,
      ...(and.length ? { AND: and } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Duplicate active discount exists for the same target, fee type, and date range');
};

const buildDiscountInvoiceWhere = (scope: FeeTenantScope, discount: Pick<NormalizedDiscountPayload, 'targetType' | 'studentId' | 'classId' | 'sectionId' | 'categoryId' | 'feeTypeId' | 'feeGroupId' | 'feeMasterId'>): Prisma.FeeInvoiceWhereInput => ({
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
  const paidCount = await FeeCollectionRepository.feeInvoice.count({ where: buildDiscountInvoiceWhere(scope, discount) });
  if (paidCount > 0) {
    throw new HttpError(409, 'Discount is already applied to a paid or partially paid invoice. Use reversal or adjustment flow.');
  }
};

const assertDiscountDoesNotExceedCurrentPayable = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload) => {
  if (!payload.studentId || payload.valueType !== 'FIXED') return;
  const payable = toDecimal(
    (
      await FeeCollectionRepository.feeInvoice.aggregate({
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
  discount: Pick<FeeDiscount, 'targetType' | 'studentId' | 'classId' | 'sectionId' | 'categoryId' | 'feeTypeId' | 'feeGroupId' | 'feeMasterId'>,
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
    const found = await FeeCollectionRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: ids } }), select: { id: true } });
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
    return FeeCollectionRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: studentIds } }), include, orderBy: { fullName: 'asc' } });
  }
  if (targetType === 'TRANSPORT_ROUTE') {
    const rows = await FeeCollectionRepository.studentTransportAssignment.findMany({
      where: { schoolId: scope.schoolId, routeId: payload.transportRouteId ?? '', active: true },
      select: { studentId: true },
    });
    return FeeCollectionRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: rows.map((row) => row.studentId) } }), include, orderBy: { fullName: 'asc' } });
  }
  return FeeCollectionRepository.student.findMany({
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
  reversals: { orderBy: { reversedAt: 'desc' } },
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

const lockFeePayment = async (tx: Prisma.TransactionClient, scope: PaymentScope, paymentId: string) => {
  const query = Prisma.sql`
    SELECT id
    FROM fee_payments
    WHERE id = ${paymentId}::uuid
      AND school_id = ${scope.schoolId}::uuid
      AND academic_session_id = ${scope.academicSessionId}::uuid
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
      'SELECT id FROM fee_payments WHERE id = $1::uuid AND school_id = $2::uuid AND academic_session_id = $3::uuid FOR UPDATE',
      paymentId,
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


export const searchFeeCollectionStudents = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const students = await FeeCollectionRepository.student.findMany({
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
    ? await FeeCollectionRepository.feeInvoice.groupBy({
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
  const items = await FeeCollectionRepository.feeInvoice.findMany({
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
    result = await FeeCollectionRepository.$transaction(async (tx) => {
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
      const existing = await findIdempotentPayment(FeeCollectionRepository, scope.schoolId, idempotencyKey);
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
    await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_PAYMENT', entityId: result.payment.id, action: 'CREATE', afterState: result });
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
  const [items, total] = await FeeCollectionRepository.$transaction([
    FeeCollectionRepository.feePayment.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true } },
        student: { select: { fullName: true, admissionNo: true } },
        receipt: true,
        reversals: { orderBy: { reversedAt: 'desc' } },
        allocations: { include: { invoice: { select: { invoiceNumber: true, feeMonth: true, dueAmount: true, status: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    FeeCollectionRepository.feePayment.count({ where }),
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

const reversalSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  reason: z.string().trim().min(1).max(1000),
  amount: decimalInput.optional(),
});

const invoiceStatusAfterReversal = (invoice: Pick<Prisma.FeeInvoiceGetPayload<{}>, 'dueDate'>, paidAmount: Prisma.Decimal, dueAmount: Prisma.Decimal) => {
  if (dueAmount.eq(0)) return 'PAID';
  if (paidAmount.gt(0)) return 'PARTIALLY_PAID';
  return invoice.dueDate < new Date() ? 'OVERDUE' : 'ISSUED';
};

export const reverseFeePayment = async (req: Request, res: Response) => {
  const payload = reversalSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const tenantScope = { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId };
  const paymentId = uuidParam(req);

  const result = await FeeCollectionRepository.$transaction(async (tx) => {
    await lockFeePayment(tx, scope, paymentId);
    const payment = await tx.feePayment.findFirst({
      where: { id: paymentId, ...tenantScope },
      include: {
        receipt: true,
        allocations: { include: { invoice: true }, orderBy: { createdAt: 'asc' } },
        reversals: true,
      },
    });
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIALLY_REVERSED') {
      throw new HttpError(409, 'Only successful payments can be reversed');
    }

    const alreadyReversed = payment.reversals.reduce((sum, item) => sum.plus(item.reversedAmount), toDecimal(0));
    const remainingAmount = toDecimal(payment.amount).minus(alreadyReversed);
    if (remainingAmount.lte(0)) throw new HttpError(409, 'Payment is already fully reversed');

    const requestedAmount = payload.amount === undefined ? remainingAmount : toDecimal(payload.amount);
    if (!requestedAmount.eq(remainingAmount)) {
      throw new HttpError(400, 'Partial payment reversal is not supported yet; reverse the remaining payment amount');
    }

    const reversalNumber = await getNextNumber({
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      type: 'REVERSAL',
      year: new Date().getFullYear(),
    }, tx);

    const reversal = await tx.feePaymentReversal.create({
      data: {
        ...tenantScope,
        paymentId: payment.id,
        studentId: payment.studentId,
        reversalNumber,
        reversedAmount: requestedAmount,
        reason: normalizeText(payload.reason),
        reversedById: scope.userId,
      },
    });

    for (const allocation of payment.allocations) {
      const allocationAmount = toDecimal(allocation.allocatedAmount);
      const paidAmount = Prisma.Decimal.max(toDecimal(allocation.invoice.paidAmount).minus(allocationAmount), 0);
      const dueAmount = calculateInvoiceDueFromParts({
        totalAmount: allocation.invoice.totalAmount,
        discountAmount: allocation.invoice.discountAmount,
        fineAmount: allocation.invoice.fineAmount,
        paidAmount,
      });
      await tx.feeInvoice.update({
        where: { id: allocation.invoiceId },
        data: {
          paidAmount,
          dueAmount,
          status: invoiceStatusAfterReversal(allocation.invoice, paidAmount, dueAmount),
        },
      });
      await createLedgerEntry(tx, {
        ...tenantScope,
        studentId: payment.studentId,
        invoiceId: allocation.invoiceId,
        paymentId: payment.id,
        receiptId: payment.receipt?.id ?? null,
        paymentReversalId: reversal.id,
        type: 'PAYMENT_REVERSAL',
        description: `Reversal ${reversal.reversalNumber} for payment ${payment.paymentNumber}`,
        debitAmount: allocationAmount,
        createdById: scope.userId,
      });
    }

    const updatedPayment = await tx.feePayment.update({
      where: { id: payment.id },
      data: { status: 'REVERSED' },
      include: includePaymentResult,
    });

    return { reversal, payment: updatedPayment };
  });

  await FeeAuditService.record(req, {
    schoolId: scope.schoolId,
    entityType: 'FEE_PAYMENT_REVERSAL',
    entityId: result.reversal.id,
    action: 'CREATE',
    afterState: result,
  });
  res.status(201).json(result);
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
    FeeCollectionRepository.feeLedger.findMany({
      where,
      include: ledgerInclude,
      orderBy: [{ [payload.sortBy]: payload.sortOrder }, { id: payload.sortOrder }],
      skip: options?.export ? 0 : skip,
      take: payload.limit,
    }),
    FeeCollectionRepository.feeLedger.count({ where }),
    payload.studentId && payload.dateFrom
      ? FeeCollectionRepository.feeLedger.findFirst({
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
  await FeeAuditService.record(req, {
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
  await FeeAuditService.record(req, {
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

export const notifyStudentFeePayment = async (req: Request, res: Response) => {
  const studentId = uuidParam(req, 'studentId');
  const body = z.object({
    schoolId: uuidSchema.optional().nullable(),
    academicSessionId: uuidSchema.optional().nullable(),
  }).parse(req.body ?? {});
  const scope = await resolveScope(req, body);

  const student = await FeeCollectionRepository.student.findFirst({
    where: { id: studentId, schoolId: scope.schoolId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      parentEmail: true,
      parentLinks: {
        include: {
          parent: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });
  if (!student) throw new HttpError(404, 'Student not found');

  const invoices = await FeeCollectionRepository.feeInvoice.findMany({
    where: {
      ...tenantScopeOnly(scope),
      studentId,
      deletedAt: null,
      status: { notIn: ['PAID', 'CANCELLED'] },
      dueAmount: { gt: 0 },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      invoiceNumber: true,
      dueDate: true,
      dueAmount: true,
      feeMonth: true,
    },
  });
  if (!invoices.length) throw new HttpError(400, 'No unpaid or pending fee invoice found for this student.');

  const parents = student.parentLinks.map((link) => link.parent);
  const emailRecipients = Array.from(
    new Set([
      ...parents.map((parent) => parent.email || parent.user?.email || ''),
      student.parentEmail || '',
    ]),
  )
    .map((email) => email.trim())
    .filter(Boolean);
  const pushRecipients = Array.from(new Set(parents.map((parent) => parent.userId).filter(Boolean)));
  if (!emailRecipients.length && !pushRecipients.length) {
    throw new HttpError(400, 'No parent email or parent app account is linked to this student.');
  }

  const childName = displayStudentName(student);
  const totalDue = invoices.reduce((sum, invoice) => sum.plus(invoice.dueAmount), new Prisma.Decimal(0));
  const invoiceSummary = invoices
    .map((invoice) => {
      const month = invoice.feeMonth ? ` (${invoice.feeMonth})` : '';
      return `${invoice.invoiceNumber}${month}: ${formatMoney(invoice.dueAmount)}, due ${formatNotificationDate(invoice.dueDate)}`;
    })
    .join('; ');
  const subject = `Fee payment reminder for ${childName}`;
  const bodyText = `Dear Parent, ${childName} has a pending fee balance of ${formatMoney(totalDue)} across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}. ${invoiceSummary}. Please ignore this reminder if payment has already been made.`;
  const html = `
    <p>Dear Parent,</p>
    <p>${childName} has a pending fee balance of <strong>${formatMoney(totalDue)}</strong> across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}.</p>
    <ul>
      ${invoices.map((invoice) => `<li>${invoice.invoiceNumber}${invoice.feeMonth ? ` (${invoice.feeMonth})` : ''}: ${formatMoney(invoice.dueAmount)}, due ${formatNotificationDate(invoice.dueDate)}</li>`).join('')}
    </ul>
    <p>Please ignore this reminder if payment has already been made.</p>
  `;

  let emailSent = 0;
  let pushSent = 0;
  let failed = 0;

  for (const recipient of emailRecipients) {
    try {
      await sendNotification({
        schoolId: scope.schoolId,
        userId: scope.userId,
        channel: 'EMAIL',
        data: {
          to: recipient,
          subject,
          body: bodyText,
          html,
          emailIntent: 'GENERAL_COMMUNICATION',
          module: 'fees',
          category: 'fee_reminder',
          childId: studentId,
          childName,
          dueAmount: formatMoney(totalDue),
          invoiceCount: invoices.length,
          invoiceNumbers: invoices.map((invoice) => invoice.invoiceNumber).join(', '),
        },
      });
      await FeeCollectionRepository.feeNotification.create({
        data: {
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId,
          invoiceId: null,
          type: 'FEE_DUE_REMINDER',
          channel: 'EMAIL',
          recipient,
          subject,
          message: bodyText,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      emailSent += 1;
    } catch {
      failed += 1;
      await FeeCollectionRepository.feeNotification.create({
        data: {
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId,
          invoiceId: null,
          type: 'FEE_DUE_REMINDER',
          channel: 'EMAIL',
          recipient,
          subject,
          message: bodyText,
          status: 'FAILED',
          sentAt: null,
        },
      });
    }
  }

  for (const userId of pushRecipients) {
    const recipient = String(userId);
    const parent = parents.find((item) => item.userId === recipient);
    try {
      await sendNotification({
        schoolId: scope.schoolId,
        userId: scope.userId,
        channel: 'PUSH',
        data: {
          to: recipient,
          subject,
          body: bodyText,
          recipientName: parent ? displayParentName(parent) : 'Parent',
          recipientType: 'PARENT',
          targetMode: 'STUDENT',
          recipientGroups: ['GUARDIANS'],
          route: '/profile',
          module: 'fees',
          category: 'fee_reminder',
          priority: 'high',
          childId: studentId,
          childName,
          dueAmount: formatMoney(totalDue),
          invoiceCount: invoices.length,
          invoiceNumbers: invoices.map((invoice) => invoice.invoiceNumber).join(', '),
        },
      });
      await FeeCollectionRepository.feeNotification.create({
        data: {
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId,
          invoiceId: null,
          type: 'FEE_DUE_REMINDER',
          channel: 'IN_APP',
          recipient,
          subject,
          message: bodyText,
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      pushSent += 1;
    } catch {
      failed += 1;
      await FeeCollectionRepository.feeNotification.create({
        data: {
          schoolId: scope.schoolId,
          academicSessionId: scope.academicSessionId,
          studentId,
          invoiceId: null,
          type: 'FEE_DUE_REMINDER',
          channel: 'IN_APP',
          recipient,
          subject,
          message: bodyText,
          status: 'FAILED',
          sentAt: null,
        },
      });
    }
  }

  await FeeAuditService.record(req, {
    schoolId: scope.schoolId,
    entityType: 'FEE_NOTIFICATION',
    entityId: studentId,
    action: 'SEND_PAYMENT_REMINDER',
    afterState: {
      studentId,
      invoiceCount: invoices.length,
      totalDue: totalDue.toString(),
      emailSent,
      pushSent,
      failed,
    },
  });

  res.status(200).json({
    studentId,
    invoiceCount: invoices.length,
    totalDue: totalDue.toString(),
    emailSent,
    pushSent,
    failed,
  });
};

export const FeeCollectionService = {
  collectFeePayment,
  exportFeeLedgerExcel,
  exportFeeLedgerPdf,
  getStudentFeeLedger,
  listFeePayments,
  listStudentCollectionInvoices,
  notifyStudentFeePayment,
  searchFeeCollectionStudents,
};
