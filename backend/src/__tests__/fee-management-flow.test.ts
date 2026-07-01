import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { resolvePermissionForPath } from '../middlewares/auth.middleware';
import { HttpError } from '../middlewares/error.middleware';
import { getDefaultPermissionCodes } from '../utils/employeePermissions';
import { closeRedis } from '../config/redis';
import { closeQueues } from '../queues';
import { getNextNumber, type NumberSequenceClient } from '../services/numberSequence.service';
import { createLedgerEntry } from '../services/feeLedger.service';
import {
  assignStudentFees,
  cancelFeeInvoice,
  collectFeePayment,
  createFeeParticular,
  approveFeeDiscount,
  createFeeDiscount,
  createFeeFine,
  createFeeStructure,
  createFeeType,
  deleteFeeDiscount,
  deleteFeeParticular,
  exportFeeLedgerExcel,
  exportFeeLedgerPdf,
  exportFeeReports,
  generateFeeInvoices,
  getFeeReports,
  getStudentFeeLedger,
  listFeeAssignments,
  listFeeInvoices,
  previewFeeInvoices,
  rejectFeeDiscount,
  updateFeeDiscount,
} from '../controllers/feeManagement.controller';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const STUDENT_ID = '44444444-4444-4444-8444-444444444444';
const CLASS_ID = '55555555-5555-4555-8555-555555555555';
const SECTION_ID = '66666666-6666-4666-8666-666666666666';
const STRUCTURE_ID = '77777777-7777-4777-8777-777777777777';
const FEE_TYPE_ID = '88888888-8888-4888-8888-888888888888';
const PARTICULAR_ID = '99999999-9999-4999-8999-999999999999';
const GROUP_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATEGORY_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROUTE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DISCOUNT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PAID_DISCOUNT_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const EXISTING_DISCOUNT_ID = 'fafafafa-fafa-4afa-8afa-fafafafafafa';

const patch = <T extends object, K extends keyof T>(obj: T, key: K, value: T[K]) => {
  const original = obj[key];
  obj[key] = value;
  return () => {
    obj[key] = original;
  };
};

let restoreAuditLogCreate: (() => void) | null = null;
let restoreFeeParticularFindMany: (() => void) | null = null;

test.before(() => {
  restoreAuditLogCreate = patch(prisma.auditLog as any, 'create', async ({ data }: any) => ({
    id: 'abababab-abab-4aba-8aba-abababababab',
    ...data,
  }));
  restoreFeeParticularFindMany = patch(prisma.feeParticular as any, 'findMany', async ({ where }: any = {}) => {
    const ids = Array.isArray(where?.id?.in) ? where.id.in : [PARTICULAR_ID];
    return ids.map((id: string) => ({ id, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID }));
  });
});

test.after(async () => {
  restoreFeeParticularFindMany?.();
  restoreAuditLogCreate?.();
  restoreFeeParticularFindMany = null;
  restoreAuditLogCreate = null;
  await closeQueues();
  await closeRedis();
  await prisma.$disconnect();
});

const makeReq = (overrides: Record<string, unknown> = {}) =>
  ({
    auth: { userId: USER_ID, schoolId: SCHOOL_ID, role: 'SCHOOL_ADMIN' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  }) as any;

const makeRes = () => {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    payload: undefined,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
    send(payload?: unknown) {
      this.payload = payload;
      return this;
    },
  };
  return res;
};

const patchAcademicSession = () =>
  patch(prisma.academicYear as any, 'findFirst', async ({ where }: any) => {
    if (where?.schoolId !== SCHOOL_ID || (where?.id && where.id !== SESSION_ID)) return null;
    return { id: SESSION_ID, schoolId: SCHOOL_ID, name: '2026-2027', isActive: true };
  });

const patchNoTransportAssignments = () =>
  patch(prisma.studentTransportAssignment as any, 'findMany', async () => []);

const createNumberSequenceClient = (): NumberSequenceClient => {
  const counters = new Map<string, number>();
  return {
    numberSequence: {
      upsert: async (args: {
        where: { schoolId_type_year: { schoolId: string; type: string; year: number } };
        create: { prefix: string };
      }) => {
        const sequenceKey = args.where.schoolId_type_year;
        const key = `${sequenceKey.schoolId}:${sequenceKey.type}:${sequenceKey.year}`;
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return {
          prefix: args.create.prefix,
          year: sequenceKey.year,
          lastNumber: next,
        };
      },
    },
  } as unknown as NumberSequenceClient;
};

const feeInvoicePeriodUniqueError = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fee invoice period', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: { target: ['school_id', 'academic_session_id', 'student_id', 'fee_structure_id', 'fee_type_id', 'fee_month'] },
  });

const makeLedgerRow = (overrides: Record<string, any> = {}) => ({
  id: 'ledger-1',
  schoolId: SCHOOL_ID,
  academicSessionId: SESSION_ID,
  studentId: STUDENT_ID,
  invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  paymentId: null,
  receiptId: null,
  discountId: null,
  fineId: null,
  type: 'INVOICE_DEBIT',
  description: 'Invoice INV-2026-000001',
  debitAmount: new Prisma.Decimal(100),
  creditAmount: new Prisma.Decimal(0),
  balanceAfter: new Prisma.Decimal(100),
  entryDate: new Date('2026-06-10T08:00:00.000Z'),
  createdById: USER_ID,
  createdAt: new Date('2026-06-10T08:00:00.000Z'),
  student: {
    id: STUDENT_ID,
    admissionNo: 'A001',
    fullName: 'Student A',
    class: { id: CLASS_ID, name: 'Class 1' },
    section: { id: SECTION_ID, name: 'A' },
  },
  invoice: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', invoiceNumber: 'INV-2026-000001' },
  payment: null,
  receipt: null,
  ...overrides,
});

test('fee API routes resolve to granular fee permissions', () => {
  assert.equal(resolvePermissionForPath('/api/v1/fees/metadata', 'GET'), 'fees.overview.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/particulars', 'GET'), 'fees.particulars.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/particulars', 'POST'), 'fees.particulars.create');
  assert.equal(resolvePermissionForPath('/api/v1/fees/types/abc', 'PATCH'), 'fees.types.update');
  assert.equal(resolvePermissionForPath('/api/v1/fees/structures/abc', 'DELETE'), 'fees.structures.delete');
  assert.equal(resolvePermissionForPath('/api/v1/fees/assignments', 'POST'), 'fees.assignments.create');
  assert.equal(resolvePermissionForPath('/api/v1/fees/invoices/preview', 'POST'), 'fees.invoice-generate.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/invoices/generate', 'POST'), 'fees.invoice-generate.create');
  assert.equal(resolvePermissionForPath('/api/v1/fees/invoices/abc/cancel', 'PATCH'), 'fees.invoices.cancel');
  assert.equal(resolvePermissionForPath('/api/v1/fees/payments', 'POST'), 'fees.collection.create');
  assert.equal(resolvePermissionForPath('/api/v1/fees/collection/receipt/abc/print', 'GET'), 'fees.receipts.print');
  assert.equal(resolvePermissionForPath('/api/v1/fees/discounts', 'POST'), 'fees.discounts.create');
  assert.equal(resolvePermissionForPath('/api/v1/fees/discounts/abc/approve', 'PATCH'), 'fees.discounts.approve');
  assert.equal(resolvePermissionForPath('/api/v1/fees/fines', 'GET'), 'fees.fines.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/ledger/student-id', 'GET'), 'fees.ledger.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/ledger/student-id/export.pdf', 'GET'), 'fees.ledger.export');
  assert.equal(resolvePermissionForPath('/api/v1/fees/reports', 'GET'), 'fees.reports.view');
  assert.equal(resolvePermissionForPath('/api/v1/fees/reports/export.csv', 'GET'), 'fees.reports.export');
});

test('accountant default fee permissions are restricted to fee operations without setup mutation or discount approval', () => {
  const permissions = getDefaultPermissionCodes('ACCOUNTANT');
  const allowedFeePermissions = [
    'fees.overview.view',
    'fees.particulars.view',
    'fees.groups.view',
    'fees.types.view',
    'fees.masters.view',
    'fees.structures.view',
    'fees.assignments.view',
    'fees.invoices.view',
    'fees.invoice-generate.view',
    'fees.invoice-generate.create',
    'fees.invoices.cancel',
    'fees.collection.view',
    'fees.collection.create',
    'fees.receipts.print',
    'fees.ledger.view',
    'fees.ledger.export',
    'fees.discounts.view',
    'fees.reports.view',
    'fees.reports.export',
  ];

  for (const permission of allowedFeePermissions) {
    assert.equal(permissions.includes(permission), true, `${permission} should be allowed`);
  }

  for (const permission of [
    'fees.particulars.create',
    'fees.groups.create',
    'fees.masters.update',
    'fees.types.update',
    'fees.structures.delete',
    'fees.assignments.create',
    'fees.discounts.approve',
    'fees.discounts.delete',
    'fees.fines.create',
  ]) {
    assert.equal(permissions.includes(permission), false, `${permission} should not be allowed`);
  }
});

test('fees workspace uses only active fee types in financial dropdowns', () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), '../admin/app/dashboard/fees/FeesWorkspace.tsx'), 'utf8');
  assert.match(source, /const activeFeeTypes = useMemo\(\(\) => feeTypes\.filter\(\(type\) => type\.status === 'ACTIVE'\)/);
  assert.ok((source.match(/activeFeeTypes\.map/g) ?? []).length >= 3);
});

test('inactive fee type is rejected by structure creation and invoice generation APIs', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreClass = patch(prisma.class as any, 'findFirst', async () => ({ id: CLASS_ID }));
  const restoreFeeType = patch(prisma.feeType as any, 'findFirst', async () => ({ id: FEE_TYPE_ID, status: 'INACTIVE' }));

  try {
    await assert.rejects(
      () =>
        createFeeStructure(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              classId: CLASS_ID,
              feeTypeId: FEE_TYPE_ID,
              items: [{ particularId: PARTICULAR_ID, amount: 100 }],
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Inactive fee type/.test(error.message),
    );

    await assert.rejects(
      () =>
        generateFeeInvoices(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              target: 'STUDENT',
              studentId: STUDENT_ID,
              feeTypeId: FEE_TYPE_ID,
              feeMonth: 'June 2026',
              dueDate: '2026-06-30',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Inactive fee type/.test(error.message),
    );
  } finally {
    restoreAcademic();
    restoreClass();
    restoreFeeType();
  }
});

test('invoice preview validates period and does not create invoice records', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudentLookup = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [{
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    status: 'ENROLLED',
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    studentGroupId: null,
    studentCategoryId: null,
    admissionNo: 'A001',
    fullName: 'Student A',
    class: { id: CLASS_ID, name: 'Class 1' },
    section: { id: SECTION_ID, name: 'A' },
  }]);
  const restoreTransport = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-preview',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      name: 'Monthly Fee',
      feeType: { id: FEE_TYPE_ID, name: 'Monthly', schedule: 'MONTHLY' },
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async () => null);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({ _sum: { dueAmount: new Prisma.Decimal(25) } }));
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => [
    { valueType: 'FIXED', amount: new Prisma.Decimal(10), value: new Prisma.Decimal(10) },
  ]);
  let createCalled = false;
  const restoreTransaction = patch(prisma as any, '$transaction', async () => {
    createCalled = true;
    throw new Error('Preview must not open invoice transaction');
  });
  const res = makeRes();

  try {
    await assert.rejects(
      () => previewFeeInvoices(makeReq({ body: { academicSessionId: SESSION_ID, target: 'STUDENT', studentId: STUDENT_ID, feeMonth: '2026-06' } }), makeRes()),
      (error: unknown) => error instanceof Error && /dueDate/.test(error.message),
    );
    await assert.rejects(
      () => previewFeeInvoices(makeReq({ body: { academicSessionId: SESSION_ID, target: 'STUDENT', studentId: STUDENT_ID, feeMonth: '2026-06', dueDate: '2026-05-31' } }), makeRes()),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /dueDate cannot be before/.test(error.message),
    );

    await previewFeeInvoices(
      makeReq({ body: { academicSessionId: SESSION_ID, target: 'STUDENT', studentId: STUDENT_ID, feeMonth: '2026-06', dueDate: '2026-06-30' } }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.rows.length, 1);
    assert.equal(res.payload.rows[0].studentId, STUDENT_ID);
    assert.equal(res.payload.rows[0].baseAmount, 100);
    assert.equal(res.payload.rows[0].discountAmount, 10);
    assert.equal(res.payload.rows[0].previousBalance, 0);
    assert.equal(res.payload.rows[0].netPayable, 90);
    assert.equal(res.payload.rows[0].duplicateInvoiceExists, false);
    assert.equal(res.payload.totals.totalNetPayable, 90);
    assert.equal(createCalled, false);
  } finally {
    restoreTransaction();
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreInvoiceLookup();
    restoreAssignment();
    restoreTransport();
    restoreStudents();
    restoreStudentLookup();
    restoreAcademic();
  }
});

test('invoice preview marks duplicates and excluded selected students', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [{
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    status: 'ENROLLED',
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    studentGroupId: null,
    studentCategoryId: null,
    admissionNo: 'A001',
    fullName: 'Student A',
    class: { id: CLASS_ID, name: 'Class 1' },
    section: { id: SECTION_ID, name: 'A' },
  }]);
  const restoreTransport = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-preview-duplicate',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      name: 'Monthly Fee',
      feeType: { id: FEE_TYPE_ID, name: 'Monthly', schedule: 'MONTHLY' },
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async () => ({ id: 'invoice-existing', invoiceNumber: 'INV-2026-000001' }));
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({ _sum: { dueAmount: new Prisma.Decimal(0) } }));
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => []);
  const res = makeRes();
  const inactiveStudentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  try {
    await previewFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentIds: [STUDENT_ID, inactiveStudentId],
          feeMonth: 'June 2026',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.rows.length, 1);
    assert.equal(res.payload.rows[0].duplicateInvoiceExists, true);
    assert.equal(res.payload.rows[0].canGenerate, false);
    assert.match(res.payload.rows[0].warnings.join(' '), /Duplicate invoice exists/);
    assert.deepEqual(res.payload.excludedStudentIds, [inactiveStudentId]);
    assert.equal(res.payload.totals.duplicatesSkipped, 1);
    assert.equal(res.payload.totals.generatableStudents, 0);
  } finally {
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreInvoiceLookup();
    restoreAssignment();
    restoreTransport();
    restoreStudents();
    restoreAcademic();
  }
});

test('invoice list supports search, filters, pagination, sorting, and tenant isolation', async () => {
  const restoreAcademic = patchAcademicSession();
  let capturedFindArgs: any;
  let capturedCountArgs: any;
  const invoice = {
    id: 'invoice-list-1',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    feeTypeId: FEE_TYPE_ID,
    feeStructureId: STRUCTURE_ID,
    invoiceNumber: 'INV-2026-000001',
    feeMonth: 'June 2026',
    issueDate: new Date('2026-06-05'),
    dueDate: new Date('2026-06-30'),
    totalAmount: new Prisma.Decimal(100),
    paidAmount: new Prisma.Decimal(40),
    dueAmount: new Prisma.Decimal(60),
    status: 'PARTIALLY_PAID',
    student: { id: STUDENT_ID, admissionNo: 'A001', fullName: 'Student A' },
    class: { id: CLASS_ID, name: 'Class 1' },
    section: { id: SECTION_ID, name: 'A' },
    feeType: { id: FEE_TYPE_ID, name: 'Monthly', schedule: 'MONTHLY' },
    items: [],
    payments: [],
    receipts: [],
  };
  const restoreFindMany = patch(prisma.feeInvoice as any, 'findMany', async (args: any) => {
    capturedFindArgs = args;
    return [invoice];
  });
  const restoreCount = patch(prisma.feeInvoice as any, 'count', async (args: any) => {
    capturedCountArgs = args;
    return 11;
  });
  const res = makeRes();

  try {
    await listFeeInvoices(
      makeReq({
        query: {
          academicSessionId: SESSION_ID,
          search: 'Student A',
          admissionNumber: 'A001',
          invoiceNumber: 'INV-2026',
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          feeTypeId: FEE_TYPE_ID,
          feeStructureId: STRUCTURE_ID,
          feeMonth: 'June 2026',
          status: 'PARTIALLY_PAID',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
          dueDateFrom: '2026-06-15',
          dueDateTo: '2026-07-05',
          page: '2',
          limit: '5',
          sortBy: 'balanceAmount',
          sortOrder: 'asc',
        },
      }),
      res,
    );

    assert.equal(capturedFindArgs.where.schoolId, SCHOOL_ID);
    assert.equal(capturedFindArgs.where.academicSessionId, SESSION_ID);
    assert.equal(capturedFindArgs.where.classId, CLASS_ID);
    assert.equal(capturedFindArgs.where.sectionId, SECTION_ID);
    assert.equal(capturedFindArgs.where.feeTypeId, FEE_TYPE_ID);
    assert.equal(capturedFindArgs.where.feeStructureId, STRUCTURE_ID);
    assert.equal(capturedFindArgs.where.feeMonth, 'June 2026');
    assert.equal(capturedFindArgs.where.status, 'PARTIALLY_PAID');
    assert.equal(capturedFindArgs.skip, 5);
    assert.equal(capturedFindArgs.take, 5);
    assert.deepEqual(capturedFindArgs.orderBy, { dueAmount: 'asc' });
    const whereText = JSON.stringify(capturedFindArgs.where);
    assert.match(whereText, /fullName/);
    assert.match(whereText, /admissionNo/);
    assert.match(whereText, /invoiceNumber/);
    assert.match(whereText, /feeType/);
    assert.equal(capturedCountArgs.where.schoolId, SCHOOL_ID);
    assert.equal(res.payload.page, 2);
    assert.equal(res.payload.limit, 5);
    assert.equal(res.payload.total, 11);
    assert.equal(res.payload.totalPages, 3);
    assert.deepEqual(res.payload.data, [invoice]);
    assert.deepEqual(res.payload.items, [invoice]);

    await assert.rejects(
      () => listFeeInvoices(makeReq({ query: { schoolId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', academicSessionId: SESSION_ID } }), makeRes()),
      (error: unknown) => error instanceof HttpError && error.statusCode === 403,
    );
  } finally {
    restoreCount();
    restoreFindMany();
    restoreAcademic();
  }
});

test('duplicate fee particular names are rejected after case and spacing normalization', async () => {
  const restoreAcademic = patchAcademicSession();
  let capturedNormalizedName = '';
  const restoreDuplicate = patch(prisma.feeParticular as any, 'findFirst', async ({ where }: any) => {
    capturedNormalizedName = where.normalizedName;
    return { id: 'existing-particular' };
  });

  try {
    await assert.rejects(
      () =>
        createFeeParticular(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              name: '  Tuition   FEE  ',
              type: 'CHARGE',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /particular name/.test(error.message),
    );
    assert.equal(capturedNormalizedName, 'tuition fee');
  } finally {
    restoreAcademic();
    restoreDuplicate();
  }
});

test('duplicate fee type names are rejected after case and spacing normalization', async () => {
  const restoreAcademic = patchAcademicSession();
  let capturedNormalizedName = '';
  const restoreDuplicate = patch(prisma.feeType as any, 'findFirst', async ({ where }: any) => {
    capturedNormalizedName = where.normalizedName;
    return { id: 'existing-type' };
  });

  try {
    await assert.rejects(
      () =>
        createFeeType(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              name: '  monthly   fee ',
              schedule: 'MONTHLY',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /type name/.test(error.message),
    );
    assert.equal(capturedNormalizedName, 'monthly fee');
  } finally {
    restoreAcademic();
    restoreDuplicate();
  }
});

test('fee structure rejects zero and negative item amounts', async () => {
  for (const amount of [0, -10]) {
    await assert.rejects(
      () =>
        createFeeStructure(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              classId: CLASS_ID,
              feeTypeId: FEE_TYPE_ID,
              items: [{ particularId: PARTICULAR_ID, amount }],
            },
          }),
          makeRes(),
        ),
      (error: unknown) => /Amount must be greater than 0/.test(String(error)),
    );
  }
});

test('fee structure accepts positive item amount', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreClass = patch(prisma.class as any, 'findFirst', async () => ({ id: CLASS_ID }));
  const restoreFeeType = patch(prisma.feeType as any, 'findFirst', async () => ({ id: FEE_TYPE_ID, status: 'ACTIVE' }));
  const restoreParticulars = patch(prisma.feeParticular as any, 'findMany', async () => [{ id: PARTICULAR_ID }]);
  let capturedData: any;
  const restoreCreate = patch(prisma.feeStructure as any, 'create', async ({ data }: any) => {
    capturedData = data;
    return { id: STRUCTURE_ID, ...data, items: data.items.create };
  });
  const res = makeRes();

  try {
    await createFeeStructure(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          classId: CLASS_ID,
          feeTypeId: FEE_TYPE_ID,
          items: [{ particularId: PARTICULAR_ID, amount: 100 }],
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(String(capturedData.items.create[0].amount), '100');
  } finally {
    restoreAcademic();
    restoreClass();
    restoreFeeType();
    restoreParticulars();
    restoreCreate();
  }
});

test('concurrent invoice sequence generation is unique per school and year', async () => {
  const client = createNumberSequenceClient();
  const numbers = await Promise.all([
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'INVOICE', year: 2026, prefix: 'INV' }, client),
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'INVOICE', year: 2026, prefix: 'INV' }, client),
  ]);

  assert.deepEqual(numbers.sort(), ['INV-2026-000001', 'INV-2026-000002']);
});

test('concurrent payment and receipt sequence generation is unique per school and year', async () => {
  const client = createNumberSequenceClient();
  const [paymentOne, paymentTwo, receiptOne, receiptTwo] = await Promise.all([
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'PAYMENT', year: 2026, prefix: 'PAY' }, client),
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'PAYMENT', year: 2026, prefix: 'PAY' }, client),
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'RECEIPT', year: 2026, prefix: 'RCP' }, client),
    getNextNumber({ schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, type: 'RECEIPT', year: 2026, prefix: 'RCP' }, client),
  ]);

  assert.deepEqual([paymentOne, paymentTwo].sort(), ['PAY-2026-000001', 'PAY-2026-000002']);
  assert.deepEqual([receiptOne, receiptTwo].sort(), ['RCP-2026-000001', 'RCP-2026-000002']);
});

test('fee collection lookup is scoped by school and academic session', async () => {
  const restoreAcademic = patchAcademicSession();
  let capturedWhere: any;
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      $queryRaw: async () => [],
      feeInvoice: {
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [];
        },
      },
    }),
  );

  try {
    await assert.rejects(
      () =>
        collectFeePayment(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              amount: 10,
              paymentMode: 'CASH',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 404,
    );
    assert.equal(capturedWhere.schoolId, SCHOOL_ID);
    assert.equal(capturedWhere.academicSessionId, SESSION_ID);
  } finally {
    restoreTransaction();
    restoreAcademic();
  }
});

const patchAssignmentBase = () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStructure = patch(prisma.feeStructure as any, 'findFirst', async () => ({
    id: STRUCTURE_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    status: 'ACTIVE',
    deletedAt: null,
  }));
  const restoreClass = patch(prisma.class as any, 'findFirst', async () => ({ id: CLASS_ID, schoolId: SCHOOL_ID }));
  const restoreSection = patch(prisma.section as any, 'findFirst', async () => ({ id: SECTION_ID, schoolId: SCHOOL_ID, classId: CLASS_ID }));
  const restoreGroup = patch(prisma.studentGroup as any, 'findFirst', async () => ({ id: GROUP_ID, schoolId: SCHOOL_ID }));
  const restoreCategory = patch(prisma.studentCategory as any, 'findFirst', async () => ({ id: CATEGORY_ID, schoolId: SCHOOL_ID }));
  const restoreRoute = patch(prisma.transportRoute as any, 'findFirst', async () => ({ id: ROUTE_ID, schoolId: SCHOOL_ID }));
  return () => {
    restoreRoute();
    restoreCategory();
    restoreGroup();
    restoreSection();
    restoreClass();
    restoreStructure();
    restoreAcademic();
  };
};

test('fee assignment supports class, section, student, group, and category targets', async () => {
  const restoreBase = patchAssignmentBase();
  const restoreDuplicate = patch(prisma.studentFeeAssignment as any, 'findFirst', async () => null);
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: CLASS_ID, sectionId: SECTION_ID, studentGroupId: GROUP_ID, studentCategoryId: CATEGORY_ID, fullName: 'Student A', admissionNo: 'A001' },
  ]);
  const restoreTransport = patchNoTransportAssignments();
  const createdTargets: string[] = [];
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      studentFeeAssignment: {
        create: async ({ data }: any) => {
          createdTargets.push(data.targetType);
          return { id: `assignment-${createdTargets.length}`, ...data, feeStructureId: STRUCTURE_ID, assignedAt: new Date(), status: data.status ?? 'ACTIVE' };
        },
      },
    }),
  );
  const cases = [
    { targetType: 'CLASS', classId: CLASS_ID },
    { targetType: 'SECTION', classId: CLASS_ID, sectionId: SECTION_ID },
    { targetType: 'STUDENT', studentId: STUDENT_ID },
    { targetType: 'GROUP', groupId: GROUP_ID },
    { targetType: 'CATEGORY', categoryId: CATEGORY_ID },
  ];

  try {
    for (const item of cases) {
      const res = makeRes();
      await assignStudentFees(
        makeReq({
          body: {
            academicSessionId: SESSION_ID,
            feeStructureId: STRUCTURE_ID,
            startMonth: '2026-06',
            ...item,
          },
        }),
        res,
      );
      assert.equal(res.statusCode, 201);
      assert.equal(res.payload.assigned, 1);
    }
    assert.deepEqual(createdTargets, ['CLASS', 'SECTION', 'STUDENT', 'GROUP', 'CATEGORY']);
  } finally {
    restoreTransaction();
    restoreTransport();
    restoreStudents();
    restoreDuplicate();
    restoreBase();
  }
});

test('fee assignment rejects duplicate active assignment for same target and structure', async () => {
  const restoreBase = patchAssignmentBase();
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: CLASS_ID },
  ]);
  const restoreDuplicate = patch(prisma.studentFeeAssignment as any, 'findFirst', async () => ({ id: 'assignment-existing' }));

  try {
    await assert.rejects(
      () =>
        assignStudentFees(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              feeStructureId: STRUCTURE_ID,
              targetType: 'CLASS',
              classId: CLASS_ID,
              startMonth: '2026-06',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /Duplicate active assignment/.test(error.message),
    );
  } finally {
    restoreDuplicate();
    restoreStudents();
    restoreBase();
  }
});

test('fee assignment student matching excludes inactive, transferred, and disabled students', async () => {
  const restoreBase = patchAssignmentBase();
  const restoreDuplicate = patch(prisma.studentFeeAssignment as any, 'findFirst', async () => null);
  let capturedWhere: any;
  const restoreStudents = patch(prisma.student as any, 'findMany', async ({ where }: any) => {
    capturedWhere = where;
    return [{ id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: CLASS_ID }];
  });
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({ studentFeeAssignment: { create: async ({ data }: any) => ({ id: 'assignment-active-only', ...data }) } }),
  );

  try {
    const res = makeRes();
    await assignStudentFees(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          feeStructureId: STRUCTURE_ID,
          targetType: 'CLASS',
          classId: CLASS_ID,
          startMonth: '2026-06',
        },
      }),
      res,
    );
    assert.equal(capturedWhere.schoolId, SCHOOL_ID);
    assert.equal(capturedWhere.academicSessionId, SESSION_ID);
    assert.equal(capturedWhere.status, 'ENROLLED');
    assert.equal(res.payload.assigned, 1);
  } finally {
    restoreTransaction();
    restoreStudents();
    restoreDuplicate();
    restoreBase();
  }
});

test('fee assignment list returns accurate assigned and unassigned students', async () => {
  const restoreAcademic = patchAcademicSession();
  const assignedStudentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const unassignedStudentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const restoreAssignments = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [
    {
      id: 'assignment-class',
      schoolId: SCHOOL_ID,
      academicSessionId: SESSION_ID,
      targetType: 'CLASS',
      classId: CLASS_ID,
      sectionId: null,
      studentId: null,
      groupId: null,
      categoryId: null,
      transportRouteId: null,
      status: 'ACTIVE',
      deletedAt: null,
      assignedAt: new Date('2026-06-01'),
      feeStructure: { id: STRUCTURE_ID, name: 'Class Fee', items: [] },
    },
  ]);
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: assignedStudentId, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: CLASS_ID, sectionId: SECTION_ID, studentGroupId: null, studentCategoryId: null, fullName: 'Assigned Student', admissionNo: 'A001' },
    { id: unassignedStudentId, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', sectionId: null, studentGroupId: null, studentCategoryId: null, fullName: 'Unassigned Student', admissionNo: 'A002' },
  ]);
  const restoreTransport = patchNoTransportAssignments();
  const res = makeRes();

  try {
    await listFeeAssignments(makeReq({ query: { academicSessionId: SESSION_ID } }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.items.length, 1);
    assert.deepEqual(res.payload.assignedStudents.map((student: any) => student.id), [assignedStudentId]);
    assert.deepEqual(res.payload.unassignedStudents.map((student: any) => student.id), [unassignedStudentId]);
  } finally {
    restoreTransport();
    restoreStudents();
    restoreAssignments();
    restoreAcademic();
  }
});

test('invoice generation creates a scoped invoice and ledger row', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    fullName: 'Student A',
  }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, fullName: 'Student A' },
  ]);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-1',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async () => null);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(25) },
  }));
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => []);
  let capturedInvoiceData: any;
  let capturedLedgerData: any;
  const tx = {
    numberSequence: createNumberSequenceClient().numberSequence,
    feeInvoice: {
      create: async ({ data }: any) => {
        capturedInvoiceData = data;
        return { ...data, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoiceNumber: data.invoiceNumber, items: [], payments: [], receipts: [] };
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        capturedLedgerData = data;
        return { ...data, id: 'ledger-1' };
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await generateFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentId: STUDENT_ID,
          feeMonth: 'June 2026',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.generated.length, 1);
    assert.equal(res.payload.generatedCount, 1);
    assert.equal(res.payload.skippedDuplicateCount, 0);
    assert.equal(res.payload.failedCount, 0);
    assert.deepEqual(res.payload.invoiceIds, ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
    assert.equal(capturedInvoiceData.schoolId, SCHOOL_ID);
    assert.equal(capturedInvoiceData.academicSessionId, SESSION_ID);
    assert.equal(capturedInvoiceData.studentId, STUDENT_ID);
    assert.equal(capturedInvoiceData.feeStructureId, STRUCTURE_ID);
    assert.equal(capturedInvoiceData.feeTypeId, FEE_TYPE_ID);
    assert.equal(capturedInvoiceData.totalAmount.toString(), '100');
    assert.equal(capturedInvoiceData.dueAmount.toString(), '100');
    assert.equal(capturedLedgerData.schoolId, SCHOOL_ID);
    assert.equal(capturedLedgerData.academicSessionId, SESSION_ID);
    assert.equal(capturedLedgerData.type, 'INVOICE_DEBIT');
    assert.equal(capturedLedgerData.debitAmount.toString(), '100');
    assert.equal(capturedLedgerData.balanceAfter.toString(), '100');
  } finally {
    restoreTransaction();
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreInvoiceLookup();
    restoreAssignment();
    restoreTransportAssignments();
    restoreStudents();
    restoreStudent();
    restoreAcademic();
  }
});

test('student-specific fee assignment overrides class assignment amount during invoice generation', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    fullName: 'Student A',
  }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, status: 'ENROLLED', classId: CLASS_ID, sectionId: SECTION_ID, studentGroupId: null, studentCategoryId: null, fullName: 'Student A' },
  ]);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const feeStructure = {
    id: STRUCTURE_ID,
    feeTypeId: FEE_TYPE_ID,
    name: 'Default Class Fee',
    items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
  };
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [
    {
      id: 'assignment-class',
      targetType: 'CLASS',
      classId: CLASS_ID,
      studentId: null,
      overrideAmount: null,
      startMonth: '2026-06',
      endMonth: null,
      assignedAt: new Date('2026-06-01'),
      feeStructure,
    },
    {
      id: 'assignment-student',
      targetType: 'STUDENT',
      studentId: STUDENT_ID,
      overrideAmount: new Prisma.Decimal(60),
      startMonth: '2026-06',
      endMonth: null,
      assignedAt: new Date('2026-06-02'),
      feeStructure,
    },
  ]);
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async () => null);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(0) },
  }));
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => []);
  let capturedInvoiceData: any;
  const tx = {
    numberSequence: createNumberSequenceClient().numberSequence,
    feeInvoice: {
      create: async ({ data }: any) => {
        capturedInvoiceData = data;
        return { ...data, id: 'invoice-override', invoiceNumber: data.invoiceNumber, items: [], payments: [], receipts: [] };
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: 'ledger-override' }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await generateFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentId: STUDENT_ID,
          feeMonth: '2026-06',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(capturedInvoiceData.totalAmount.toString(), '60');
    assert.equal(capturedInvoiceData.dueAmount.toString(), '60');
    assert.equal(capturedInvoiceData.items.create[0].name, 'Default Class Fee (Override amount)');
    assert.equal(capturedInvoiceData.items.create[0].amount.toString(), '60');
  } finally {
    restoreTransaction();
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreInvoiceLookup();
    restoreAssignment();
    restoreTransportAssignments();
    restoreStudents();
    restoreStudent();
    restoreAcademic();
  }
});

test('invoice generation applies approved current discounts by target and caps discount amount', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    fullName: 'Student A',
  }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, fullName: 'Student A' },
  ]);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-1',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async () => null);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(25) },
  }));
  let discountWhere: any;
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async ({ where }: any) => {
    discountWhere = where;
    return [
      { valueType: 'PERCENTAGE', value: new Prisma.Decimal(50), amount: null },
      { valueType: 'FIXED', value: new Prisma.Decimal(30), amount: null },
    ];
  });
  let capturedInvoiceData: any;
  const tx = {
    numberSequence: createNumberSequenceClient().numberSequence,
    feeInvoice: {
      create: async ({ data }: any) => {
        capturedInvoiceData = data;
        return { ...data, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoiceNumber: data.invoiceNumber, items: [], payments: [], receipts: [] };
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: 'ledger-discounted' }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await generateFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentId: STUDENT_ID,
          feeMonth: 'June 2026',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.deepEqual(discountWhere.approvalStatus.in, ['APPROVED', 'ACTIVE']);
    assert.ok(discountWhere.OR.some((item: any) => item.targetType === 'STUDENT' && item.studentId === STUDENT_ID));
    assert.ok(discountWhere.OR.some((item: any) => item.targetType === 'CLASS' && item.classId === CLASS_ID));
    assert.ok(discountWhere.AND.some((item: any) => item.OR?.some((condition: any) => condition.validFrom?.lte)));
    assert.ok(discountWhere.AND.some((item: any) => item.OR?.some((condition: any) => condition.validTo?.gte)));
    assert.equal(capturedInvoiceData.discountAmount.toString(), '80');
    assert.equal(capturedInvoiceData.totalAmount.toString(), '100');
    assert.equal(capturedInvoiceData.dueAmount.toString(), '20');
  } finally {
    restoreTransaction();
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreInvoiceLookup();
    restoreAssignment();
    restoreTransportAssignments();
    restoreStudents();
    restoreStudent();
    restoreAcademic();
  }
});

test('duplicate invoice generation is skipped for the same student, structure, type, and month', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    fullName: 'Student A',
  }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, fullName: 'Student A' },
  ]);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-1',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoice = patch(prisma.feeInvoice as any, 'findFirst', async () => ({
    id: 'invoice-1',
    invoiceNumber: 'INV-2026-000001',
  }));
  const res = makeRes();

  try {
    await generateFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentId: STUDENT_ID,
          feeMonth: 'June 2026',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.generated.length, 0);
    assert.equal(res.payload.generatedCount, 0);
    assert.equal(res.payload.skippedDuplicateCount, 1);
    assert.equal(res.payload.failedCount, 0);
    assert.deepEqual(res.payload.invoiceIds, []);
    assert.match(res.payload.skipped[0].reason, /already exists/);
  } finally {
    restoreInvoice();
    restoreAssignment();
    restoreTransportAssignments();
    restoreStudents();
    restoreStudent();
    restoreAcademic();
  }
});

test('concurrent duplicate invoice generation is handled as skipped after unique conflict', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({
    id: STUDENT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    fullName: 'Student A',
  }));
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => [
    { id: STUDENT_ID, schoolId: SCHOOL_ID, academicSessionId: SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, fullName: 'Student A' },
  ]);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const restoreAssignment = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'assignment-1',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure: {
      id: STRUCTURE_ID,
      feeTypeId: FEE_TYPE_ID,
      items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
    },
  }]);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(0) },
  }));
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => []);
  let duplicateLookupCount = 0;
  let createAttempts = 0;
  let createdInvoice: any = null;
  const restoreInvoiceLookup = patch(prisma.feeInvoice as any, 'findFirst', async ({ where }: any) => {
    if (where?.feeStructureId === STRUCTURE_ID && where?.feeTypeId === FEE_TYPE_ID && where?.feeMonth === 'June 2026') {
      duplicateLookupCount += 1;
      return duplicateLookupCount <= 2 ? null : createdInvoice;
    }
    return null;
  });
  const tx = {
    numberSequence: createNumberSequenceClient().numberSequence,
    feeInvoice: {
      create: async ({ data }: any) => {
        createAttempts += 1;
        if (createAttempts === 1) {
          createdInvoice = { ...data, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', invoiceNumber: data.invoiceNumber, items: [], payments: [], receipts: [] };
          return createdInvoice;
        }
        throw feeInvoicePeriodUniqueError();
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: `ledger-${createAttempts}` }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const first = makeRes();
  const second = makeRes();
  const body = {
    academicSessionId: SESSION_ID,
    target: 'STUDENT',
    studentId: STUDENT_ID,
    feeMonth: 'June 2026',
    dueDate: '2026-06-30',
  };

  try {
    await Promise.all([
      generateFeeInvoices(makeReq({ body }), first),
      generateFeeInvoices(makeReq({ body }), second),
    ]);
    const responses = [first.payload, second.payload];
    assert.equal(createAttempts, 2);
    assert.equal(responses.reduce((sum, payload) => sum + payload.generatedCount, 0), 1);
    assert.equal(responses.reduce((sum, payload) => sum + payload.skippedDuplicateCount, 0), 1);
    assert.deepEqual(responses.flatMap((payload) => payload.invoiceIds), ['cccccccc-cccc-4ccc-8ccc-cccccccccccc']);
  } finally {
    restoreTransaction();
    restoreInvoiceLookup();
    restoreDiscounts();
    restoreInvoiceAggregate();
    restoreAssignment();
    restoreTransportAssignments();
    restoreStudents();
    restoreStudent();
    restoreAcademic();
  }
});

test('bulk invoice generation preloads data for 500 students and preserves calculations', async () => {
  const restoreAcademic = patchAcademicSession();
  const activeStudents = Array.from({ length: 500 }, (_, index) => {
    const suffix = String(index + 1).padStart(12, '0');
    return {
      id: `00000000-0000-4000-8000-${suffix}`,
      schoolId: SCHOOL_ID,
      academicSessionId: SESSION_ID,
      status: 'ENROLLED',
      classId: CLASS_ID,
      sectionId: SECTION_ID,
      studentGroupId: null,
      studentCategoryId: null,
      fullName: `Bulk Student ${index + 1}`,
      admissionNo: `B${index + 1}`,
      parentEmail: null,
      email: null,
    };
  });
  const inactiveIds = ['00000000-0000-4000-8001-999999999991', '00000000-0000-4000-8001-999999999992'];
  const requestedIds = [...activeStudents.map((student) => student.id), ...inactiveIds];
  const feeStructure = {
    id: STRUCTURE_ID,
    feeTypeId: FEE_TYPE_ID,
    name: 'Bulk Class Fee',
    items: [{ particularId: PARTICULAR_ID, amount: new Prisma.Decimal(100), sortOrder: 1, particular: { name: 'Tuition Fee' } }],
  };
  const duplicateRows = activeStudents.slice(0, 5).map((student, index) => ({
    id: `duplicate-${index + 1}`,
    invoiceNumber: `INV-2026-DUP${index + 1}`,
    studentId: student.id,
    feeStructureId: STRUCTURE_ID,
    feeTypeId: FEE_TYPE_ID,
  }));
  const previousBalanceStudentId = activeStudents[10].id;
  const restoreStudents = patch(prisma.student as any, 'findMany', async () => activeStudents);
  const restoreTransportAssignments = patchNoTransportAssignments();
  const restoreAssignments = patch(prisma.studentFeeAssignment as any, 'findMany', async () => [{
    id: 'bulk-class-assignment',
    targetType: 'CLASS',
    classId: CLASS_ID,
    sectionId: null,
    studentId: null,
    groupId: null,
    categoryId: null,
    transportRouteId: null,
    status: 'ACTIVE',
    deletedAt: null,
    overrideAmount: null,
    startMonth: '2026-06',
    endMonth: null,
    assignedAt: new Date('2026-06-01'),
    feeStructure,
  }]);
  const restoreInvoiceFindMany = patch(prisma.feeInvoice as any, 'findMany', async () => duplicateRows);
  const restoreInvoiceFindFirst = patch(prisma.feeInvoice as any, 'findFirst', async ({ where }: any) => duplicateRows.find((row) =>
    row.studentId === where?.studentId &&
    row.feeStructureId === where?.feeStructureId &&
    row.feeTypeId === where?.feeTypeId &&
    where?.feeMonth === '2026-06',
  ) ?? null);
  const restoreInvoiceGroupBy = patch(prisma.feeInvoice as any, 'groupBy', async () => [
    { studentId: previousBalanceStudentId, _sum: { dueAmount: new Prisma.Decimal(25) } },
  ]);
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => [
    { targetType: 'ALL', valueType: 'FIXED', value: new Prisma.Decimal(5), amount: null, feeTypeId: null },
  ]);
  const restoreFines = patch(prisma.feeFine as any, 'findMany', async () => []);
  const createdInvoices: any[] = [];
  const ledgerEntries: any[] = [];
  const sequenceClient = createNumberSequenceClient();
  const tx = {
    numberSequence: sequenceClient.numberSequence,
    feeInvoice: {
      create: async ({ data }: any) => {
        const invoice = { ...data, id: `bulk-invoice-${createdInvoices.length + 1}`, invoiceNumber: data.invoiceNumber, items: [], payments: [], receipts: [] };
        createdInvoices.push(invoice);
        return invoice;
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        ledgerEntries.push(data);
        return { ...data, id: `bulk-ledger-${ledgerEntries.length}` };
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await generateFeeInvoices(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          target: 'STUDENT',
          studentIds: requestedIds,
          feeMonth: '2026-06',
          dueDate: '2026-06-30',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.payload.totalStudents, 502);
    assert.equal(res.payload.eligibleStudents, 495);
    assert.equal(res.payload.generatedCount, 495);
    assert.equal(res.payload.skippedDuplicateCount, 5);
    assert.equal(res.payload.skippedInactiveStudentCount, 2);
    assert.equal(res.payload.skippedNoAssignmentCount, 0);
    assert.equal(res.payload.failedCount, 0);
    assert.equal(createdInvoices.length, 495);
    assert.equal(new Set(createdInvoices.map((invoice) => invoice.invoiceNumber)).size, 495);
    assert.equal(createdInvoices[0].totalAmount.toString(), '100');
    assert.equal(createdInvoices[0].dueAmount.toString(), '95');
    const previousBalanceInvoice = createdInvoices.find((invoice) => invoice.studentId === previousBalanceStudentId);
    assert.equal(previousBalanceInvoice.totalAmount.toString(), '100');
    assert.equal(previousBalanceInvoice.dueAmount.toString(), '95');
    assert.equal(previousBalanceInvoice.previousBalance.toString(), '0');
    assert.equal(ledgerEntries.filter((entry) => entry.type === 'INVOICE_DEBIT').length, 495);
    assert.equal(ledgerEntries.filter((entry) => entry.type === 'DISCOUNT_CREDIT').length, 495);
    assert.ok(res.payload.durationMs >= 0);
  } finally {
    restoreTransaction();
    restoreFines();
    restoreDiscounts();
    restoreInvoiceGroupBy();
    restoreInvoiceFindFirst();
    restoreInvoiceFindMany();
    restoreAssignments();
    restoreTransportAssignments();
    restoreStudents();
    restoreAcademic();
  }
});

test('fee collection rejects overpayment', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
    callback({
      $queryRaw: async () => [],
      feeInvoice: {
        findMany: async () => [{
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          schoolId: SCHOOL_ID,
          academicSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: 'ISSUED',
          totalAmount: new Prisma.Decimal(100),
          fineAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(100),
        }],
      },
    }),
  );

  try {
    await assert.rejects(
      () =>
        collectFeePayment(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              amount: 101,
              paymentMode: 'CASH',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Allocation cannot exceed/.test(error.message),
    );
  } finally {
    restoreTransaction();
    restoreAcademic();
  }
});

test('fee collection requires payment reference for non-cash transfer modes', async () => {
  await assert.rejects(
    () =>
      collectFeePayment(
        makeReq({
          body: {
            academicSessionId: SESSION_ID,
            invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            amount: 100,
            paymentMode: 'UPI',
          },
        }),
        makeRes(),
      ),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /requires a transaction reference/.test(error.message),
  );
});

test('fee collection collects multiple invoices in one receipt with partial and full allocations', async () => {
  const restoreAcademic = patchAcademicSession();
  const invoiceOneId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const invoiceTwoId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const storedInvoices = new Map<string, any>([
    [
      invoiceOneId,
      {
        id: invoiceOneId,
        schoolId: SCHOOL_ID,
        academicSessionId: SESSION_ID,
        studentId: STUDENT_ID,
        invoiceNumber: 'INV-2026-000001',
        status: 'ISSUED',
        totalAmount: new Prisma.Decimal(100),
        fineAmount: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(100),
      },
    ],
    [
      invoiceTwoId,
      {
        id: invoiceTwoId,
        schoolId: SCHOOL_ID,
        academicSessionId: SESSION_ID,
        studentId: STUDENT_ID,
        invoiceNumber: 'INV-2026-000002',
        status: 'ISSUED',
        totalAmount: new Prisma.Decimal(50),
        fineAmount: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(50),
      },
    ],
  ]);
  let paymentCreateCount = 0;
  let receiptCreateCount = 0;
  let allocationCreateCount = 0;
  let ledgerCreateCount = 0;
  const sequenceClient = createNumberSequenceClient();
  const tx = {
    $queryRaw: async () => [],
    numberSequence: sequenceClient.numberSequence,
    feeInvoice: {
      findMany: async ({ where }: any) => where.id.in.map((id: string) => ({ ...storedInvoices.get(id) })),
      update: async ({ where, data }: any) => {
        const current = storedInvoices.get(where.id);
        const updated = { ...current, ...data, items: [], payments: [], receipts: [] };
        storedInvoices.set(where.id, updated);
        return updated;
      },
    },
    feePayment: {
      create: async ({ data }: any) => {
        paymentCreateCount += 1;
        return { ...data, id: 'payment-multi' };
      },
    },
    feePaymentAllocation: {
      create: async ({ data }: any) => {
        allocationCreateCount += 1;
        return { ...data, id: `allocation-${allocationCreateCount}` };
      },
    },
    feeReceipt: {
      create: async ({ data }: any) => {
        receiptCreateCount += 1;
        return { ...data, id: 'receipt-multi' };
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        ledgerCreateCount += 1;
        return { ...data, id: `ledger-${ledgerCreateCount}` };
      },
    },
    feeNotification: {
      create: async ({ data }: any) => ({ ...data, id: 'notification-multi' }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await collectFeePayment(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          amount: 90,
          paymentDate: '2026-06-06',
          paymentMode: 'CASH',
          allocations: [
            { invoiceId: invoiceOneId, amount: 40 },
            { invoiceId: invoiceTwoId, amount: 50 },
          ],
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(paymentCreateCount, 1);
    assert.equal(receiptCreateCount, 1);
    assert.equal(allocationCreateCount, 2);
    assert.equal(ledgerCreateCount, 2);
    assert.equal(storedInvoices.get(invoiceOneId).paidAmount.toString(), '40');
    assert.equal(storedInvoices.get(invoiceOneId).dueAmount.toString(), '60');
    assert.equal(storedInvoices.get(invoiceOneId).status, 'PARTIALLY_PAID');
    assert.equal(storedInvoices.get(invoiceTwoId).paidAmount.toString(), '50');
    assert.equal(storedInvoices.get(invoiceTwoId).dueAmount.toString(), '0');
    assert.equal(storedInvoices.get(invoiceTwoId).status, 'PAID');
    assert.equal(res.payload.receipt.id, 'receipt-multi');
    assert.equal(res.payload.allocations.length, 2);
  } finally {
    restoreTransaction();
    restoreAcademic();
  }
});

test('fee collection rejects cheque without cheque number and bank name', async () => {
  await assert.rejects(
    () =>
      collectFeePayment(
        makeReq({
          body: {
            academicSessionId: SESSION_ID,
            invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            amount: 100,
            paymentMode: 'CHEQUE',
          },
        }),
        makeRes(),
      ),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /cheque number and bank/.test(error.message),
  );
});

test('fee collection rejects cancelled and paid invoice allocations', async () => {
  const restoreAcademic = patchAcademicSession();
  const runCase = async (status: string, expected: RegExp) => {
    const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) =>
      callback({
        $queryRaw: async () => [],
        feeInvoice: {
          findMany: async () => [
            {
              id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              schoolId: SCHOOL_ID,
              academicSessionId: SESSION_ID,
              studentId: STUDENT_ID,
              status,
              totalAmount: new Prisma.Decimal(100),
              fineAmount: new Prisma.Decimal(0),
              discountAmount: new Prisma.Decimal(0),
              paidAmount: status === 'PAID' ? new Prisma.Decimal(100) : new Prisma.Decimal(0),
              dueAmount: status === 'PAID' ? new Prisma.Decimal(0) : new Prisma.Decimal(100),
            },
          ],
        },
      }),
    );
    try {
      await assert.rejects(
        () =>
          collectFeePayment(
            makeReq({
              body: {
                academicSessionId: SESSION_ID,
                studentId: STUDENT_ID,
                amount: 100,
                paymentMode: 'CASH',
                allocations: [{ invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', amount: 100 }],
              },
            }),
            makeRes(),
          ),
        (error: unknown) => error instanceof HttpError && error.statusCode === 409 && expected.test(error.message),
      );
    } finally {
      restoreTransaction();
    }
  };

  try {
    await runCase('CANCELLED', /cancelled invoice/);
    await runCase('PAID', /already paid/);
  } finally {
    restoreAcademic();
  }
});

test('concurrent fee collection cannot overpay the same invoice', async () => {
  const restoreAcademic = patchAcademicSession();
  let storedInvoice: any = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    status: 'ISSUED',
    totalAmount: new Prisma.Decimal(100),
    fineAmount: new Prisma.Decimal(0),
    discountAmount: new Prisma.Decimal(0),
    paidAmount: new Prisma.Decimal(0),
    dueAmount: new Prisma.Decimal(100),
  };
  let paymentCreateCount = 0;
  let receiptCreateCount = 0;
  let allocationCreateCount = 0;
  let ledgerCreateCount = 0;
  let transactionChain = Promise.resolve();
  const sequenceClient = createNumberSequenceClient();
  const tx = {
    $queryRaw: async () => [],
    numberSequence: sequenceClient.numberSequence,
    feeInvoice: {
      findMany: async () => [{ ...storedInvoice }],
      update: async ({ data }: any) => {
        storedInvoice = { ...storedInvoice, ...data };
        return { ...storedInvoice, items: [], payments: [], receipts: [] };
      },
    },
    feePayment: {
      create: async ({ data }: any) => {
        paymentCreateCount += 1;
        return { ...data, id: `payment-${paymentCreateCount}` };
      },
    },
    feePaymentAllocation: {
      create: async ({ data }: any) => {
        allocationCreateCount += 1;
        return { ...data, id: `allocation-${allocationCreateCount}` };
      },
    },
    feeReceipt: {
      create: async ({ data }: any) => {
        receiptCreateCount += 1;
        return { ...data, id: `receipt-${receiptCreateCount}` };
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        ledgerCreateCount += 1;
        return { ...data, id: `ledger-${ledgerCreateCount}` };
      },
    },
    feeNotification: {
      create: async ({ data }: any) => ({ ...data, id: 'notification-1' }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => {
    const previous = transactionChain;
    let release!: () => void;
    transactionChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await callback(tx);
    } finally {
      release();
    }
  });
  const body = {
    academicSessionId: SESSION_ID,
    invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    amount: 100,
    paymentMode: 'CASH',
  };

  try {
    const results = await Promise.allSettled([
      collectFeePayment(makeReq({ body }), makeRes()),
      collectFeePayment(makeReq({ body }), makeRes()),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof HttpError);
    assert.equal(storedInvoice.paidAmount.toString(), '100');
    assert.equal(storedInvoice.dueAmount.toString(), '0');
    assert.equal(paymentCreateCount, 1);
    assert.equal(receiptCreateCount, 1);
    assert.equal(allocationCreateCount, 1);
    assert.equal(ledgerCreateCount, 1);
  } finally {
    restoreTransaction();
    restoreAcademic();
  }
});

test('fee collection returns existing payment for duplicate idempotency key submit', async () => {
  const restoreAcademic = patchAcademicSession();
  let storedInvoice: any = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    status: 'ISSUED',
    totalAmount: new Prisma.Decimal(100),
    fineAmount: new Prisma.Decimal(0),
    discountAmount: new Prisma.Decimal(0),
    paidAmount: new Prisma.Decimal(0),
    dueAmount: new Prisma.Decimal(100),
  };
  let storedPayment: any = null;
  let storedReceipt: any = null;
  let storedAllocation: any = null;
  let paymentCreateCount = 0;
  let receiptCreateCount = 0;
  let allocationCreateCount = 0;
  let ledgerCreateCount = 0;
  const sequenceClient = createNumberSequenceClient();
  const tx = {
    $queryRaw: async () => [],
    numberSequence: sequenceClient.numberSequence,
    feePayment: {
      findFirst: async ({ where }: any) => {
        if (where?.schoolId === SCHOOL_ID && where?.idempotencyKey === 'collect-once' && storedPayment) {
          return {
            ...storedPayment,
            receipt: storedReceipt,
            invoice: { ...storedInvoice, items: [], payments: [storedPayment], receipts: [storedReceipt] },
            allocations: [{ ...storedAllocation, invoice: { ...storedInvoice, items: [], payments: [storedPayment], receipts: [storedReceipt] } }],
          };
        }
        return null;
      },
      create: async ({ data }: any) => {
        paymentCreateCount += 1;
        storedPayment = { ...data, id: 'payment-1' };
        return storedPayment;
      },
    },
    feeInvoice: {
      findMany: async () => [{ ...storedInvoice }],
      update: async ({ data }: any) => {
        storedInvoice = { ...storedInvoice, ...data };
        return { ...storedInvoice, items: [], payments: [storedPayment], receipts: [] };
      },
    },
    feePaymentAllocation: {
      create: async ({ data }: any) => {
        allocationCreateCount += 1;
        storedAllocation = { ...data, id: 'allocation-1' };
        return storedAllocation;
      },
    },
    feeReceipt: {
      create: async ({ data }: any) => {
        receiptCreateCount += 1;
        storedReceipt = { ...data, id: 'receipt-1' };
        return storedReceipt;
      },
    },
    feeLedger: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        ledgerCreateCount += 1;
        return { ...data, id: 'ledger-1' };
      },
    },
    feeNotification: {
      create: async ({ data }: any) => ({ ...data, id: 'notification-1' }),
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const first = makeRes();
  const second = makeRes();
  const body = {
    academicSessionId: SESSION_ID,
    invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    amount: 100,
    paymentMode: 'CASH',
    idempotencyKey: 'collect-once',
  };

  try {
    await collectFeePayment(makeReq({ body }), first);
    await collectFeePayment(makeReq({ body }), second);
    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 200);
    assert.equal(first.payload.idempotent, false);
    assert.equal(second.payload.idempotent, true);
    assert.equal(first.payload.payment.id, 'payment-1');
    assert.equal(second.payload.payment.id, 'payment-1');
    assert.equal(first.payload.receipt.id, 'receipt-1');
    assert.equal(second.payload.receipt.id, 'receipt-1');
    assert.equal(paymentCreateCount, 1);
    assert.equal(receiptCreateCount, 1);
    assert.equal(allocationCreateCount, 1);
    assert.equal(ledgerCreateCount, 1);
  } finally {
    restoreTransaction();
    restoreAcademic();
  }
});

test('central fee ledger balance increases by debit and decreases by credit', async () => {
  let latestBalance: Prisma.Decimal | null = null;
  const created: any[] = [];
  const tx = {
    feeLedger: {
      findFirst: async () => (latestBalance ? { balanceAfter: latestBalance } : null),
      create: async ({ data }: any) => {
        latestBalance = data.balanceAfter;
        created.push(data);
        return { ...data, id: `ledger-${created.length}` };
      },
    },
  };

  await createLedgerEntry(tx as any, {
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    type: 'INVOICE_DEBIT',
    description: 'Invoice debit',
    debitAmount: 100,
    createdById: USER_ID,
  });
  await createLedgerEntry(tx as any, {
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    type: 'DISCOUNT_CREDIT',
    description: 'Discount credit',
    creditAmount: 10,
    createdById: USER_ID,
  });
  await createLedgerEntry(tx as any, {
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    type: 'PAYMENT_CREDIT',
    description: 'Payment credit',
    creditAmount: 50,
    createdById: USER_ID,
  });

  assert.deepEqual(created.map((item) => item.balanceAfter.toString()), ['100', '90', '40']);
});

test('approved student discount updates invoice due and creates a discount credit ledger entry', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(100) },
  }));
  const restoreDuplicate = patch(prisma.feeDiscount as any, 'findFirst', async () => null);
  let capturedInvoiceUpdate: any;
  let capturedLedgerData: any;
  const tx = {
    feeDiscount: {
      create: async ({ data }: any) => ({ ...data, id: DISCOUNT_ID }),
    },
    feeInvoice: {
      findFirst: async () => null,
      findMany: async () => [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          schoolId: SCHOOL_ID,
          academicSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: 'ISSUED',
          totalAmount: new Prisma.Decimal(100),
          discountAmount: new Prisma.Decimal(0),
          fineAmount: new Prisma.Decimal(0),
          paidAmount: new Prisma.Decimal(0),
          dueAmount: new Prisma.Decimal(100),
        },
      ],
      update: async ({ data }: any) => {
        capturedInvoiceUpdate = data;
        return { ...data, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
      },
    },
    feeLedger: {
      count: async () => 0,
      findFirst: async () => ({ balanceAfter: new Prisma.Decimal(100) }),
      create: async ({ data }: any) => {
        capturedLedgerData = data;
        return { ...data, id: 'ledger-discount' };
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await createFeeDiscount(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          discountType: 'SCHOLARSHIP',
          valueType: 'FIXED',
          value: 40,
          validFrom: '2026-06-01',
          approvalStatus: 'APPROVED',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(capturedInvoiceUpdate.discountAmount.toString(), '40');
    assert.equal(capturedInvoiceUpdate.dueAmount.toString(), '60');
    assert.equal(capturedLedgerData.type, 'DISCOUNT_CREDIT');
    assert.equal(capturedLedgerData.creditAmount.toString(), '40');
    assert.equal(capturedLedgerData.balanceAfter.toString(), '60');
  } finally {
    restoreTransaction();
    restoreDuplicate();
    restoreInvoiceAggregate();
    restoreStudent();
    restoreAcademic();
  }
});

test('discount lifecycle supports update, approval, rejection, and soft delete', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreInvoiceCount = patch(prisma.feeInvoice as any, 'count', async () => 0);
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(0) },
  }));
  let storedDiscount: any = {
    id: DISCOUNT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    discountName: 'Draft concession',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    classId: null,
    sectionId: null,
    categoryId: null,
    feeTypeId: null,
    particularId: null,
    discountType: 'SPECIAL_DISCOUNT',
    valueType: 'FIXED',
    value: new Prisma.Decimal(10),
    amount: null,
    validFrom: new Date('2026-06-01'),
    validTo: null,
    approvalStatus: 'PENDING_APPROVAL',
    approvedById: null,
    approvedAt: null,
    reason: null,
    note: null,
  };
  const restoreFindDiscount = patch(prisma.feeDiscount as any, 'findFirst', async ({ where }: any) => {
    if (where?.id === storedDiscount.id) return storedDiscount;
    return null;
  });
  const restoreRootUpdate = patch(prisma.feeDiscount as any, 'update', async ({ data }: any) => {
    storedDiscount = { ...storedDiscount, ...data };
    return storedDiscount;
  });
  const tx = {
    feeDiscount: {
      update: async ({ data }: any) => {
        storedDiscount = { ...storedDiscount, ...data };
        return storedDiscount;
      },
    },
    feeInvoice: {
      findFirst: async () => null,
      findMany: async () => [],
      update: async ({ data }: any) => data,
    },
    feeLedger: {
      count: async () => 0,
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));

  try {
    const updateRes = makeRes();
    await updateFeeDiscount(
      makeReq({
        params: { id: storedDiscount.id },
        body: {
          academicSessionId: SESSION_ID,
          discountName: 'Sibling concession',
          targetType: 'STUDENT',
          studentId: STUDENT_ID,
          discountType: 'FIXED',
          discountValue: 25,
          validFrom: '2026-06-01',
          status: 'PENDING_APPROVAL',
        },
      }),
      updateRes,
    );
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.payload.discountName, 'Sibling concession');
    assert.equal(updateRes.payload.value.toString(), '25');

    const approveRes = makeRes();
    await approveFeeDiscount(makeReq({ params: { id: storedDiscount.id }, query: { academicSessionId: SESSION_ID } }), approveRes);
    assert.equal(approveRes.statusCode, 200);
    assert.equal(approveRes.payload.approvalStatus, 'APPROVED');
    assert.equal(approveRes.payload.approvedById, USER_ID);
    assert.ok(approveRes.payload.approvedAt instanceof Date);

    const rejectRes = makeRes();
    await rejectFeeDiscount(makeReq({ params: { id: storedDiscount.id }, query: { academicSessionId: SESSION_ID }, body: { reason: 'Not eligible' } }), rejectRes);
    assert.equal(rejectRes.statusCode, 200);
    assert.equal(rejectRes.payload.approvalStatus, 'REJECTED');
    assert.equal(rejectRes.payload.reason, 'Not eligible');

    const deleteRes = makeRes();
    await deleteFeeDiscount(makeReq({ params: { id: storedDiscount.id }, query: { academicSessionId: SESSION_ID } }), deleteRes);
    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.payload.approvalStatus, 'INACTIVE');
    assert.ok(deleteRes.payload.deletedAt instanceof Date);
  } finally {
    restoreTransaction();
    restoreRootUpdate();
    restoreFindDiscount();
    restoreInvoiceAggregate();
    restoreInvoiceCount();
    restoreStudent();
    restoreAcademic();
  }
});

test('duplicate active discount is rejected for same target, fee type, and date range', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreDuplicate = patch(prisma.feeDiscount as any, 'findFirst', async () => ({ id: EXISTING_DISCOUNT_ID }));

  try {
    await assert.rejects(
      () =>
        createFeeDiscount(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              discountName: 'Annual waiver',
              targetType: 'ALL',
              discountType: 'FIXED',
              discountValue: 10,
              validFrom: '2026-06-01',
              validTo: '2026-06-30',
              status: 'ACTIVE',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /Duplicate active discount/.test(error.message),
    );
  } finally {
    restoreDuplicate();
    restoreAcademic();
  }
});

test('discount edit and delete are blocked after paid invoice usage', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const existingDiscount = {
    id: PAID_DISCOUNT_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    discountName: 'Paid invoice discount',
    targetType: 'STUDENT',
    studentId: STUDENT_ID,
    classId: null,
    sectionId: null,
    categoryId: null,
    feeTypeId: null,
    particularId: null,
    discountType: 'SPECIAL_DISCOUNT',
    valueType: 'FIXED',
    value: new Prisma.Decimal(10),
    amount: null,
    validFrom: new Date('2026-06-01'),
    validTo: null,
    approvalStatus: 'ACTIVE',
    approvedById: USER_ID,
    approvedAt: new Date('2026-06-01'),
    reason: null,
    note: null,
  };
  const restoreFindDiscount = patch(prisma.feeDiscount as any, 'findFirst', async () => existingDiscount);
  const restoreInvoiceCount = patch(prisma.feeInvoice as any, 'count', async () => 1);

  try {
    await assert.rejects(
      () =>
        updateFeeDiscount(
          makeReq({
            params: { id: existingDiscount.id },
            body: {
              academicSessionId: SESSION_ID,
              discountName: 'Changed',
              targetType: 'STUDENT',
              studentId: STUDENT_ID,
              discountType: 'FIXED',
              discountValue: 15,
              validFrom: '2026-06-01',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /paid or partially paid invoice/.test(error.message),
    );
    await assert.rejects(
      () => deleteFeeDiscount(makeReq({ params: { id: existingDiscount.id }, query: { academicSessionId: SESSION_ID } }), makeRes()),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /paid or partially paid invoice/.test(error.message),
    );
  } finally {
    restoreInvoiceCount();
    restoreFindDiscount();
    restoreStudent();
    restoreAcademic();
  }
});

test('accountant default permissions do not include fee discount review permissions', () => {
  const permissions = getDefaultPermissionCodes('ACCOUNTANT');

  assert.equal(resolvePermissionForPath('/api/v1/fees/discounts/abc/approve', 'PATCH'), 'fees.discounts.approve');
  assert.equal(resolvePermissionForPath('/api/v1/fees/discounts/abc/reject', 'PATCH'), 'fees.discounts.approve');
  assert.equal(permissions.includes('fees.discounts.approve'), false);
});

test('student fine application creates a fine debit ledger entry', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreInvoice = patch(prisma.feeInvoice as any, 'findFirst', async () => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    status: 'ISSUED',
    totalAmount: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(0),
    fineAmount: new Prisma.Decimal(0),
    paidAmount: new Prisma.Decimal(0),
    dueAmount: new Prisma.Decimal(100),
  }));
  let capturedInvoiceUpdate: any;
  let capturedLedgerData: any;
  const tx = {
    feeFine: {
      findFirst: async () => null,
      create: async ({ data }: any) => ({ ...data, id: 'fine-1' }),
    },
    feeInvoice: {
      update: async ({ data }: any) => {
        capturedInvoiceUpdate = data;
        return { ...data, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
      },
    },
    feeLedger: {
      findFirst: async () => ({ balanceAfter: new Prisma.Decimal(100) }),
      create: async ({ data }: any) => {
        capturedLedgerData = data;
        return { ...data, id: 'ledger-fine' };
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await createFeeFine(
      makeReq({
        body: {
          academicSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Late Payment Fine',
          fineType: 'FIXED',
          amount: 25,
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(capturedInvoiceUpdate.fineAmount.toString(), '25');
    assert.equal(capturedInvoiceUpdate.dueAmount.toString(), '125');
    assert.equal(capturedLedgerData.type, 'FINE_DEBIT');
    assert.equal(capturedLedgerData.debitAmount.toString(), '25');
    assert.equal(capturedLedgerData.balanceAfter.toString(), '125');
  } finally {
    restoreTransaction();
    restoreInvoice();
    restoreStudent();
    restoreAcademic();
  }
});

test('duplicate fine is blocked for the same invoice, name, and type', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreInvoice = patch(prisma.feeInvoice as any, 'findFirst', async () => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    status: 'ISSUED',
    totalAmount: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(0),
    fineAmount: new Prisma.Decimal(25),
    paidAmount: new Prisma.Decimal(0),
    dueAmount: new Prisma.Decimal(125),
  }));
  let createCalled = false;
  const tx = {
    feeFine: {
      findFirst: async () => ({ id: 'fine-existing' }),
      create: async () => {
        createCalled = true;
        throw new Error('duplicate fine should not be created');
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));

  try {
    await assert.rejects(
      () =>
        createFeeFine(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              studentId: STUDENT_ID,
              invoiceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              name: 'Late Payment Fine',
              fineType: 'FIXED',
              amount: 25,
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /Fine already applied/.test(error.message),
    );
    assert.equal(createCalled, false);
  } finally {
    restoreTransaction();
    restoreInvoice();
    restoreStudent();
    restoreAcademic();
  }
});

test('invoice cancellation creates a cancellation reversal ledger entry', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreInvoice = patch(prisma.feeInvoice as any, 'findFirst', async () => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    studentId: STUDENT_ID,
    invoiceNumber: 'INV-2026-000001',
    status: 'ISSUED',
    paidAmount: new Prisma.Decimal(0),
    dueAmount: new Prisma.Decimal(100),
    payments: [],
  }));
  let capturedLedgerData: any;
  const tx = {
    feeInvoice: {
      update: async ({ data }: any) => ({ ...data, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', items: [], payments: [], receipts: [] }),
    },
    feeLedger: {
      findFirst: async () => ({ balanceAfter: new Prisma.Decimal(100) }),
      create: async ({ data }: any) => {
        capturedLedgerData = data;
        return { ...data, id: 'ledger-cancel' };
      },
    },
  };
  const restoreTransaction = patch(prisma as any, '$transaction', async (callback: any) => callback(tx));
  const res = makeRes();

  try {
    await cancelFeeInvoice(
      makeReq({
        params: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        body: { academicSessionId: SESSION_ID, reason: 'Wrong billing period' },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(capturedLedgerData.type, 'CANCELLATION_REVERSAL');
    assert.equal(capturedLedgerData.creditAmount.toString(), '100');
    assert.equal(capturedLedgerData.balanceAfter.toString(), '0');
  } finally {
    restoreTransaction();
    restoreInvoice();
    restoreAcademic();
  }
});

test('student fee ledger applies filters, opening balance, pagination, and reference mapping', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreClass = patch(prisma.class as any, 'findFirst', async () => ({ id: CLASS_ID, schoolId: SCHOOL_ID }));
  const restoreSection = patch(prisma.section as any, 'findFirst', async () => ({ id: SECTION_ID, schoolId: SCHOOL_ID }));
  let capturedWhere: any;
  let capturedOrderBy: any;
  const restoreLedgers = patch(prisma.feeLedger as any, 'findMany', async ({ where, orderBy }: any) => {
    capturedWhere = where;
    capturedOrderBy = orderBy;
    return [
      makeLedgerRow({
        paymentId: 'payment-1',
        receiptId: 'receipt-1',
        type: 'PAYMENT_CREDIT',
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(50),
        balanceAfter: new Prisma.Decimal(50),
        payment: { id: 'payment-1', paymentNumber: 'PAY-2026-000001', receipt: { id: 'receipt-1', receiptNumber: 'RCP-2026-000001' } },
        receipt: { id: 'receipt-1', receiptNumber: 'RCP-2026-000001' },
      }),
    ];
  });
  const restoreCount = patch(prisma.feeLedger as any, 'count', async () => 1);
  const restoreOpening = patch(prisma.feeLedger as any, 'findFirst', async () => ({ balanceAfter: new Prisma.Decimal(25) }));
  const res = makeRes();

  try {
    await getStudentFeeLedger(
      makeReq({
        params: { studentId: STUDENT_ID },
        query: {
          academicSessionId: SESSION_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
          entryType: 'PAYMENT_CREDIT',
          page: '1',
          limit: '10',
          sortOrder: 'desc',
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(capturedWhere.schoolId, SCHOOL_ID);
    assert.equal(capturedWhere.academicSessionId, SESSION_ID);
    assert.equal(capturedWhere.studentId, STUDENT_ID);
    assert.equal(capturedWhere.type, 'PAYMENT_CREDIT');
    assert.equal(capturedWhere.student.classId, CLASS_ID);
    assert.equal(capturedWhere.student.sectionId, SECTION_ID);
    assert.equal(capturedWhere.createdAt.gte.toISOString().slice(0, 10), '2026-06-01');
    assert.equal(capturedWhere.createdAt.lte.toISOString().slice(0, 10), '2026-06-30');
    assert.deepEqual(capturedOrderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(res.payload.openingBalance.toString(), '25');
    assert.equal(res.payload.items[0].type, 'OPENING_BALANCE');
    assert.equal(res.payload.items[1].referenceReceiptNumber, 'RCP-2026-000001');
    assert.equal(res.payload.pagination.total, 1);
  } finally {
    restoreOpening();
    restoreCount();
    restoreLedgers();
    restoreSection();
    restoreClass();
    restoreStudent();
    restoreAcademic();
  }
});

test('student fee ledger PDF and Excel export endpoints return downloadable files', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreLedgers = patch(prisma.feeLedger as any, 'findMany', async () => [makeLedgerRow()]);
  const restoreCount = patch(prisma.feeLedger as any, 'count', async () => 1);
  const restoreOpening = patch(prisma.feeLedger as any, 'findFirst', async () => null);
  const excelRes = makeRes();
  const pdfRes = makeRes();

  try {
    await exportFeeLedgerExcel(
      makeReq({
        params: { studentId: STUDENT_ID },
        query: { academicSessionId: SESSION_ID },
      }),
      excelRes,
    );
    await exportFeeLedgerPdf(
      makeReq({
        params: { studentId: STUDENT_ID },
        query: { academicSessionId: SESSION_ID },
      }),
      pdfRes,
    );
    assert.equal(excelRes.statusCode, 200);
    assert.match(excelRes.headers['Content-Type'], /spreadsheetml/);
    assert.ok(Buffer.isBuffer(excelRes.payload));
    assert.equal(pdfRes.statusCode, 200);
    assert.equal(pdfRes.headers['Content-Type'], 'application/pdf');
    assert.ok(Buffer.isBuffer(pdfRes.payload));
  } finally {
    restoreOpening();
    restoreCount();
    restoreLedgers();
    restoreStudent();
    restoreAcademic();
  }
});

test('used fee particular cannot be deleted', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreParticular = patch(prisma.feeParticular as any, 'findFirst', async () => ({
    id: PARTICULAR_ID,
    schoolId: SCHOOL_ID,
    academicSessionId: SESSION_ID,
    name: 'Tuition Fee',
  }));
  const restoreUsage = patch(prisma.feeStructureItem as any, 'count', async () => 1);

  try {
    await assert.rejects(
      () =>
        deleteFeeParticular(
          makeReq({ params: { id: PARTICULAR_ID }, body: { academicSessionId: SESSION_ID } }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 409 && /structures use/.test(error.message),
    );
  } finally {
    restoreUsage();
    restoreParticular();
    restoreAcademic();
  }
});

test('fine creation rejects particulars outside the scoped academic session', async () => {
  const restoreAcademic = patchAcademicSession();
  let capturedWhere: any;
  const restoreParticulars = patch(prisma.feeParticular as any, 'findMany', async ({ where }: any) => {
    capturedWhere = where;
    return [];
  });

  try {
    await assert.rejects(
      () =>
        createFeeFine(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              particularId: PARTICULAR_ID,
              name: 'Late Payment Fine',
              fineType: 'DAILY',
              amount: 10,
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 404 && /particulars/.test(error.message),
    );
    assert.equal(capturedWhere.schoolId, SCHOOL_ID);
    assert.equal(capturedWhere.academicSessionId, SESSION_ID);
  } finally {
    restoreParticulars();
    restoreAcademic();
  }
});

test('student discount cannot exceed payable amount', async () => {
  const restoreAcademic = patchAcademicSession();
  const restoreStudent = patch(prisma.student as any, 'findFirst', async () => ({ id: STUDENT_ID, schoolId: SCHOOL_ID }));
  const restoreInvoiceAggregate = patch(prisma.feeInvoice as any, 'aggregate', async () => ({
    _sum: { dueAmount: new Prisma.Decimal(100) },
  }));

  try {
    await assert.rejects(
      () =>
        createFeeDiscount(
          makeReq({
            body: {
              academicSessionId: SESSION_ID,
              studentId: STUDENT_ID,
              discountType: 'SCHOLARSHIP',
              valueType: 'FIXED',
              value: 150,
              validFrom: '2026-06-01',
            },
          }),
          makeRes(),
        ),
      (error: unknown) => error instanceof HttpError && error.statusCode === 400 && /Discount cannot exceed/.test(error.message),
    );
  } finally {
    restoreInvoiceAggregate();
    restoreStudent();
    restoreAcademic();
  }
});

test('fee reports apply filters, totals, grouped rows, and session scope', async () => {
  const restoreAcademic = patchAcademicSession();
  let paymentWhere: any;
  let invoiceWhere: any;
  let discountWhere: any;
  let fineWhere: any;
  let receiptWhere: any;
  let ledgerWhere: any;
  const restorePayments = patch(prisma.feePayment as any, 'findMany', async ({ where }: any) => {
    paymentWhere = where;
    return [
      {
        id: 'payment-1',
        paymentNumber: 'PAY-2026-000001',
        paymentMode: 'CASH',
        amount: new Prisma.Decimal(50),
        paidAt: new Date('2026-06-10T08:00:00.000Z'),
        collectedById: USER_ID,
        receipt: { receiptNumber: 'RCP-2026-000001', receiptDate: new Date('2026-06-10T08:00:00.000Z') },
        student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
        invoice: { invoiceNumber: 'INV-2026-000001', feeMonth: 'June 2026', class: { name: 'Class 1' }, section: { name: 'A' }, feeType: { name: 'Monthly' } },
      },
    ];
  });
  const restoreInvoices = patch(prisma.feeInvoice as any, 'findMany', async ({ where }: any) => {
    invoiceWhere = where;
    return [
      {
        id: 'invoice-1',
        invoiceNumber: 'INV-2026-000001',
        studentId: STUDENT_ID,
        feeMonth: 'June 2026',
        issueDate: new Date('2026-06-01T08:00:00.000Z'),
        dueDate: new Date('2026-06-30T08:00:00.000Z'),
        status: 'PARTIALLY_PAID',
        totalAmount: new Prisma.Decimal(100),
        paidAmount: new Prisma.Decimal(80),
        dueAmount: new Prisma.Decimal(20),
        discountAmount: new Prisma.Decimal(10),
        fineAmount: new Prisma.Decimal(5),
        createdById: USER_ID,
        updatedAt: new Date('2026-06-15T08:00:00.000Z'),
        class: { name: 'Class 1' },
        section: { name: 'A' },
        feeType: { name: 'Monthly' },
        student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
      },
    ];
  });
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async ({ where }: any) => {
    discountWhere = where;
    return [
      {
        id: 'discount-1',
        discountName: 'Sibling Discount',
        discountType: 'SPECIAL_DISCOUNT',
        valueType: 'FIXED',
        value: new Prisma.Decimal(10),
        amount: new Prisma.Decimal(10),
        targetType: 'STUDENT',
        approvalStatus: 'APPROVED',
        approvedById: USER_ID,
        student: { fullName: 'Student A', admissionNo: 'A001' },
        class: null,
        section: null,
        category: null,
        feeType: null,
      },
    ];
  });
  const restoreFines = patch(prisma.feeFine as any, 'findMany', async ({ where }: any) => {
    fineWhere = where;
    return [];
  });
  const restoreReceipts = patch(prisma.feeReceipt as any, 'findMany', async ({ where }: any) => {
    receiptWhere = where;
    return [
      {
        id: 'receipt-1',
        receiptNumber: 'RCP-2026-000001',
        amount: new Prisma.Decimal(50),
        receiptDate: new Date('2026-06-10T08:00:00.000Z'),
        student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
        invoice: { invoiceNumber: 'INV-2026-000001' },
        payment: { paymentMode: 'CASH', collectedById: USER_ID },
      },
    ];
  });
  const restoreLedgers = patch(prisma.feeLedger as any, 'findMany', async ({ where }: any) => {
    ledgerWhere = where;
    if (where?.OR) {
      return [
        {
          id: 'fine-ledger-1',
          studentId: STUDENT_ID,
          description: 'Late fine',
          debitAmount: new Prisma.Decimal(5),
          entryDate: new Date('2026-06-12T08:00:00.000Z'),
          student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
          invoice: { invoiceNumber: 'INV-2026-000001' },
          fine: { name: 'Late Fine', fineType: 'FIXED' },
        },
      ];
    }
    return [
      {
        id: 'ledger-1',
        studentId: STUDENT_ID,
        debitAmount: new Prisma.Decimal(100),
        creditAmount: new Prisma.Decimal(50),
        balanceAfter: new Prisma.Decimal(50),
        entryDate: new Date('2026-06-10T08:00:00.000Z'),
        student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
      },
    ];
  });
  const res = makeRes();

  try {
    await getFeeReports(
      makeReq({
        query: {
          academicSessionId: SESSION_ID,
          type: 'payment_mode_report',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          feeTypeId: FEE_TYPE_ID,
          feeStructureId: STRUCTURE_ID,
          paymentMode: 'CASH',
          collectedById: USER_ID,
        },
      }),
      res,
    );
    assert.equal(res.statusCode, 200);
    assert.equal(paymentWhere.schoolId, SCHOOL_ID);
    assert.equal(paymentWhere.academicSessionId, SESSION_ID);
    assert.equal(paymentWhere.status, 'SUCCESS');
    assert.equal(paymentWhere.paidAt.gte.toISOString().slice(0, 10), '2026-06-01');
    assert.equal(paymentWhere.paidAt.lte.toISOString().slice(0, 10), '2026-06-30');
    assert.equal(paymentWhere.paymentMode, 'CASH');
    assert.equal(paymentWhere.collectedById, USER_ID);
    assert.equal(paymentWhere.invoice.classId, CLASS_ID);
    assert.equal(invoiceWhere.schoolId, SCHOOL_ID);
    assert.equal(invoiceWhere.academicSessionId, SESSION_ID);
    assert.equal(invoiceWhere.classId, CLASS_ID);
    assert.equal(discountWhere.academicSessionId, SESSION_ID);
    assert.equal(discountWhere.deletedAt, null);
    assert.equal(fineWhere.academicSessionId, SESSION_ID);
    assert.equal(receiptWhere.academicSessionId, SESSION_ID);
    assert.equal(ledgerWhere.academicSessionId, SESSION_ID);
    assert.deepEqual(res.payload.dailyCollection, { '2026-06-10': 50 });
    assert.equal(res.payload.classWise['Class 1'].due, 20);
    assert.equal(res.payload.summary.totalBilled, 100);
    assert.equal(res.payload.summary.totalCollected, 50);
    assert.equal(res.payload.summary.totalDiscount, 10);
    assert.equal(res.payload.summary.totalFine, 5);
    assert.equal(res.payload.summary.totalDue, 20);
    assert.equal(res.payload.summary.totalReceipts, 1);
    assert.deepEqual(res.payload.rows, [{ paymentMode: 'CASH', transactionCount: 1, totalAmount: 50 }]);
  } finally {
    restoreLedgers();
    restoreReceipts();
    restoreFines();
    restoreDiscounts();
    restoreInvoices();
    restorePayments();
    restoreAcademic();
  }
});

test('fee report PDF and Excel exports return downloadable files', async () => {
  const restoreAcademic = patchAcademicSession();
  const restorePayments = patch(prisma.feePayment as any, 'findMany', async () => [
    {
      id: 'payment-export-1',
      paymentNumber: 'PAY-2026-000001',
      paymentMode: 'UPI',
      amount: new Prisma.Decimal(75),
      paidAt: new Date('2026-06-10T08:00:00.000Z'),
      collectedById: USER_ID,
      receipt: { receiptNumber: 'RCP-2026-000001', receiptDate: new Date('2026-06-10T08:00:00.000Z') },
      student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
      invoice: { invoiceNumber: 'INV-2026-000001', feeMonth: 'June 2026', class: { name: 'Class 1' }, section: { name: 'A' }, feeType: { name: 'Monthly' } },
    },
  ]);
  const restoreInvoices = patch(prisma.feeInvoice as any, 'findMany', async () => [
    {
      id: 'invoice-export-1',
      invoiceNumber: 'INV-2026-000001',
      studentId: STUDENT_ID,
      feeMonth: 'June 2026',
      issueDate: new Date('2026-06-01T08:00:00.000Z'),
      dueDate: new Date('2026-06-30T08:00:00.000Z'),
      status: 'ISSUED',
      totalAmount: new Prisma.Decimal(100),
      paidAmount: new Prisma.Decimal(75),
      dueAmount: new Prisma.Decimal(25),
      discountAmount: new Prisma.Decimal(0),
      fineAmount: new Prisma.Decimal(0),
      createdById: USER_ID,
      updatedAt: new Date('2026-06-01T08:00:00.000Z'),
      class: { name: 'Class 1' },
      section: { name: 'A' },
      feeType: { name: 'Monthly' },
      student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
    },
  ]);
  const restoreDiscounts = patch(prisma.feeDiscount as any, 'findMany', async () => []);
  const restoreFines = patch(prisma.feeFine as any, 'findMany', async () => []);
  const restoreReceipts = patch(prisma.feeReceipt as any, 'findMany', async () => [
    {
      id: 'receipt-export-1',
      receiptNumber: 'RCP-2026-000001',
      amount: new Prisma.Decimal(75),
      receiptDate: new Date('2026-06-10T08:00:00.000Z'),
      student: { fullName: 'Student A', admissionNo: 'A001', class: { name: 'Class 1' }, section: { name: 'A' } },
      invoice: { invoiceNumber: 'INV-2026-000001' },
      payment: { paymentMode: 'UPI', collectedById: USER_ID },
    },
  ]);
  const restoreLedgers = patch(prisma.feeLedger as any, 'findMany', async () => []);
  const pdfRes = makeRes();
  const excelRes = makeRes();

  try {
    await exportFeeReports(
      makeReq({ query: { academicSessionId: SESSION_ID, type: 'daily_collection', format: 'pdf', dateFrom: '2026-06-01', dateTo: '2026-06-30' } }),
      pdfRes,
    );
    await exportFeeReports(
      makeReq({ query: { academicSessionId: SESSION_ID, type: 'daily_collection', format: 'xlsx', dateFrom: '2026-06-01', dateTo: '2026-06-30' } }),
      excelRes,
    );
    assert.equal(pdfRes.headers['Content-Type'], 'application/pdf');
    assert.ok(Buffer.isBuffer(pdfRes.payload));
    assert.match(excelRes.headers['Content-Type'], /spreadsheetml/);
    assert.ok(Buffer.isBuffer(excelRes.payload));
  } finally {
    restoreLedgers();
    restoreReceipts();
    restoreFines();
    restoreDiscounts();
    restoreInvoices();
    restorePayments();
    restoreAcademic();
  }
});
