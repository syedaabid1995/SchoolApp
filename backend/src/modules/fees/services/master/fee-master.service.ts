import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../../config/db';
import { HttpError } from '../../../../middlewares/error.middleware';
import { FeeAuditService } from '../fee-audit.service';

const uuidSchema = z.string().uuid();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const decimalInput = z.coerce.number().min(0).max(100000000);
const positiveDecimalInput = z.coerce.number().positive('Amount must be greater than 0').max(100000000);
const dateInput = z.coerce.date().optional().nullable();

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
const uuidParam = (req: Request, name = 'id') => uuidSchema.parse(req.params[name]);

type FeeTenantScope = {
  schoolId: string;
  academicSessionId: string;
  userId: string;
};

const tenantScopeOnly = (scope: FeeTenantScope) => ({
  schoolId: scope.schoolId,
  academicSessionId: scope.academicSessionId,
});

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireFeeManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
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

const resolveScope = async (req: Request, body?: { schoolId?: string | null; academicSessionId?: string | null }): Promise<FeeTenantScope> => {
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

const feeGroupSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const feeMasterSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  feeGroupId: uuidSchema,
  feeTypeId: uuidSchema,
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  dueDate: z.coerce.date(),
  amount: positiveDecimalInput,
  effectiveFrom: dateInput,
  effectiveTo: dateInput,
  isLegacy: z.boolean().optional(),
  legacyStructureId: uuidSchema.optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const fineRuleBaseSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  feeMasterId: uuidSchema,
  fineType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'CUMULATIVE']),
  amount: decimalInput,
  daysFrom: z.coerce.number().int().min(0).max(3650),
  daysTo: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const validateFineRulePayload = (payload: {
  fineType?: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'CUMULATIVE';
  amount?: number | Prisma.Decimal;
  daysFrom?: number;
  daysTo?: number | null;
}) => {
  if (payload.daysFrom !== undefined && payload.daysTo !== undefined && payload.daysTo !== null && payload.daysTo < payload.daysFrom) {
    throw new HttpError(400, 'daysTo cannot be before daysFrom');
  }
  if (payload.fineType === 'PERCENTAGE' && payload.amount !== undefined && toDecimal(payload.amount).gt(100)) {
    throw new HttpError(400, 'Percentage fine cannot exceed 100%');
  }
};

const fineRuleSchema = fineRuleBaseSchema.superRefine((payload, ctx) => {
  try {
    validateFineRulePayload(payload);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : 'Invalid fine rule',
    });
  }
});

const assertEffectiveRange = (effectiveFrom?: Date | null, effectiveTo?: Date | null) => {
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new HttpError(400, 'effectiveTo cannot be before effectiveFrom');
};

const assertFeeGroup = async (scope: FeeTenantScope, id: string) => {
  const found = await prisma.feeGroup.findFirst({ where: { id, ...tenantScopeOnly(scope), deletedAt: null }, select: { id: true, status: true } });
  if (!found) throw new HttpError(404, 'Fee group not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee group cannot be used');
};

const assertFeeType = async (scope: FeeTenantScope, id: string) => {
  const found = await prisma.feeType.findFirst({ where: { id, ...tenantScopeOnly(scope), deletedAt: null }, select: { id: true, status: true } });
  if (!found) throw new HttpError(404, 'Fee type not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee type cannot be used');
};

const assertLegacyStructure = async (scope: FeeTenantScope, id?: string | null) => {
  if (!id) return;
  const found = await prisma.feeStructure.findFirst({ where: { id, ...tenantScopeOnly(scope), deletedAt: null }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Legacy fee structure not found');
};

const assertFeeMaster = async (scope: FeeTenantScope, id: string) => {
  const found = await prisma.feeMaster.findFirst({ where: { id, ...tenantScopeOnly(scope), deletedAt: null }, select: { id: true, status: true } });
  if (!found) throw new HttpError(404, 'Fee master not found');
  if (found.status !== 'ACTIVE') throw new HttpError(400, 'Inactive fee master cannot be used');
};

const includeFeeMaster = {
  feeGroup: { select: { id: true, name: true, status: true } },
  feeType: { select: { id: true, name: true, code: true, schedule: true, status: true } },
  legacyStructure: { select: { id: true, name: true } },
  fineRules: { where: { deletedAt: null }, orderBy: [{ daysFrom: 'asc' as const }, { createdAt: 'asc' as const }] },
  _count: { select: { invoiceItems: true, discountInstallments: true } },
} satisfies Prisma.FeeMasterInclude;

export const listFeeGroups = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined;
  const where: Prisma.FeeGroupWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feeGroup.findMany({
      where,
      include: { _count: { select: { masters: true, assignments: true, invoices: true } } },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.feeGroup.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

export const createFeeGroup = async (req: Request, res: Response) => {
  const payload = feeGroupSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  const name = normalizeText(payload.name);
  try {
    const item = await prisma.feeGroup.create({
      data: {
        ...tenantScopeOnly(scope),
        name,
        normalizedName: normalizeName(name),
        description: nullableText(payload.description),
        status: payload.status ?? 'ACTIVE',
      },
    });
    await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_GROUP', entityId: item.id, action: 'CREATE', afterState: item });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Fee group name already exists for this session');
  }
};

export const updateFeeGroup = async (req: Request, res: Response) => {
  const payload = feeGroupSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeGroup.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fee group not found');
  try {
    const item = await prisma.feeGroup.update({
      where: { id: existing.id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        normalizedName: payload.name === undefined ? undefined : normalizeName(payload.name),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
        status: payload.status,
      },
    });
    await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_GROUP', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Fee group name already exists for this session');
  }
};

export const deleteFeeGroup = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeGroup.findFirst({
    where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null },
    include: { _count: { select: { masters: true, assignments: true, invoices: true } } },
  });
  if (!existing) throw new HttpError(404, 'Fee group not found');
  if (existing._count.masters + existing._count.assignments + existing._count.invoices > 0) {
    throw new HttpError(409, 'Cannot delete fee group while masters, assignments, or invoices use it');
  }
  const item = await prisma.feeGroup.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: scope.userId, status: 'INACTIVE' } });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_GROUP', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

export const listFeeMasters = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined;
  const feeGroupId = typeof req.query.feeGroupId === 'string' ? req.query.feeGroupId : undefined;
  const feeTypeId = typeof req.query.feeTypeId === 'string' ? req.query.feeTypeId : undefined;
  const where: Prisma.FeeMasterWhereInput = {
    ...tenantScopeOnly(scope),
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(feeGroupId ? { feeGroupId } : {}),
    ...(feeTypeId ? { feeTypeId } : {}),
    ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.feeMaster.findMany({ where, include: includeFeeMaster, orderBy: [{ sortOrder: 'asc' }, { dueDate: 'asc' }, { name: 'asc' }], skip, take: limit }),
    prisma.feeMaster.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

export const createFeeMaster = async (req: Request, res: Response) => {
  const payload = feeMasterSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  assertEffectiveRange(payload.effectiveFrom, payload.effectiveTo);
  await Promise.all([
    assertFeeGroup(scope, payload.feeGroupId),
    assertFeeType(scope, payload.feeTypeId),
    assertLegacyStructure(scope, payload.legacyStructureId),
  ]);
  const name = normalizeText(payload.name);
  try {
    const item = await prisma.feeMaster.create({
      data: {
        ...tenantScopeOnly(scope),
        feeGroupId: payload.feeGroupId,
        feeTypeId: payload.feeTypeId,
        name,
        normalizedName: normalizeName(name),
        code: slugCode(payload.code || name),
        description: nullableText(payload.description),
        dueDate: payload.dueDate,
        amount: toDecimal(payload.amount),
        effectiveFrom: payload.effectiveFrom ?? null,
        effectiveTo: payload.effectiveTo ?? null,
        isLegacy: payload.isLegacy ?? false,
        legacyStructureId: payload.legacyStructureId ?? null,
        status: payload.status ?? 'ACTIVE',
        sortOrder: payload.sortOrder ?? 0,
      },
      include: includeFeeMaster,
    });
    await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_MASTER', entityId: item.id, action: 'CREATE', afterState: item });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Fee master code already exists in this group for this session');
  }
};

export const updateFeeMaster = async (req: Request, res: Response) => {
  const payload = feeMasterSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeMaster.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null }, include: includeFeeMaster });
  if (!existing) throw new HttpError(404, 'Fee master not found');
  assertEffectiveRange(payload.effectiveFrom ?? existing.effectiveFrom, payload.effectiveTo ?? existing.effectiveTo);
  if (payload.feeGroupId) await assertFeeGroup(scope, payload.feeGroupId);
  if (payload.feeTypeId) await assertFeeType(scope, payload.feeTypeId);
  if (payload.legacyStructureId !== undefined) await assertLegacyStructure(scope, payload.legacyStructureId);
  try {
    const item = await prisma.feeMaster.update({
      where: { id: existing.id },
      data: {
        feeGroupId: payload.feeGroupId,
        feeTypeId: payload.feeTypeId,
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        normalizedName: payload.name === undefined ? undefined : normalizeName(payload.name),
        code: payload.code === undefined && payload.name === undefined ? undefined : slugCode(payload.code || payload.name || existing.name),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
        dueDate: payload.dueDate,
        amount: payload.amount === undefined ? undefined : toDecimal(payload.amount),
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo,
        isLegacy: payload.isLegacy,
        legacyStructureId: payload.legacyStructureId,
        status: payload.status,
        sortOrder: payload.sortOrder,
      },
      include: includeFeeMaster,
    });
    await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_MASTER', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Fee master code already exists in this group for this session');
  }
};

export const deleteFeeMaster = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeMaster.findFirst({
    where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null },
    include: { _count: { select: { invoiceItems: true, discountInstallments: true } } },
  });
  if (!existing) throw new HttpError(404, 'Fee master not found');
  if (existing._count.invoiceItems + existing._count.discountInstallments > 0) {
    throw new HttpError(409, 'Cannot delete fee master while invoices or discounts use it');
  }
  const item = await prisma.feeMaster.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: scope.userId, status: 'INACTIVE' } });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_MASTER', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(204).send();
};

export const duplicateFeeMaster = async (req: Request, res: Response) => {
  const payload = feeMasterSchema.pick({ schoolId: true, academicSessionId: true, feeGroupId: true, feeTypeId: true, dueDate: true, effectiveFrom: true, effectiveTo: true }).partial().parse(req.body ?? {});
  const scope = await resolveScope(req, payload);
  const source = await prisma.feeMaster.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null }, include: { fineRules: { where: { deletedAt: null } } } });
  if (!source) throw new HttpError(404, 'Fee master not found');
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.feeMaster.create({
      data: {
        ...tenantScopeOnly(scope),
        feeGroupId: payload.feeGroupId ?? source.feeGroupId,
        feeTypeId: payload.feeTypeId ?? source.feeTypeId,
        name: `${source.name} Copy`,
        normalizedName: normalizeName(`${source.name} Copy`),
        code: `${source.code}_COPY_${Date.now().toString().slice(-6)}`,
        description: source.description,
        dueDate: payload.dueDate ?? source.dueDate,
        amount: source.amount,
        effectiveFrom: payload.effectiveFrom ?? source.effectiveFrom,
        effectiveTo: payload.effectiveTo ?? source.effectiveTo,
        status: source.status,
        sortOrder: source.sortOrder,
        fineRules: {
          create: source.fineRules.map((rule) => ({
            schoolId: scope.schoolId,
            academicSessionId: scope.academicSessionId,
            fineType: rule.fineType,
            amount: rule.amount,
            daysFrom: rule.daysFrom,
            daysTo: rule.daysTo,
            status: rule.status,
          })),
        },
      },
      include: includeFeeMaster,
    });
    return created;
  });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_MASTER', entityId: item.id, action: 'DUPLICATE', afterState: item });
  res.status(201).json(item);
};

export const listFeeFineRules = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const feeMasterId = typeof req.query.feeMasterId === 'string' ? req.query.feeMasterId : req.params.masterId;
  if (feeMasterId) await assertFeeMaster(scope, feeMasterId);
  const items = await prisma.feeFineRule.findMany({
    where: { ...tenantScopeOnly(scope), deletedAt: null, ...(feeMasterId ? { feeMasterId } : {}) },
    include: { feeMaster: { select: { id: true, name: true, code: true } } },
    orderBy: [{ daysFrom: 'asc' }, { createdAt: 'asc' }],
  });
  res.status(200).json(items);
};

export const createFeeFineRule = async (req: Request, res: Response) => {
  const payload = fineRuleSchema.parse({ ...req.body, feeMasterId: req.params.masterId ?? req.body.feeMasterId });
  const scope = await resolveScope(req, payload);
  await assertFeeMaster(scope, payload.feeMasterId);
  const item = await prisma.feeFineRule.create({
    data: {
      ...tenantScopeOnly(scope),
      feeMasterId: payload.feeMasterId,
      fineType: payload.fineType,
      amount: toDecimal(payload.amount),
      daysFrom: payload.daysFrom,
      daysTo: payload.daysTo ?? null,
      status: payload.status ?? 'ACTIVE',
    },
  });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE_RULE', entityId: item.id, action: 'CREATE', afterState: item });
  res.status(201).json(item);
};

export const updateFeeFineRule = async (req: Request, res: Response) => {
  const payload = fineRuleBaseSchema.partial().parse(req.body);
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeFineRule.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fine rule not found');
  const merged = { ...existing, ...payload };
  validateFineRulePayload(merged);
  if (payload.feeMasterId) await assertFeeMaster(scope, payload.feeMasterId);
  const item = await prisma.feeFineRule.update({
    where: { id: existing.id },
    data: {
      feeMasterId: payload.feeMasterId,
      fineType: payload.fineType,
      amount: payload.amount === undefined ? undefined : toDecimal(payload.amount),
      daysFrom: payload.daysFrom,
      daysTo: payload.daysTo,
      status: payload.status,
    },
  });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE_RULE', entityId: item.id, action: 'UPDATE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};

export const deleteFeeFineRule = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const existing = await prisma.feeFineRule.findFirst({ where: { id: uuidParam(req), ...tenantScopeOnly(scope), deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Fine rule not found');
  const item = await prisma.feeFineRule.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: scope.userId, status: 'INACTIVE' } });
  await FeeAuditService.record(req, { schoolId: scope.schoolId, entityType: 'FEE_FINE_RULE', entityId: item.id, action: 'DELETE', beforeState: existing, afterState: item });
  res.status(200).json(item);
};
