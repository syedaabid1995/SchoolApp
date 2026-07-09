import type { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import ExcelJS from 'exceljs';
import { Prisma, type ExpensePaymentMode } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { getSignedUrlForStoredUrl, uploadBuffer } from '../services/s3.service';

const uuidSchema = z.string().uuid();
const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
const amountSchema = z.coerce.number().positive('Amount must be greater than zero').max(100000000);

const paymentModes = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] as const;
const defaultCategories = [
  ['Salary', 10],
  ['Transport', 20],
  ['Maintenance', 30],
  ['Utilities', 40],
  ['Stationery', 50],
  ['Rent', 60],
  ['Events', 70],
  ['Exam', 80],
  ['Library', 90],
  ['Other', 100],
] as const;

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeName = (value: string) => normalizeText(value).toLowerCase();
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const pagination = (req: Request) => {
  const page = pageSchema.parse(req.query.page ?? 1);
  const limit = limitSchema.parse(req.query.limit ?? 20);
  return { page, limit, skip: (page - 1) * limit };
};

const isSuperAdmin = (req: Request) => req.auth?.role === 'SUPER_ADMIN';
const isSchoolAdmin = (req: Request) => req.auth?.role === 'SCHOOL_ADMIN';

const requestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const resolveSchoolScope = (req: Request, bodySchoolId?: string | null, options: { allowAllForSuperAdmin?: boolean } = {}) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.schoolId) {
    const requested = requestedSchoolId(req, bodySchoolId);
    if (requested && requested !== req.auth.schoolId) throw new HttpError(403, 'Tenant scope violation');
    return { schoolId: req.auth.schoolId, userId: req.auth.userId, platformAll: false };
  }
  if (isSuperAdmin(req)) {
    const schoolId = requestedSchoolId(req, bodySchoolId);
    if (schoolId) return { schoolId, userId: req.auth.userId, platformAll: false };
    if (options.allowAllForSuperAdmin) return { schoolId: null, userId: req.auth.userId, platformAll: true };
    throw new HttpError(400, 'schoolId is required');
  }
  throw new HttpError(403, 'School scope is required');
};

const rejectSuperAdminMutation = (req: Request) => {
  if (isSuperAdmin(req)) throw new HttpError(403, 'Super Admin can only view and export school expenses');
};

const ensureDefaultCategories = async (schoolId: string) => {
  await prisma.$transaction(
    defaultCategories.map(([name, sortOrder]) =>
      prisma.expenseCategory.upsert({
        where: { unique_expense_category_normalized_name: { schoolId, normalizedName: normalizeName(name) } },
        update: {},
        create: {
          schoolId,
          name,
          normalizedName: normalizeName(name),
          isDefault: true,
          sortOrder,
        },
      }),
    ),
  );
};

const categorySchema = z.object({
  schoolId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

const expenseSchema = z.object({
  schoolId: uuidSchema.optional(),
  categoryId: uuidSchema,
  title: z.string().trim().min(1).max(180),
  amount: amountSchema,
  expenseDate: z.coerce.date(),
  paymentMode: z.enum(paymentModes),
  paidTo: z.string().trim().max(180).optional().nullable(),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

const approvalSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
});

const categoryInclude = {
  _count: { select: { expenses: true } },
} satisfies Prisma.ExpenseCategoryInclude;

const expenseInclude = {
  school: { select: { id: true, name: true, code: true } },
  category: { select: { id: true, name: true, status: true } },
  _count: { select: { changeRequests: true } },
} satisfies Prisma.ExpenseInclude;

const serializeExpenseInput = (payload: z.infer<typeof expenseSchema>, receipt?: ReceiptUploadResult | null) => ({
  categoryId: payload.categoryId,
  title: normalizeText(payload.title),
  amount: payload.amount,
  expenseDate: payload.expenseDate.toISOString(),
  paymentMode: payload.paymentMode,
  paidTo: nullableText(payload.paidTo),
  referenceNumber: nullableText(payload.referenceNumber),
  description: nullableText(payload.description),
  ...(receipt ? receipt : {}),
});

type ReceiptUploadResult = {
  receiptUrl: string;
  receiptKey: string;
  receiptFileName: string;
  receiptContentType: string;
};

const uploadReceipt = async (schoolId: string, file?: Express.Multer.File | null): Promise<ReceiptUploadResult | null> => {
  if (!file) return null;
  const extension = path.extname(file.originalname || '').toLowerCase() || '.bin';
  const safeName = (file.originalname || `receipt${extension}`).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 140);
  const key = `schools/${schoolId}/expenses/receipts/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
  const uploaded = await uploadBuffer({
    key,
    body: file.buffer,
    contentType: file.mimetype || 'application/octet-stream',
  });
  return {
    receiptUrl: uploaded.url,
    receiptKey: uploaded.key,
    receiptFileName: file.originalname || safeName,
    receiptContentType: file.mimetype || 'application/octet-stream',
  };
};

const assertCategory = async (schoolId: string, categoryId: string) => {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, schoolId, deletedAt: null, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!category) throw new HttpError(404, 'Expense category not found');
};

const buildExpenseWhere = (req: Request, schoolId: string | null): Prisma.ExpenseWhereInput => {
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const paymentMode = paymentModes.includes(req.query.paymentMode as ExpensePaymentMode) ? req.query.paymentMode as ExpensePaymentMode : undefined;
  const dateFrom = typeof req.query.dateFrom === 'string' && req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = typeof req.query.dateTo === 'string' && req.query.dateTo ? new Date(req.query.dateTo) : null;
  if (dateTo) dateTo.setHours(23, 59, 59, 999);

  return {
    deletedAt: null,
    ...(schoolId ? { schoolId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(paymentMode ? { paymentMode } : {}),
    ...(dateFrom || dateTo ? { expenseDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { paidTo: { contains: search, mode: 'insensitive' } },
            { referenceNumber: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { category: { name: { contains: search, mode: 'insensitive' } } },
            { school: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
};

export const getExpenseMetadata = async (req: Request, res: Response) => {
  const scope = resolveSchoolScope(req, undefined, { allowAllForSuperAdmin: true });
  if (scope.schoolId) await ensureDefaultCategories(scope.schoolId);
  const categories = scope.schoolId
    ? await prisma.expenseCategory.findMany({
        where: { schoolId: scope.schoolId, deletedAt: null },
        include: categoryInclude,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })
    : [];
  res.status(200).json({ paymentModes, categories });
};

export const listExpenseCategories = async (req: Request, res: Response) => {
  const scope = resolveSchoolScope(req);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  await ensureDefaultCategories(scope.schoolId);
  const search = typeof req.query.search === 'string' ? normalizeText(req.query.search) : '';
  const categories = await prisma.expenseCategory.findMany({
    where: {
      schoolId: scope.schoolId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: categoryInclude,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.status(200).json(categories);
};

export const createExpenseCategory = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const payload = categorySchema.parse(req.body);
  const scope = resolveSchoolScope(req, payload.schoolId);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const name = normalizeText(payload.name);
  const item = await prisma.expenseCategory.create({
    data: {
      schoolId: scope.schoolId,
      name,
      normalizedName: normalizeName(name),
      description: nullableText(payload.description),
      status: payload.status ?? 'ACTIVE',
      sortOrder: payload.sortOrder ?? 0,
    },
    include: categoryInclude,
  });
  res.status(201).json(item);
};

export const updateExpenseCategory = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const payload = categorySchema.partial().parse(req.body);
  const scope = resolveSchoolScope(req, payload.schoolId);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const existing = await prisma.expenseCategory.findFirst({ where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Expense category not found');
  const item = await prisma.expenseCategory.update({
    where: { id: existing.id },
    data: {
      name: payload.name === undefined ? undefined : normalizeText(payload.name),
      normalizedName: payload.name === undefined ? undefined : normalizeName(payload.name),
      description: payload.description === undefined ? undefined : nullableText(payload.description),
      status: payload.status,
      sortOrder: payload.sortOrder,
    },
    include: categoryInclude,
  });
  res.status(200).json(item);
};

export const deleteExpenseCategory = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const scope = resolveSchoolScope(req);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const existing = await prisma.expenseCategory.findFirst({
    where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, deletedAt: null },
    include: { _count: { select: { expenses: true } } },
  });
  if (!existing) throw new HttpError(404, 'Expense category not found');
  if (existing._count.expenses > 0) throw new HttpError(400, 'Category is already used by expenses. Mark it inactive instead.');
  await prisma.expenseCategory.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  res.status(204).send();
};

export const listExpenses = async (req: Request, res: Response) => {
  const scope = resolveSchoolScope(req, undefined, { allowAllForSuperAdmin: true });
  if (scope.schoolId) await ensureDefaultCategories(scope.schoolId);
  const { page, limit, skip } = pagination(req);
  const where = buildExpenseWhere(req, scope.schoolId);
  const [items, total, aggregate] = await prisma.$transaction([
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
  ]);
  res.status(200).json({
    items,
    summary: { totalAmount: aggregate._sum.amount ?? 0, totalCount: aggregate._count.id },
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

export const createExpense = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const payload = expenseSchema.parse(req.body);
  const scope = resolveSchoolScope(req, payload.schoolId);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  await ensureDefaultCategories(scope.schoolId);
  await assertCategory(scope.schoolId, payload.categoryId);
  const receipt = await uploadReceipt(scope.schoolId, req.file);
  const item = await prisma.expense.create({
    data: {
      schoolId: scope.schoolId,
      categoryId: payload.categoryId,
      title: normalizeText(payload.title),
      amount: new Prisma.Decimal(payload.amount),
      expenseDate: payload.expenseDate,
      paymentMode: payload.paymentMode,
      paidTo: nullableText(payload.paidTo),
      referenceNumber: nullableText(payload.referenceNumber),
      description: nullableText(payload.description),
      ...(receipt ?? {}),
      createdById: scope.userId,
      updatedById: scope.userId,
    },
    include: expenseInclude,
  });
  res.status(201).json(item);
};

export const updateExpense = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const payload = expenseSchema.parse(req.body);
  const scope = resolveSchoolScope(req, payload.schoolId);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const existing = await prisma.expense.findFirst({ where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Expense not found');
  await assertCategory(scope.schoolId, payload.categoryId);
  const receipt = await uploadReceipt(scope.schoolId, req.file);

  if (!isSchoolAdmin(req)) {
    const request = await prisma.expenseChangeRequest.create({
      data: {
        schoolId: scope.schoolId,
        expenseId: existing.id,
        requestType: 'UPDATE',
        proposedData: serializeExpenseInput(payload, receipt),
        reason: nullableText(payload.reason),
        requestedById: scope.userId,
      },
      include: { expense: { include: expenseInclude } },
    });
    res.status(202).json({ message: 'Expense edit request sent for school admin approval', request });
    return;
  }

  const item = await prisma.expense.update({
    where: { id: existing.id },
    data: {
      categoryId: payload.categoryId,
      title: normalizeText(payload.title),
      amount: new Prisma.Decimal(payload.amount),
      expenseDate: payload.expenseDate,
      paymentMode: payload.paymentMode,
      paidTo: nullableText(payload.paidTo),
      referenceNumber: nullableText(payload.referenceNumber),
      description: nullableText(payload.description),
      ...(receipt ?? {}),
      updatedById: scope.userId,
    },
    include: expenseInclude,
  });
  res.status(200).json(item);
};

export const deleteExpense = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  const scope = resolveSchoolScope(req);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const existing = await prisma.expense.findFirst({ where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, deletedAt: null } });
  if (!existing) throw new HttpError(404, 'Expense not found');

  if (!isSchoolAdmin(req)) {
    const request = await prisma.expenseChangeRequest.create({
      data: {
        schoolId: scope.schoolId,
        expenseId: existing.id,
        requestType: 'DELETE',
        reason: nullableText(typeof req.body?.reason === 'string' ? req.body.reason : null),
        requestedById: scope.userId,
      },
      include: { expense: { include: expenseInclude } },
    });
    res.status(202).json({ message: 'Expense delete request sent for school admin approval', request });
    return;
  }

  await prisma.expense.update({ where: { id: existing.id }, data: { deletedAt: new Date(), deletedById: scope.userId } });
  res.status(204).send();
};

export const redirectExpenseReceipt = async (req: Request, res: Response) => {
  const scope = resolveSchoolScope(req, undefined, { allowAllForSuperAdmin: true });
  const expense = await prisma.expense.findFirst({
    where: {
      id: uuidSchema.parse(req.params.id),
      deletedAt: null,
      ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    },
    select: { receiptUrl: true },
  });
  if (!expense?.receiptUrl) throw new HttpError(404, 'Receipt not found');
  const signed = await getSignedUrlForStoredUrl({ url: expense.receiptUrl });
  res.redirect(302, signed);
};

export const listExpenseChangeRequests = async (req: Request, res: Response) => {
  const scope = resolveSchoolScope(req, undefined, { allowAllForSuperAdmin: false });
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(String(req.query.status)) ? String(req.query.status) as any : undefined;
  const items = await prisma.expenseChangeRequest.findMany({
    where: { schoolId: scope.schoolId, ...(status ? { status } : {}) },
    include: { expense: { include: expenseInclude } },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });
  res.status(200).json(items);
};

export const approveExpenseChangeRequest = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  if (!isSchoolAdmin(req)) throw new HttpError(403, 'Only school admin can approve expense requests');
  const payload = approvalSchema.parse(req.body);
  const scope = resolveSchoolScope(req);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const request = await prisma.expenseChangeRequest.findFirst({
    where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, status: 'PENDING' },
    include: { expense: true },
  });
  if (!request) throw new HttpError(404, 'Pending expense request not found');

  const result = await prisma.$transaction(async (tx) => {
    if (request.requestType === 'UPDATE') {
      const data = request.proposedData as Record<string, any>;
      await assertCategory(scope.schoolId!, String(data.categoryId));
      await tx.expense.update({
        where: { id: request.expenseId },
        data: {
          categoryId: String(data.categoryId),
          title: String(data.title),
          amount: new Prisma.Decimal(data.amount),
          expenseDate: new Date(String(data.expenseDate)),
          paymentMode: data.paymentMode as ExpensePaymentMode,
          paidTo: data.paidTo ?? null,
          referenceNumber: data.referenceNumber ?? null,
          description: data.description ?? null,
          receiptUrl: data.receiptUrl ?? undefined,
          receiptKey: data.receiptKey ?? undefined,
          receiptFileName: data.receiptFileName ?? undefined,
          receiptContentType: data.receiptContentType ?? undefined,
          updatedById: scope.userId,
        },
      });
    } else {
      await tx.expense.update({
        where: { id: request.expenseId },
        data: { deletedAt: new Date(), deletedById: scope.userId },
      });
    }
    return tx.expenseChangeRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedById: scope.userId,
        reviewedAt: new Date(),
        reviewNote: nullableText(payload.note),
      },
      include: { expense: { include: expenseInclude } },
    });
  });

  res.status(200).json(result);
};

export const rejectExpenseChangeRequest = async (req: Request, res: Response) => {
  rejectSuperAdminMutation(req);
  if (!isSchoolAdmin(req)) throw new HttpError(403, 'Only school admin can reject expense requests');
  const payload = approvalSchema.parse(req.body);
  const scope = resolveSchoolScope(req);
  if (!scope.schoolId) throw new HttpError(400, 'schoolId is required');
  const request = await prisma.expenseChangeRequest.findFirst({
    where: { id: uuidSchema.parse(req.params.id), schoolId: scope.schoolId, status: 'PENDING' },
  });
  if (!request) throw new HttpError(404, 'Pending expense request not found');
  const item = await prisma.expenseChangeRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      reviewedById: scope.userId,
      reviewedAt: new Date(),
      reviewNote: nullableText(payload.note),
    },
    include: { expense: { include: expenseInclude } },
  });
  res.status(200).json(item);
};

const exportRows = async (req: Request) => {
  const scope = resolveSchoolScope(req, undefined, { allowAllForSuperAdmin: true });
  const where = buildExpenseWhere(req, scope.schoolId);
  const rows = await prisma.expense.findMany({
    where,
    include: expenseInclude,
    orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    take: 10000,
  });
  return rows.map((expense) => ({
    school: expense.school?.name ?? '',
    date: expense.expenseDate.toISOString().slice(0, 10),
    title: expense.title,
    category: expense.category.name,
    amount: expense.amount.toString(),
    paymentMode: expense.paymentMode,
    paidTo: expense.paidTo ?? '',
    referenceNumber: expense.referenceNumber ?? '',
    description: expense.description ?? '',
  }));
};

export const exportExpenses = async (req: Request, res: Response) => {
  const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
  const rows = await exportRows(req);
  const filename = `expense-report-${new Date().toISOString().slice(0, 10)}.${format}`;

  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Expenses');
    sheet.columns = [
      { header: 'School', key: 'school', width: 28 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Title', key: 'title', width: 28 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Payment Mode', key: 'paymentMode', width: 18 },
      { header: 'Paid To', key: 'paidTo', width: 24 },
      { header: 'Reference', key: 'referenceNumber', width: 20 },
      { header: 'Description', key: 'description', width: 36 },
    ];
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
    return;
  }

  const headers = ['School', 'Date', 'Title', 'Category', 'Amount', 'Payment Mode', 'Paid To', 'Reference', 'Description'];
  const csv = [
    headers,
    ...rows.map((row) => [row.school, row.date, row.title, row.category, row.amount, row.paymentMode, row.paidTo, row.referenceNumber, row.description]),
  ].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
};
