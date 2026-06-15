import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../../config/db';
import { HttpError } from '../../../../middlewares/error.middleware';
import { createLedgerEntry } from '../../../../services/feeLedger.service';
import { getNextNumber } from '../../../../services/numberSequence.service';
import { FeeAuditService } from '../fee-audit.service';

const uuidSchema = z.string().uuid();
const uuidParam = (req: Request, name = 'id') => uuidSchema.parse(req.params[name]);
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const toDecimal = (value: number | string | Prisma.Decimal | null | undefined) => new Prisma.Decimal(value ?? 0);
const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

type ScopeInput = {
  schoolId?: string | null;
  academicSessionId?: string | null;
};

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

const resolveScope = async (req: Request, body?: ScopeInput): Promise<FeeTenantScope> => {
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

const carryForwardSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  fromAcademicSessionId: uuidSchema,
  toAcademicSessionId: uuidSchema,
  studentIds: z.array(uuidSchema).optional(),
});

const cancelSchema = z.object({
  schoolId: uuidSchema.optional(),
  academicSessionId: uuidSchema.optional(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const assertAcademicYear = async (schoolId: string, id: string) => {
  const item = await prisma.academicYear.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!item) throw new HttpError(404, 'Academic session not found');
};

const unpaidInvoiceWhere = (scope: { schoolId: string }, payload: z.infer<typeof carryForwardSchema>): Prisma.FeeInvoiceWhereInput => ({
  schoolId: scope.schoolId,
  academicSessionId: payload.fromAcademicSessionId,
  deletedAt: null,
  status: { notIn: ['PAID', 'CANCELLED'] },
  dueAmount: { gt: 0 },
  ...(payload.studentIds?.length ? { studentId: { in: payload.studentIds } } : {}),
});

const buildCarryForwardPreview = async (scope: { schoolId: string }, payload: z.infer<typeof carryForwardSchema>) => {
  const invoices = await prisma.feeInvoice.findMany({
    where: unpaidInvoiceWhere(scope, payload),
    include: {
      student: { select: { id: true, admissionNo: true, fullName: true, classId: true, sectionId: true } },
    },
    orderBy: [{ studentId: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
  });

  const byStudent = new Map<string, { student: (typeof invoices)[number]['student']; amount: Prisma.Decimal; invoices: typeof invoices }>();
  for (const invoice of invoices) {
    const current = byStudent.get(invoice.studentId) ?? { student: invoice.student, amount: toDecimal(0), invoices: [] };
    current.amount = current.amount.plus(invoice.dueAmount);
    current.invoices.push(invoice);
    byStudent.set(invoice.studentId, current);
  }

  return Array.from(byStudent.entries()).map(([studentId, value]) => ({
    studentId,
    student: value.student,
    amount: value.amount,
    invoices: value.invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dueDate: invoice.dueDate,
      dueAmount: invoice.dueAmount,
      status: invoice.status,
    })),
  }));
};

export const previewFeeCarryForward = async (req: Request, res: Response) => {
  const payload = carryForwardSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  if (payload.fromAcademicSessionId === payload.toAcademicSessionId) throw new HttpError(400, 'Source and target academic sessions must be different');
  await Promise.all([
    assertAcademicYear(scope.schoolId, payload.fromAcademicSessionId),
    assertAcademicYear(scope.schoolId, payload.toAcademicSessionId),
  ]);
  const items = await buildCarryForwardPreview(scope, payload);
  res.status(200).json({ items, totalAmount: items.reduce((sum, item) => sum.plus(item.amount), toDecimal(0)) });
};

export const createFeeCarryForward = async (req: Request, res: Response) => {
  const payload = carryForwardSchema.parse(req.body);
  const scope = await resolveScope(req, payload);
  if (payload.fromAcademicSessionId === payload.toAcademicSessionId) throw new HttpError(400, 'Source and target academic sessions must be different');
  await Promise.all([
    assertAcademicYear(scope.schoolId, payload.fromAcademicSessionId),
    assertAcademicYear(scope.schoolId, payload.toAcademicSessionId),
  ]);
  const preview = await buildCarryForwardPreview(scope, payload);
  if (!preview.length) throw new HttpError(400, 'No unpaid invoices found for carry-forward');

  const items = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of preview) {
      const existing = await tx.feeCarryForward.findFirst({
        where: {
          schoolId: scope.schoolId,
          fromAcademicSessionId: payload.fromAcademicSessionId,
          toAcademicSessionId: payload.toAcademicSessionId,
          studentId: row.studentId,
          status: { not: 'CANCELLED' },
        },
        select: { id: true },
      });
      if (existing) continue;

      created.push(await tx.feeCarryForward.create({
        data: {
          schoolId: scope.schoolId,
          fromAcademicSessionId: payload.fromAcademicSessionId,
          toAcademicSessionId: payload.toAcademicSessionId,
          studentId: row.studentId,
          amount: row.amount,
          createdById: scope.userId,
          items: {
            create: row.invoices.map((invoice) => ({
              sourceInvoiceId: invoice.id,
              amount: invoice.dueAmount,
            })),
          },
        },
        include: {
          student: { select: { id: true, admissionNo: true, fullName: true } },
          items: { include: { sourceInvoice: { select: { id: true, invoiceNumber: true, dueAmount: true } } } },
        },
      }));
    }
    return created;
  });

  await FeeAuditService.record(req, {
    schoolId: scope.schoolId,
    entityType: 'FEE_CARRY_FORWARD',
    entityId: items.map((item) => item.id).join(','),
    action: 'CREATE',
    afterState: items,
  });
  res.status(201).json({ items });
};

export const listFeeCarryForwards = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const { page, limit, skip } = pagination(req);
  const status = req.query.status === 'PENDING' || req.query.status === 'GENERATED' || req.query.status === 'CANCELLED' ? req.query.status : undefined;
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
  const where: Prisma.FeeCarryForwardWhereInput = {
    schoolId: scope.schoolId,
    ...(status ? { status } : {}),
    ...(studentId ? { studentId } : {}),
    OR: [
      { fromAcademicSessionId: scope.academicSessionId },
      { toAcademicSessionId: scope.academicSessionId },
    ],
  };
  const [items, total] = await prisma.$transaction([
    prisma.feeCarryForward.findMany({
      where,
      include: {
        fromAcademicSession: { select: { id: true, name: true } },
        toAcademicSession: { select: { id: true, name: true } },
        student: { select: { id: true, admissionNo: true, fullName: true } },
        generatedInvoice: { select: { id: true, invoiceNumber: true, dueAmount: true, status: true } },
        items: { include: { sourceInvoice: { select: { id: true, invoiceNumber: true, dueAmount: true, status: true } } } },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.feeCarryForward.count({ where }),
  ]);
  res.status(200).json({ items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
};

export const generateCarryForwardInvoice = async (req: Request, res: Response) => {
  const scope = await resolveScope(req);
  const carryForwardId = uuidParam(req);
  const result = await prisma.$transaction(async (tx) => {
    const carryForward = await tx.feeCarryForward.findFirst({
      where: { id: carryForwardId, schoolId: scope.schoolId },
      include: {
        student: { select: { id: true, classId: true, sectionId: true } },
        generatedInvoice: true,
      },
    });
    if (!carryForward) throw new HttpError(404, 'Carry-forward record not found');
    if (carryForward.toAcademicSessionId !== scope.academicSessionId) throw new HttpError(400, 'Switch to the target academic session to generate this invoice');
    if (carryForward.status === 'CANCELLED') throw new HttpError(409, 'Cancelled carry-forward cannot generate an invoice');
    if (carryForward.generatedInvoice) return { carryForward, invoice: carryForward.generatedInvoice };

    const invoiceNumber = await getNextNumber({
      schoolId: scope.schoolId,
      academicSessionId: carryForward.toAcademicSessionId,
      type: 'INVOICE',
      year: new Date().getFullYear(),
    }, tx);

    const invoice = await tx.feeInvoice.create({
      data: {
        schoolId: scope.schoolId,
        academicSessionId: carryForward.toAcademicSessionId,
        studentId: carryForward.studentId,
        classId: carryForward.student.classId,
        sectionId: carryForward.student.sectionId,
        invoiceNumber,
        feeMonth: 'Carry Forward',
        issueDate: new Date(),
        dueDate: new Date(),
        previousBalance: carryForward.amount,
        totalAmount: carryForward.amount,
        dueAmount: carryForward.amount,
        status: 'ISSUED',
        createdById: scope.userId,
        items: {
          create: [{
            name: 'Previous Balance Carry Forward',
            amount: carryForward.amount,
            netAmount: carryForward.amount,
            sortOrder: 1,
          }],
        },
      },
      include: { items: true },
    });

    const updatedCarryForward = await tx.feeCarryForward.update({
      where: { id: carryForward.id },
      data: { status: 'GENERATED', generatedInvoiceId: invoice.id },
      include: { generatedInvoice: true },
    });

    await createLedgerEntry(tx, {
      schoolId: scope.schoolId,
      academicSessionId: carryForward.toAcademicSessionId,
      studentId: carryForward.studentId,
      invoiceId: invoice.id,
      carryForwardId: carryForward.id,
      type: 'CARRY_FORWARD_DEBIT',
      description: `Carry-forward balance from previous academic session`,
      debitAmount: carryForward.amount,
      createdById: scope.userId,
    });

    return { carryForward: updatedCarryForward, invoice };
  });

  await FeeAuditService.record(req, {
    schoolId: scope.schoolId,
    entityType: 'FEE_CARRY_FORWARD',
    entityId: result.carryForward.id,
    action: 'GENERATE_INVOICE',
    afterState: result,
  });
  res.status(201).json(result);
};

export const cancelFeeCarryForward = async (req: Request, res: Response) => {
  const payload = cancelSchema.parse(req.body ?? {});
  const scope = await resolveScope(req, payload);
  const existing = await prisma.feeCarryForward.findFirst({
    where: { id: uuidParam(req), schoolId: scope.schoolId },
  });
  if (!existing) throw new HttpError(404, 'Carry-forward record not found');
  if (existing.status === 'GENERATED') throw new HttpError(409, 'Generated carry-forward cannot be cancelled');
  const item = await prisma.feeCarryForward.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  });
  await FeeAuditService.record(req, {
    schoolId: scope.schoolId,
    entityType: 'FEE_CARRY_FORWARD',
    entityId: item.id,
    action: 'CANCEL',
    beforeState: { ...existing, reason: nullableReason(payload.reason) },
    afterState: item,
  });
  res.status(200).json(item);
};

const nullableReason = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};
