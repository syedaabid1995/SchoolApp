import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { FeeLedgerEntryType, Prisma, type FeeDiscount, type Student, type StudentFeeAssignment } from '@prisma/client';
import { z } from 'zod';
import { FeeFineRepository } from '../../repositories/fine.repository';
import { HttpError } from '../../../../middlewares/error.middleware';
import {
  calculateFeeInvoiceAmountsFromPreloaded,
  type FeeCalculationDiscount,
  type FeeInvoiceCalculation,
} from '../../../../services/feeCalculation.service';
import { createLedgerEntry } from '../../../../services/feeLedger.service';
import { getNextNumber } from '../../../../services/numberSequence.service';
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
    const found = await FeeFineRepository.academicYear.findFirst({ where: { id: requested, schoolId }, select: { id: true } });
    if (!found) throw new HttpError(404, 'Academic session not found');
    return requested;
  }

  const active = await FeeFineRepository.academicYear.findFirst({
    where: { schoolId, isActive: true },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });
  if (active) return active.id;

  const latest = await FeeFineRepository.academicYear.findFirst({
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
    FeeFineRepository.feeParticular.count({ where: { schoolId, academicSessionId } }),
    FeeFineRepository.feeType.count({ where: { schoolId, academicSessionId } }),
  ]);

  if (!particularCount) {
    await FeeFineRepository.feeParticular.createMany({
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
    await FeeFineRepository.feeType.createMany({
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
  const found = await FeeFineRepository.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Class not found');
};

const assertSection = async (schoolId: string, sectionId?: string | null) => {
  if (!sectionId) return;
  const found = await FeeFineRepository.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Section not found');
};

const assertStudent = async (schoolId: string, studentId: string, academicSessionId?: string) => {
  const found = await FeeFineRepository.student.findFirst({
    where: { id: studentId, schoolId, ...(academicSessionId ? { academicSessionId } : {}) },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Student not found');
};


const assertFeeType = async (schoolId: string, academicSessionId: string, feeTypeId: string) => {
  const found = await FeeFineRepository.feeType.findFirst({
    where: { id: feeTypeId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee type not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee type cannot be used');
};

const assertFeeGroup = async (schoolId: string, academicSessionId: string, feeGroupId: string) => {
  const found = await FeeFineRepository.feeGroup.findFirst({
    where: { id: feeGroupId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee group not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee group cannot be used');
};

const assertFeeMaster = async (schoolId: string, academicSessionId: string, feeMasterId: string) => {
  const found = await FeeFineRepository.feeMaster.findFirst({
    where: { id: feeMasterId, schoolId, academicSessionId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!found) throw new HttpError(404, 'Fee master not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee master cannot be used');
};

const assertStudentCategory = async (schoolId: string, categoryId: string) => {
  const found = await FeeFineRepository.studentCategory.findFirst({ where: { id: categoryId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student category not found');
};

const assertStudentGroup = async (schoolId: string, groupId: string) => {
  const found = await FeeFineRepository.studentGroup.findFirst({ where: { id: groupId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student group not found');
};

const assertTransportRoute = async (schoolId: string, transportRouteId: string) => {
  const found = await FeeFineRepository.transportRoute.findFirst({ where: { id: transportRouteId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Transport route not found');
};

const assertParticulars = async (schoolId: string, academicSessionId: string, ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids));
  const found = await FeeFineRepository.feeParticular.findMany({
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
  const duplicate = await FeeFineRepository.feeDiscount.findFirst({
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
  const paidCount = await FeeFineRepository.feeInvoice.count({ where: buildDiscountInvoiceWhere(scope, discount) });
  if (paidCount > 0) {
    throw new HttpError(409, 'Discount is already applied to a paid or partially paid invoice. Use reversal or adjustment flow.');
  }
};

const assertDiscountDoesNotExceedCurrentPayable = async (scope: FeeTenantScope, payload: NormalizedDiscountPayload) => {
  if (!payload.studentId || payload.valueType !== 'FIXED') return;
  const payable = toDecimal(
    (
      await FeeFineRepository.feeInvoice.aggregate({
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
    const found = await FeeFineRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: ids } }), select: { id: true } });
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
    return FeeFineRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: studentIds } }), include, orderBy: { fullName: 'asc' } });
  }
  if (targetType === 'TRANSPORT_ROUTE') {
    const rows = await FeeFineRepository.studentTransportAssignment.findMany({
      where: { schoolId: scope.schoolId, routeId: payload.transportRouteId ?? '', active: true },
      select: { studentId: true },
    });
    return FeeFineRepository.student.findMany({ where: activeStudentWhere(scope, { id: { in: rows.map((row) => row.studentId) } }), include, orderBy: { fullName: 'asc' } });
  }
  return FeeFineRepository.student.findMany({
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
  const [items, total] = await FeeFineRepository.$transaction([
    FeeFineRepository.feeFine.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip, take: limit }),
    FeeFineRepository.feeFine.count({ where }),
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
  const existing = await FeeFineRepository.feeFine.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fine rule not found');
  const item = await FeeFineRepository.feeFine.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
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
    ? await FeeFineRepository.feeInvoice.findFirst({ where: { id: payload.invoiceId, ...tenantScope, deletedAt: null } })
    : null;
  if (payload.invoiceId && !invoice) throw new HttpError(404, 'Invoice not found');
  if (invoice?.status === 'CANCELLED') throw new HttpError(409, 'Cannot apply fine to cancelled invoice');
  if (invoice?.status === 'PAID') throw new HttpError(409, 'Cannot apply fine to paid invoice');
  const ledgerStudentId = payload.studentId ?? invoice?.studentId ?? null;
  const item = await FeeFineRepository.$transaction(async (tx) => {
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
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

export const FeeFineService = {
  createFeeFine,
  deleteFeeFine,
  listFeeFines,
};
