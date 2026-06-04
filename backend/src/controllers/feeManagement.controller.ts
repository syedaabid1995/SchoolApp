import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();
const decimalInput = z.coerce.number().min(0).max(100000000);
const dateInput = z.coerce.date().optional().nullable();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

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

const assertStudent = async (schoolId: string, studentId: string) => {
  const found = await prisma.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Student not found');
};

const assertFeeType = async (schoolId: string, academicSessionId: string, feeTypeId: string) => {
  const found = await prisma.feeType.findFirst({ where: { id: feeTypeId, schoolId, academicSessionId, deletedAt: null } });
  if (!found) throw new HttpError(404, 'Fee type not found');
};

const assertParticulars = async (schoolId: string, academicSessionId: string, ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids));
  const found = await prisma.feeParticular.findMany({
    where: { id: { in: uniqueIds }, schoolId, academicSessionId, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== uniqueIds.length) throw new HttpError(404, 'One or more fee particulars were not found');
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

const includeInvoice = {
  student: { select: { id: true, admissionNo: true, fullName: true, phone: true, parentEmail: true, parentPhone: true } },
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  feeType: { select: { id: true, name: true, schedule: true } },
  items: { orderBy: { sortOrder: 'asc' } },
  payments: { orderBy: { paidAt: 'desc' } },
  receipts: { orderBy: { receiptDate: 'desc' } },
} satisfies Prisma.FeeInvoiceInclude;

const nextBalance = async (
  tx: Prisma.TransactionClient,
  schoolId: string,
  academicSessionId: string,
  studentId: string,
  debit: Prisma.Decimal,
  credit: Prisma.Decimal,
) => {
  const latest = await tx.feeLedger.findFirst({
    where: { schoolId, academicSessionId, studentId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });
  return toDecimal(latest?.balance ?? 0).plus(debit).minus(credit);
};

const createLedger = async (
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    academicSessionId: string;
    studentId: string;
    invoiceId?: string | null;
    paymentId?: string | null;
    discountId?: string | null;
    fineId?: string | null;
    entryType: 'INVOICE' | 'PAYMENT' | 'DISCOUNT' | 'FINE' | 'REFUND' | 'ADJUSTMENT';
    description: string;
    debit?: Prisma.Decimal;
    credit?: Prisma.Decimal;
  },
) => {
  const debit = input.debit ?? toDecimal(0);
  const credit = input.credit ?? toDecimal(0);
  const balance = await nextBalance(tx, input.schoolId, input.academicSessionId, input.studentId, debit, credit);
  return tx.feeLedger.create({
    data: {
      schoolId: input.schoolId,
      academicSessionId: input.academicSessionId,
      studentId: input.studentId,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      discountId: input.discountId ?? null,
      fineId: input.fineId ?? null,
      entryType: input.entryType,
      description: input.description,
      debit,
      credit,
      balance,
    },
  });
};

export const getFeeMetadata = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);

  const [academicSessions, classes, sections, students, particulars, feeTypes, structures, transportRoutes] = await Promise.all([
    prisma.academicYear.findMany({ where: { schoolId: scope.schoolId }, orderBy: { startDate: 'desc' }, select: { id: true, name: true, isActive: true } }),
    prisma.class.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.section.findMany({ where: { schoolId: scope.schoolId }, orderBy: { name: 'asc' }, select: { id: true, name: true, classId: true } }),
    prisma.student.findMany({
      where: { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId, status: { not: 'DISABLED' } },
      orderBy: { fullName: 'asc' },
      take: 300,
      select: { id: true, admissionNo: true, fullName: true, classId: true, sectionId: true },
    }),
    prisma.feeParticular.findMany({ where: { ...scope, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.feeType.findMany({ where: { ...scope, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.feeStructure.findMany({ where: { ...scope, deletedAt: null }, include: includeStructure, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.transportRoute.findMany({ where: { schoolId: scope.schoolId }, orderBy: { title: 'asc' }, select: { id: true, title: true, fare: true } }),
  ]);

  res.status(200).json({ ...scope, academicSessions, classes, sections, students, particulars, feeTypes, structures, transportRoutes });
};

const particularSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  name: z.string().min(1).max(160),
  code: z.string().max(80).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(['CHARGE', 'DISCOUNT', 'FINE', 'PREVIOUS_BALANCE', 'TRANSPORT', 'HOSTEL']).default('CHARGE'),
  isMandatory: z.boolean().optional(),
  isSystemGenerated: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const listFeeParticulars = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where: Prisma.FeeParticularWhereInput = {
    ...scope,
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
  try {
    const item = await prisma.feeParticular.create({
      data: {
        ...scope,
        name: normalizeText(payload.name),
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
    handleUniqueError(err, 'Fee particular code already exists for this session');
  }
};

export const updateFeeParticular = async (req: Request, res: Response) => {
  const payload = particularSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeParticular.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee particular not found');
  try {
    const item = await prisma.feeParticular.update({
      where: { id: existing.id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
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
    handleUniqueError(err, 'Fee particular code already exists for this session');
  }
};

export const deleteFeeParticular = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeParticular.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee particular not found');
  const item = await prisma.feeParticular.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PARTICULAR', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

const feeTypeSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  name: z.string().min(1).max(120),
  code: z.string().max(80).optional().nullable(),
  schedule: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'ONE_TIME']),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const listFeeTypes = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await ensureFeeDefaults(scope.schoolId, scope.academicSessionId);
  const items = await prisma.feeType.findMany({ where: { ...scope, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  res.status(200).json(items);
};

export const createFeeType = async (req: Request, res: Response) => {
  const payload = feeTypeSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  try {
    const item = await prisma.feeType.create({
      data: {
        ...scope,
        name: normalizeText(payload.name),
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
    handleUniqueError(err, 'Fee type code already exists for this session');
  }
};

export const updateFeeType = async (req: Request, res: Response) => {
  const payload = feeTypeSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeType.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee type not found');
  try {
    const item = await prisma.feeType.update({
      where: { id: existing.id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
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
    handleUniqueError(err, 'Fee type code already exists for this session');
  }
};

export const deleteFeeType = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeType.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee type not found');
  const usage = await prisma.feeStructure.count({ where: { feeTypeId: existing.id, deletedAt: null } });
  if (usage) throw new HttpError(409, 'Cannot delete fee type while structures use it');
  const item = await prisma.feeType.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_TYPE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

const structureItemSchema = z.object({
  particularId: uuidSchema,
  amount: decimalInput,
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
  const where: Prisma.FeeStructureWhereInput = { ...scope, deletedAt: null, ...(classId ? { classId } : {}) };
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
        ...scope,
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
  const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null }, include: includeStructure });
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
  const existing = await prisma.feeStructure.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null }, include: { _count: { select: { assignments: true, invoices: true } } } });
  if (!existing) throw new HttpError(404, 'Fee structure not found');
  if (existing._count.assignments + existing._count.invoices > 0) throw new HttpError(409, 'Cannot delete fee structure while students or invoices use it');
  const item = await prisma.feeStructure.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_STRUCTURE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

export const duplicateFeeStructure = async (req: Request, res: Response) => {
  const payload = z.object({ schoolId: uuidSchema.optional(), academicSessionId: uuidSchema.optional(), classId: uuidSchema, sectionId: uuidSchema.optional().nullable(), feeTypeId: uuidSchema.optional() }).parse(req.body);
  const scope = await resolveScope(req, payload);
  const source = await prisma.feeStructure.findFirst({ where: { id: req.params.id, ...scope, deletedAt: null }, include: includeStructure });
  if (!source) throw new HttpError(404, 'Fee structure not found');
  const created = await createFeeStructure(
    {
      ...req,
      body: {
        ...scope,
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

const assignmentSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  feeStructureId: uuidSchema,
  studentIds: z.array(uuidSchema).optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional().nullable(),
  autoAssigned: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const listFeeAssignments = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const items = await prisma.studentFeeAssignment.findMany({
    where: { ...scope, deletedAt: null },
    include: {
      student: { select: { id: true, admissionNo: true, fullName: true, class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } } },
      feeStructure: { include: includeStructure },
    },
    orderBy: { assignedAt: 'desc' },
    take: 200,
  });
  res.status(200).json(items);
};

export const assignStudentFees = async (req: Request, res: Response) => {
  const payload = assignmentSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const structure = await prisma.feeStructure.findFirst({ where: { id: payload.feeStructureId, ...scope, deletedAt: null } });
  if (!structure) throw new HttpError(404, 'Fee structure not found');

  const students = payload.studentIds?.length
    ? await prisma.student.findMany({ where: { id: { in: payload.studentIds }, schoolId: scope.schoolId, academicSessionId: scope.academicSessionId }, select: { id: true } })
    : await prisma.student.findMany({ where: { schoolId: scope.schoolId, academicSessionId: scope.academicSessionId, ...(payload.classId ? { classId: payload.classId } : {}), ...(payload.sectionId ? { sectionId: payload.sectionId } : {}) }, select: { id: true } });

  if (!students.length) throw new HttpError(404, 'No matching students found');
  const ids = students.map((student) => student.id);
  const created = await prisma.studentFeeAssignment.createMany({
    skipDuplicates: true,
    data: ids.map((studentId) => ({
      ...scope,
      studentId,
      feeStructureId: payload.feeStructureId,
      autoAssigned: payload.autoAssigned ?? false,
      notes: nullableText(payload.notes),
      status: 'ACTIVE',
    })),
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'STUDENT_FEE_ASSIGNMENT', entityId: payload.feeStructureId, action: 'CREATE', afterState: { assigned: created.count, studentIds: ids } });
  res.status(201).json({ assigned: created.count, requested: ids.length });
};

const invoiceGenerationSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  target: z.enum(['STUDENT', 'CLASS', 'SECTION', 'SCHOOL']).default('STUDENT'),
  studentId: uuidSchema.optional(),
  classId: uuidSchema.optional(),
  sectionId: uuidSchema.optional(),
  feeStructureId: uuidSchema.optional(),
  feeTypeId: uuidSchema.optional(),
  feeMonth: z.string().max(30).optional().nullable(),
  dueDate: dateInput,
  emailInvoice: z.boolean().optional(),
});

const nextInvoiceNumber = async (tx: Prisma.TransactionClient, schoolId: string) => {
  const count = await tx.feeInvoice.count({ where: { schoolId } });
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
};

const nextPaymentNumber = async (tx: Prisma.TransactionClient, schoolId: string) => {
  const count = await tx.feePayment.count({ where: { schoolId } });
  return `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
};

const nextReceiptNumber = async (tx: Prisma.TransactionClient, schoolId: string) => {
  const count = await tx.feeReceipt.count({ where: { schoolId } });
  return `RCT-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
};

const findInvoiceStudents = async (scope: { schoolId: string; academicSessionId: string }, payload: z.infer<typeof invoiceGenerationSchema>) => {
  if (payload.target === 'STUDENT') {
    if (!payload.studentId) throw new HttpError(400, 'studentId is required');
    await assertStudent(scope.schoolId, payload.studentId);
    return prisma.student.findMany({ where: { id: payload.studentId, schoolId: scope.schoolId, academicSessionId: scope.academicSessionId } });
  }
  return prisma.student.findMany({
    where: {
      schoolId: scope.schoolId,
      academicSessionId: scope.academicSessionId,
      ...(payload.target === 'CLASS' && payload.classId ? { classId: payload.classId } : {}),
      ...(payload.target === 'SECTION' && payload.sectionId ? { sectionId: payload.sectionId } : {}),
    },
  });
};

export const generateFeeInvoices = async (req: Request, res: Response) => {
  const payload = invoiceGenerationSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const students = await findInvoiceStudents(scope, payload);
  if (!students.length) throw new HttpError(404, 'No students found for invoice generation');

  const generated = [];
  const skipped: Array<{ studentId: string; reason: string }> = [];

  for (const student of students) {
    const assignment = await prisma.studentFeeAssignment.findFirst({
      where: {
        ...scope,
        studentId: student.id,
        status: 'ACTIVE',
        deletedAt: null,
        feeStructure: {
          deletedAt: null,
          status: 'ACTIVE',
          ...(payload.feeStructureId ? { id: payload.feeStructureId } : {}),
          ...(payload.feeTypeId ? { feeTypeId: payload.feeTypeId } : {}),
        },
      },
      include: { feeStructure: { include: includeStructure } },
      orderBy: { assignedAt: 'desc' },
    });
    const structure = assignment?.feeStructure ?? (payload.feeStructureId ? await prisma.feeStructure.findFirst({ where: { id: payload.feeStructureId, ...scope, deletedAt: null }, include: includeStructure }) : null);
    if (!structure) {
      skipped.push({ studentId: student.id, reason: 'No active fee assignment or structure' });
      continue;
    }

    const itemTotal = structure.items.reduce((sum, item) => sum.plus(item.amount), toDecimal(0));
    const previousBalance = toDecimal(
      (
        await prisma.feeInvoice.aggregate({
          where: { ...scope, studentId: student.id, deletedAt: null, status: { not: 'CANCELLED' } },
          _sum: { dueAmount: true },
        })
      )._sum.dueAmount ?? 0,
    );
    const approvedDiscounts = await prisma.feeDiscount.findMany({
      where: {
        ...scope,
        deletedAt: null,
        approvalStatus: { in: ['APPROVED', 'ACTIVE'] },
        OR: [{ studentId: student.id }, { classId: student.classId ?? undefined }, { sectionId: student.sectionId ?? undefined }],
      },
    });
    const discountAmount = approvedDiscounts.reduce((sum, discount) => {
      const value = toDecimal(discount.amount ?? discount.value);
      if (discount.valueType === 'PERCENTAGE') return sum.plus(itemTotal.mul(value).div(100));
      return sum.plus(value);
    }, toDecimal(0));
    const fineAmount = toDecimal(0);
    const totalAmount = Prisma.Decimal.max(itemTotal.plus(previousBalance).plus(fineAmount).minus(discountAmount), 0);

    const invoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await nextInvoiceNumber(tx, scope.schoolId);
      const created = await tx.feeInvoice.create({
        data: {
          ...scope,
          studentId: student.id,
          classId: student.classId,
          sectionId: student.sectionId,
          feeStructureId: structure.id,
          feeTypeId: structure.feeTypeId,
          invoiceNumber,
          feeMonth: nullableText(payload.feeMonth),
          dueDate: payload.dueDate ?? null,
          previousBalance,
          discountAmount,
          fineAmount,
          totalAmount,
          paidAmount: toDecimal(0),
          dueAmount: totalAmount,
          status: 'ISSUED',
          createdById: scope.userId,
          items: {
            create: structure.items.map((item) => ({
              particularId: item.particularId,
              name: item.particular.name,
              amount: item.amount,
              discountAmount: toDecimal(0),
              fineAmount: toDecimal(0),
              netAmount: item.amount,
              sortOrder: item.sortOrder,
            })),
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
      await createLedger(tx, {
        ...scope,
        studentId: student.id,
        invoiceId: created.id,
        entryType: 'INVOICE',
        description: `Invoice ${created.invoiceNumber}`,
        debit: totalAmount,
      });
      return created;
    });

    await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_INVOICE', entityId: invoice.id, action: 'CREATE', afterState: invoice });
    generated.push(invoice);
  }

  res.status(201).json({ generated, skipped });
};

export const listFeeInvoices = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where: Prisma.FeeInvoiceWhereInput = {
    ...scope,
    deletedAt: null,
    ...(studentId ? { studentId } : {}),
    ...(status ? { status: status as any } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.feeInvoice.findMany({ where, include: includeInvoice, orderBy: { issueDate: 'desc' }, skip, take: limit }),
    prisma.feeInvoice.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

const paymentSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  invoiceId: uuidSchema,
  amount: decimalInput,
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE_GATEWAY']),
  transactionReference: z.string().max(160).optional().nullable(),
  gateway: z.string().max(80).optional().nullable(),
  gatewayPaymentId: z.string().max(160).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export const collectFeePayment = async (req: Request, res: Response) => {
  const payload = paymentSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const invoice = await prisma.feeInvoice.findFirst({ where: { id: payload.invoiceId, ...scope, deletedAt: null } });
  if (!invoice) throw new HttpError(404, 'Invoice not found');
  if (invoice.status === 'CANCELLED') throw new HttpError(409, 'Cannot collect payment for cancelled invoice');
  const amount = toDecimal(payload.amount);
  if (amount.lte(0)) throw new HttpError(400, 'Payment amount must be greater than zero');
  if (amount.gt(invoice.dueAmount)) throw new HttpError(400, 'Cannot collect more than due amount');

  const result = await prisma.$transaction(async (tx) => {
    const paymentNumber = await nextPaymentNumber(tx, scope.schoolId);
    const receiptNumber = await nextReceiptNumber(tx, scope.schoolId);
    const paidAmount = toDecimal(invoice.paidAmount).plus(amount);
    const dueAmount = Prisma.Decimal.max(toDecimal(invoice.dueAmount).minus(amount), 0);
    const status = dueAmount.eq(0) ? 'PAID' : 'PARTIALLY_PAID';
    const payment = await tx.feePayment.create({
      data: {
        ...scope,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        paymentNumber,
        paymentMode: payload.paymentMode,
        amount,
        transactionReference: nullableText(payload.transactionReference),
        gateway: nullableText(payload.gateway),
        gatewayPaymentId: nullableText(payload.gatewayPaymentId),
        status: 'SUCCESS',
        note: nullableText(payload.note),
        collectedById: scope.userId,
      },
    });
    const receipt = await tx.feeReceipt.create({
      data: {
        ...scope,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        receiptNumber,
        amount,
      },
    });
    const updatedInvoice = await tx.feeInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount, dueAmount, status },
      include: includeInvoice,
    });
    await createLedger(tx, {
      ...scope,
      studentId: invoice.studentId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      entryType: 'PAYMENT',
      description: `Payment ${payment.paymentNumber}`,
      credit: amount,
    });
    await tx.feeNotification.create({
      data: {
        ...scope,
        studentId: invoice.studentId,
        invoiceId: invoice.id,
        type: 'PAYMENT_SUCCESS',
        channel: 'IN_APP',
        recipient: invoice.studentId,
        message: `Payment ${payment.paymentNumber} received.`,
        status: 'QUEUED',
      },
    });
    return { payment, receipt, invoice: updatedInvoice };
  });

  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_PAYMENT', entityId: result.payment.id, action: 'CREATE', afterState: result });
  res.status(201).json(result);
};

export const listFeePayments = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const items = await prisma.feePayment.findMany({
    where: { ...scope },
    include: { invoice: { select: { invoiceNumber: true } }, student: { select: { fullName: true, admissionNo: true } }, receipt: true },
    orderBy: { paidAt: 'desc' },
    take: 200,
  });
  res.status(200).json(items);
};

export const getStudentFeeLedger = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  await assertStudent(scope.schoolId, req.params.studentId);
  const items = await prisma.feeLedger.findMany({
    where: { ...scope, studentId: req.params.studentId },
    orderBy: { createdAt: 'asc' },
    include: { invoice: { select: { invoiceNumber: true } }, payment: { select: { paymentNumber: true } } },
  });
  res.status(200).json(items);
};

const discountSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  studentId: uuidSchema.optional().nullable(),
  classId: uuidSchema.optional().nullable(),
  sectionId: uuidSchema.optional().nullable(),
  particularId: uuidSchema.optional().nullable(),
  discountType: z.enum(['SCHOLARSHIP', 'SIBLING_DISCOUNT', 'STAFF_CHILD_DISCOUNT', 'SPECIAL_DISCOUNT']),
  valueType: z.enum(['PERCENTAGE', 'FIXED']),
  value: decimalInput,
  amount: decimalInput.optional().nullable(),
  validFrom: dateInput,
  validTo: dateInput,
  approvalStatus: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE']).optional(),
  note: z.string().max(1000).optional().nullable(),
});

export const listFeeDiscounts = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const items = await prisma.feeDiscount.findMany({
    where: { ...scope, deletedAt: null },
    include: { student: { select: { id: true, fullName: true, admissionNo: true } }, class: { select: { name: true } }, section: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json(items);
};

export const createFeeDiscount = async (req: Request, res: Response) => {
  const payload = discountSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  if (payload.studentId) await assertStudent(scope.schoolId, payload.studentId);
  if (payload.classId) await assertClass(scope.schoolId, payload.classId);
  if (payload.sectionId) await assertSection(scope.schoolId, payload.sectionId);
  const item = await prisma.feeDiscount.create({
    data: {
      ...scope,
      studentId: payload.studentId ?? null,
      classId: payload.classId ?? null,
      sectionId: payload.sectionId ?? null,
      particularId: payload.particularId ?? null,
      discountType: payload.discountType,
      valueType: payload.valueType,
      value: toDecimal(payload.value),
      amount: payload.amount === undefined || payload.amount === null ? null : toDecimal(payload.amount),
      validFrom: payload.validFrom ?? null,
      validTo: payload.validTo ?? null,
      approvalStatus: payload.approvalStatus ?? 'PENDING_APPROVAL',
      note: nullableText(payload.note),
    },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_DISCOUNT', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

const fineSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  particularId: uuidSchema.optional().nullable(),
  name: z.string().min(1).max(160),
  fineType: z.enum(['FIXED', 'DAILY', 'MONTHLY']),
  amount: decimalInput,
  graceDays: z.coerce.number().int().min(0).max(365).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const listFeeFines = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const items = await prisma.feeFine.findMany({ where: { ...scope, deletedAt: null }, orderBy: { createdAt: 'desc' } });
  res.status(200).json(items);
};

export const createFeeFine = async (req: Request, res: Response) => {
  const payload = fineSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const item = await prisma.feeFine.create({
    data: {
      ...scope,
      particularId: payload.particularId ?? null,
      name: normalizeText(payload.name),
      fineType: payload.fineType,
      amount: toDecimal(payload.amount),
      graceDays: payload.graceDays ?? 0,
      status: payload.status ?? 'ACTIVE',
    },
  });
  await logAudit(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

export const getFeeReports = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const from = req.query.from ? z.coerce.date().parse(req.query.from) : undefined;
  const to = req.query.to ? z.coerce.date().parse(req.query.to) : undefined;
  const paidAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  const [payments, invoices, discounts, fines] = await Promise.all([
    prisma.feePayment.findMany({
      where: { ...scope, status: 'SUCCESS', ...(paidAt ? { paidAt } : {}) },
      include: { student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } } } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.feeInvoice.findMany({
      where: { ...scope, deletedAt: null },
      include: { student: { select: { fullName: true, admissionNo: true, class: { select: { name: true } } } } },
    }),
    prisma.feeDiscount.findMany({ where: { ...scope, deletedAt: null } }),
    prisma.feeFine.findMany({ where: { ...scope, deletedAt: null } }),
  ]);
  const totalCollected = payments.reduce((sum, item) => sum + decimalNumber(item.amount), 0);
  const totalInvoiced = invoices.reduce((sum, item) => sum + decimalNumber(item.totalAmount), 0);
  const totalOutstanding = invoices.reduce((sum, item) => sum + decimalNumber(item.dueAmount), 0);
  const dailyCollection = payments.reduce<Record<string, number>>((result, item) => {
    const key = item.paidAt.toISOString().slice(0, 10);
    result[key] = (result[key] ?? 0) + decimalNumber(item.amount);
    return result;
  }, {});
  const classWise = invoices.reduce<Record<string, { invoiced: number; due: number }>>((result, item) => {
    const key = item.student.class?.name ?? 'Unassigned';
    result[key] = result[key] ?? { invoiced: 0, due: 0 };
    result[key].invoiced += decimalNumber(item.totalAmount);
    result[key].due += decimalNumber(item.dueAmount);
    return result;
  }, {});
  res.status(200).json({ totalCollected, totalInvoiced, totalOutstanding, payments, invoices, discounts, fines, dailyCollection, classWise });
};
