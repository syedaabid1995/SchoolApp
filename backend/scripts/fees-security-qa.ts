import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/config/db';
import { resolvePermissionForPath } from '../src/middlewares/auth.middleware';
import { getDefaultPermissionCodes } from '../src/utils/employeePermissions';
import {
  approveFeeDiscount,
  cancelFeeInvoice,
  collectFeePayment,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  exportFeeReports,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listFeeInvoices,
  listFeeParticulars,
} from '../src/controllers/feeManagement.controller';

type Auth = { userId: string; schoolId: string; role: string };
type Controller = (req: any, res: any) => Promise<unknown> | unknown;
type Result = { name: string; status: 'PASS' | 'FAIL'; detail?: Record<string, unknown> };

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const code = `FEE-SEC-${stamp}`;
const progressFile = path.resolve(process.cwd(), `fees-security-qa-${stamp}.progress.log`);
const results: Result[] = [];
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const money = (value: unknown) => Number(Number(value ?? 0).toFixed(2));
const decimal = (value: number | string) => new Prisma.Decimal(value);

const addResult = (name: string, status: Result['status'], detail?: Record<string, unknown>) => {
  results.push({ name, status, detail });
  console.error(`[SECURITY-QA] ${status} ${name}`);
  fs.appendFileSync(progressFile, `${new Date().toISOString()} [${status}] ${name}\n`);
};

const progress = (name: string) => {
  console.error(`[SECURITY-QA] ${name}`);
  fs.appendFileSync(progressFile, `${new Date().toISOString()} ${name}\n`);
};

const assertPass = (name: string, condition: boolean, detail?: Record<string, unknown>) => {
  addResult(name, condition ? 'PASS' : 'FAIL', detail);
};

const statusOfError = (error: any) => {
  if (typeof error?.statusCode === 'number') return error.statusCode;
  if (typeof error?.status === 'number') return error.status;
  if (error?.name === 'ZodError') return 400;
  return null;
};

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

const call = async (
  handler: Controller,
  options: {
    auth: Auth;
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
  },
) => {
  const req: any = {
    auth: options.auth,
    body: options.body ?? {},
    query: options.query ?? {},
    params: options.params ?? {},
    headers: { 'user-agent': 'fees-security-qa-script' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = makeRes();
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve(handler(req, res)),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${handler.name || 'controller'} timed out after 20000ms`)), 20000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  return { statusCode: res.statusCode, payload: res.payload, headers: res.headers };
};

const expectError = async (
  name: string,
  allowedStatuses: number[],
  action: () => Promise<unknown>,
) => {
  try {
    await action();
    addResult(name, 'FAIL', { expectedStatuses: allowedStatuses, actual: 'success' });
  } catch (error: any) {
    const status = statusOfError(error);
    addResult(name, allowedStatuses.includes(Number(status)) ? 'PASS' : 'FAIL', {
      expectedStatuses: allowedStatuses,
      actualStatus: status,
      message: error?.message ?? String(error),
    });
  }
};

const expectNoLeak = (name: string, payload: unknown, forbidden: string[]) => {
  const text = JSON.stringify(payload);
  const leaked = forbidden.filter((value) => text.includes(value));
  assertPass(name, leaked.length === 0, { leaked });
};

const createRoleUser = async (schoolId: string, roleName: 'SCHOOL_ADMIN' | 'ACCOUNTANT' | 'STAFF', email: string) => {
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName },
  });
  const user = await prisma.user.create({
    data: {
      schoolId,
      email,
      passwordHash: 'qa-not-for-login',
      status: 'ACTIVE',
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
};

const createTenantSeed = async (tenant: 'A' | 'B') => {
  const school = await prisma.school.create({
    data: {
      name: `Fees Security School ${tenant}`,
      code: `${code}-${tenant}`,
      subscriptionPlan: tenant === 'A' ? 'PREMIUM' : 'STARTER',
      onboardingStatus: 'ACTIVE',
      status: 'ACTIVE',
    },
  });
  const session = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2026-2027',
      startDate: date('2026-04-01'),
      endDate: date('2027-03-31'),
      isActive: true,
    },
  });
  const classRow = await prisma.class.create({
    data: { schoolId: school.id, academicYearId: session.id, name: 'Class 1' },
  });
  const section = await prisma.section.create({
    data: { schoolId: school.id, classId: classRow.id, name: 'A' },
  });
  const group = await prisma.studentGroup.create({
    data: { schoolId: school.id, name: `Security Group ${tenant}` },
  });
  const category = await prisma.studentCategory.create({
    data: { schoolId: school.id, name: `Scholarship ${tenant}` },
  });
  const students = await Promise.all(
    ['One', 'Two', 'Three', 'Four', 'Five'].map((suffix, index) =>
      prisma.student.create({
        data: {
          schoolId: school.id,
          academicSessionId: session.id,
          classId: classRow.id,
          sectionId: section.id,
          studentGroupId: group.id,
          studentCategoryId: category.id,
          admissionNo: `${tenant}-SEC-${index + 1}`,
          rollNo: `${index + 1}`,
          firstName: `Security${tenant}`,
          lastName: suffix,
          fullName: `Security ${tenant} ${suffix}`,
          phone: `90000000${tenant === 'A' ? '1' : '2'}${index}`,
          status: 'ENROLLED',
        },
      }),
    ),
  );
  const particular = await prisma.feeParticular.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: `Security Tuition ${tenant}`,
      normalizedName: `security tuition ${tenant.toLowerCase()}`,
      code: `SEC_TUITION_${tenant}_${stamp}`,
      type: 'CHARGE',
      status: 'ACTIVE',
      sortOrder: 1,
    },
  });
  const feeType = await prisma.feeType.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      name: `Security Monthly ${tenant}`,
      normalizedName: `security monthly ${tenant.toLowerCase()}`,
      code: `SEC_MONTHLY_${tenant}_${stamp}`,
      schedule: 'MONTHLY',
      status: 'ACTIVE',
      sortOrder: 1,
    },
  });
  const structure = await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      classId: classRow.id,
      sectionId: section.id,
      feeTypeId: feeType.id,
      name: `Security Structure ${tenant}`,
      status: 'ACTIVE',
      items: {
        create: {
          particularId: particular.id,
          amount: decimal(100),
          isOptional: false,
          sortOrder: 1,
        },
      },
    },
  });
  await prisma.studentFeeAssignment.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      feeStructureId: structure.id,
      targetType: 'CLASS',
      classId: classRow.id,
      sectionId: section.id,
      startMonth: '2026-06',
      status: 'ACTIVE',
      autoAssigned: true,
    },
  });
  return { school, session, classRow, section, group, category, students, particular, feeType, structure };
};

const createInvoice = async (seed: Awaited<ReturnType<typeof createTenantSeed>>, studentIndex: number, suffix: string, amount = 100) => {
  const student = seed.students[studentIndex];
  const invoice = await prisma.feeInvoice.create({
    data: {
      schoolId: seed.school.id,
      academicSessionId: seed.session.id,
      studentId: student.id,
      classId: seed.classRow.id,
      sectionId: seed.section.id,
      feeStructureId: seed.structure.id,
      feeTypeId: seed.feeType.id,
      invoiceNumber: `${code}-${seed.school.code.endsWith('-A') ? 'A' : 'B'}-INV-${suffix}`,
      feeMonth: '2026-06',
      issueDate: date('2026-06-01'),
      dueDate: date('2026-06-15'),
      totalAmount: decimal(amount),
      discountAmount: decimal(0),
      fineAmount: decimal(0),
      paidAmount: decimal(0),
      dueAmount: decimal(amount),
      status: 'ISSUED',
      items: {
        create: {
          particularId: seed.particular.id,
          name: seed.particular.name,
          amount: decimal(amount),
          discountAmount: decimal(0),
          fineAmount: decimal(0),
          netAmount: decimal(amount),
          sortOrder: 1,
        },
      },
    },
  });
  await prisma.feeLedger.create({
    data: {
      schoolId: seed.school.id,
      academicSessionId: seed.session.id,
      studentId: student.id,
      invoiceId: invoice.id,
      type: 'INVOICE_DEBIT',
      description: `Security seed invoice ${invoice.invoiceNumber}`,
      debitAmount: decimal(amount),
      creditAmount: decimal(0),
      balanceAfter: decimal(amount),
      entryDate: date('2026-06-01'),
    },
  });
  return invoice;
};

const assertAudit = async (
  name: string,
  params: {
    schoolId: string;
    actorId: string;
    entityType: string;
    action: string;
    academicSessionId: string;
  },
) => {
  const log = await prisma.auditLog.findFirst({
    where: {
      schoolId: params.schoolId,
      actorId: params.actorId,
      entityType: params.entityType,
      action: params.action,
    },
    orderBy: { createdAt: 'desc' },
  });
  const afterText = JSON.stringify(log?.afterState ?? {});
  const beforeText = JSON.stringify(log?.beforeState ?? {});
  assertPass(name, Boolean(log && afterText.includes(params.academicSessionId) || beforeText.includes(params.academicSessionId)), {
    found: Boolean(log),
    entityType: params.entityType,
    action: params.action,
  });
};

async function main() {
  progress('start security QA seed');
  const seedA = await createTenantSeed('A');
  progress('tenant A seed created');
  const seedB = await createTenantSeed('B');
  progress('tenant B seed created');
  const adminA = await createRoleUser(seedA.school.id, 'SCHOOL_ADMIN', `admin-a-${stamp}@security.test`);
  const accountantA = await createRoleUser(seedA.school.id, 'ACCOUNTANT', `accountant-a-${stamp}@security.test`);
  const staffA = await createRoleUser(seedA.school.id, 'STAFF', `staff-a-${stamp}@security.test`);
  progress('role users created');

  const adminAuth: Auth = { userId: adminA.id, schoolId: seedA.school.id, role: 'SCHOOL_ADMIN' };
  const accountantAuth: Auth = { userId: accountantA.id, schoolId: seedA.school.id, role: 'ACCOUNTANT' };
  const staffAuth: Auth = { userId: staffA.id, schoolId: seedA.school.id, role: 'STAFF' };

  const invoiceACollection = await createInvoice(seedA, 0, 'COLLECT', 100);
  const invoiceAOverpay = await createInvoice(seedA, 1, 'OVERPAY', 50);
  const invoiceACancel = await createInvoice(seedA, 2, 'CANCEL', 30);
  const invoiceAFine = await createInvoice(seedA, 3, 'FINE', 40);
  const invoiceB = await createInvoice(seedB, 0, 'CROSS', 100);
  progress('seed invoices created');

  await expectError('tenant spoofing is rejected on metadata', [403], () =>
    call(getFeeMetadata, {
      auth: adminAuth,
      query: { schoolId: seedB.school.id, academicSessionId: seedB.session.id },
    }),
  );

  await expectError('tenant spoofing is rejected on setup create', [403], () =>
    call(createFeeParticular, {
      auth: adminAuth,
      body: {
        schoolId: seedB.school.id,
        academicSessionId: seedB.session.id,
        name: 'Spoofed Setup',
        code: `SPOOF_${stamp}`,
        type: 'CHARGE',
        status: 'ACTIVE',
      },
    }),
  );

  const setupA = await call(listFeeParticulars, {
    auth: adminAuth,
    query: { academicSessionId: seedA.session.id },
  });
  expectNoLeak('school A setup list does not include school B setup', setupA.payload, [seedB.particular.id, seedB.particular.name]);

  const invoiceListA = await call(listFeeInvoices, {
    auth: adminAuth,
    query: { academicSessionId: seedA.session.id, search: invoiceB.invoiceNumber },
  });
  expectNoLeak('school A invoice search does not include school B invoice', invoiceListA.payload, [invoiceB.id, invoiceB.invoiceNumber, seedB.students[0].admissionNo]);

  await expectError('school A cannot pay school B invoice without spoofed scope', [404], () =>
    call(collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: seedA.session.id,
        studentId: seedB.students[0].id,
        paymentMode: 'CASH',
        amount: 10,
        idempotencyKey: `${code}-cross-pay-nospoof`,
        allocations: [{ invoiceId: invoiceB.id, amount: 10 }],
      },
    }),
  );

  await expectError('school A cannot pay school B invoice with spoofed scope', [403], () =>
    call(collectFeePayment, {
      auth: accountantAuth,
      body: {
        schoolId: seedB.school.id,
        academicSessionId: seedB.session.id,
        studentId: seedB.students[0].id,
        paymentMode: 'CASH',
        amount: 10,
        idempotencyKey: `${code}-cross-pay-spoof`,
        allocations: [{ invoiceId: invoiceB.id, amount: 10 }],
      },
    }),
  );

  const bPaymentCount = await prisma.feePayment.count({ where: { schoolId: seedB.school.id, invoiceId: invoiceB.id } });
  assertPass('cross-school payment attempt did not create payment', bPaymentCount === 0, { bPaymentCount });

  await expectError('school A cannot cancel school B invoice', [404], () =>
    call(cancelFeeInvoice, {
      auth: adminAuth,
      params: { id: invoiceB.id },
      body: { academicSessionId: seedA.session.id, reason: 'cross tenant cancellation attempt' },
    }),
  );

  const invoiceBAfterCancelAttempt = await prisma.feeInvoice.findUnique({ where: { id: invoiceB.id }, select: { status: true } });
  assertPass('cross-school cancellation did not mutate school B invoice', invoiceBAfterCancelAttempt?.status === 'ISSUED', invoiceBAfterCancelAttempt ?? undefined);

  await expectError('school A cannot export school B report with spoofed scope', [403], () =>
    call(exportFeeReports, {
      auth: adminAuth,
      query: {
        schoolId: seedB.school.id,
        academicSessionId: seedB.session.id,
        type: 'daily_collection',
        format: 'pdf',
      },
    }),
  );

  await expectError('school A cannot access school B student ledger', [404], () =>
    call(getStudentFeeLedger, {
      auth: adminAuth,
      params: { studentId: seedB.students[0].id },
      query: { academicSessionId: seedA.session.id },
    }),
  );

  await expectError('staff cannot access fee metadata', [403], () =>
    call(getFeeMetadata, {
      auth: staffAuth,
      query: { academicSessionId: seedA.session.id },
    }),
  );

  await expectError('staff cannot access fee reports', [403], () =>
    call(getFeeReports, {
      auth: staffAuth,
      query: { academicSessionId: seedA.session.id, type: 'daily_collection' },
    }),
  );

  const discountCreate = await call(createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: seedA.session.id,
      discountName: 'Security Scholarship Approval',
      targetType: 'STUDENT',
      studentId: seedA.students[2].id,
      discountType: 'FIXED',
      discountValue: 5,
      validFrom: '2026-06-01',
      validTo: '2026-12-31',
      approvalStatus: 'PENDING_APPROVAL',
      reason: 'security qa approval test',
    },
  });
  await expectError('accountant cannot approve discounts', [403], () =>
    call(approveFeeDiscount, {
      auth: accountantAuth,
      params: { id: discountCreate.payload.id },
      body: { academicSessionId: seedA.session.id },
    }),
  );
  await call(approveFeeDiscount, {
    auth: adminAuth,
    params: { id: discountCreate.payload.id },
    body: { academicSessionId: seedA.session.id },
  });
  addResult('school admin can approve discount', 'PASS', { discountId: discountCreate.payload.id });

  await expectError('invalid UUID route param returns validation error before Prisma query', [400], () =>
    call(cancelFeeInvoice, {
      auth: adminAuth,
      params: { id: 'not-a-uuid' },
      body: { academicSessionId: seedA.session.id },
    }),
  );

  await expectError('UPI without transaction reference is rejected', [400], () =>
    call(collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: seedA.session.id,
        studentId: seedA.students[0].id,
        paymentMode: 'UPI',
        amount: 10,
        idempotencyKey: `${code}-upi-no-ref`,
        allocations: [{ invoiceId: invoiceACollection.id, amount: 10 }],
      },
    }),
  );

  await expectError('cheque without bank/reference is rejected', [400], () =>
    call(collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: seedA.session.id,
        studentId: seedA.students[0].id,
        paymentMode: 'CHEQUE',
        amount: 10,
        idempotencyKey: `${code}-cheque-no-bank`,
        chequeNumber: '',
        allocations: [{ invoiceId: invoiceACollection.id, amount: 10 }],
      },
    }),
  );

  await expectError('overpayment is rejected', [400], () =>
    call(collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: seedA.session.id,
        studentId: seedA.students[1].id,
        paymentMode: 'CASH',
        amount: 51,
        idempotencyKey: `${code}-overpay`,
        allocations: [{ invoiceId: invoiceAOverpay.id, amount: 51 }],
      },
    }),
  );

  const idempotencyKey = `${code}-payment-idempotency`;
  const firstPayment = await call(collectFeePayment, {
    auth: accountantAuth,
    body: {
      schoolId: seedA.school.id,
      academicSessionId: seedA.session.id,
      userId: seedB.students[0].id,
      role: 'SCHOOL_ADMIN',
      studentId: seedA.students[0].id,
      paymentMode: 'CASH',
      amount: 40,
      idempotencyKey,
      allocations: [{ invoiceId: invoiceACollection.id, amount: 40 }],
    },
  });
  assertPass('valid cash payment succeeds', firstPayment.statusCode === 201, { statusCode: firstPayment.statusCode });
  assertPass('frontend userId/role spoof is ignored in payment collection', firstPayment.payload.payment.collectedById === accountantA.id, {
    collectedById: firstPayment.payload.payment.collectedById,
    expected: accountantA.id,
  });

  const secondPayment = await call(collectFeePayment, {
    auth: accountantAuth,
    body: {
      academicSessionId: seedA.session.id,
      studentId: seedA.students[0].id,
      paymentMode: 'CASH',
      amount: 40,
      idempotencyKey,
      allocations: [{ invoiceId: invoiceACollection.id, amount: 40 }],
    },
  });
  const idempotentPaymentCount = await prisma.feePayment.count({ where: { schoolId: seedA.school.id, idempotencyKey } });
  assertPass('duplicate payment submit returns existing payment', secondPayment.statusCode === 200 && secondPayment.payload.idempotent === true, {
    statusCode: secondPayment.statusCode,
    idempotent: secondPayment.payload.idempotent,
  });
  assertPass('duplicate payment submit does not duplicate payment row', idempotentPaymentCount === 1, { idempotentPaymentCount });

  const invoiceAfterPayment = await prisma.feeInvoice.findUnique({ where: { id: invoiceACollection.id }, select: { paidAmount: true, dueAmount: true } });
  assertPass('payment cannot exceed due and updates exact invoice balance', money(invoiceAfterPayment?.paidAmount) === 40 && money(invoiceAfterPayment?.dueAmount) === 60, {
    paidAmount: money(invoiceAfterPayment?.paidAmount),
    dueAmount: money(invoiceAfterPayment?.dueAmount),
  });

  await call(cancelFeeInvoice, {
    auth: adminAuth,
    params: { id: invoiceACancel.id },
    body: { academicSessionId: seedA.session.id, reason: 'security qa cancellation' },
  });
  addResult('school admin can cancel unpaid invoice', 'PASS', { invoiceId: invoiceACancel.id });

  await call(createFeeFine, {
    auth: adminAuth,
    body: {
      academicSessionId: seedA.session.id,
      invoiceId: invoiceAFine.id,
      name: 'Security Late Fine',
      fineType: 'FIXED',
      amount: 5,
      status: 'ACTIVE',
    },
  });
  addResult('school admin can apply fine', 'PASS', { invoiceId: invoiceAFine.id });

  await call(generateFeeInvoices, {
    auth: adminAuth,
    body: {
      academicSessionId: seedA.session.id,
      target: 'STUDENT',
      studentId: seedA.students[4].id,
      feeStructureId: seedA.structure.id,
      feeTypeId: seedA.feeType.id,
      feeMonth: '2026-07',
      dueDate: '2026-07-15',
    },
  });
  addResult('school admin can generate invoice', 'PASS', { studentId: seedA.students[4].id });

  const report = await call(getFeeReports, {
    auth: adminAuth,
    query: { academicSessionId: seedA.session.id, type: 'daily_collection', dateFrom: '2026-06-01', dateTo: '2026-12-31' },
  });
  expectNoLeak('school A report data does not include school B identifiers', report.payload, [invoiceB.invoiceNumber, seedB.students[0].admissionNo, seedB.school.id]);

  const reportExport = await call(exportFeeReports, {
    auth: adminAuth,
    query: { academicSessionId: seedA.session.id, type: 'daily_collection', format: 'xlsx', dateFrom: '2026-06-01', dateTo: '2026-12-31' },
  });
  assertPass('report Excel export succeeds with tenant scope', Buffer.isBuffer(reportExport.payload) && reportExport.payload.length > 0, {
    bytes: Buffer.isBuffer(reportExport.payload) ? reportExport.payload.length : 0,
  });

  const adminPermissions = getDefaultPermissionCodes('SCHOOL_ADMIN').filter((permission) => permission.startsWith('fees.'));
  const accountantPermissions = getDefaultPermissionCodes('ACCOUNTANT');
  const staffPermissions = getDefaultPermissionCodes('STAFF').filter((permission) => permission.startsWith('fees.'));
  assertPass('school admin has full fee permissions', adminPermissions.includes('fees.discounts.approve') && adminPermissions.includes('fees.invoice-generate.create') && adminPermissions.includes('fees.reports.export'), {
    feePermissionCount: adminPermissions.length,
  });
  assertPass('accountant default fee permissions are restricted', accountantPermissions.includes('fees.collection.create') && !accountantPermissions.includes('fees.discounts.approve') && !accountantPermissions.includes('fees.structures.delete') && !accountantPermissions.includes('fees.invoice-generate.create'), {
    accountantFeePermissions: accountantPermissions.filter((permission) => permission.startsWith('fees.')).sort(),
  });
  assertPass('staff has no default fee permissions', staffPermissions.length === 0, { staffPermissions });
  assertPass('fees route permission mapping is granular', (
    resolvePermissionForPath('/api/v1/fees/metadata', 'GET') === 'fees.overview.view' &&
    resolvePermissionForPath('/api/v1/fees/payments', 'POST') === 'fees.collection.create' &&
    resolvePermissionForPath('/api/v1/fees/discounts/abc/approve', 'PATCH') === 'fees.discounts.approve' &&
    resolvePermissionForPath('/api/v1/fees/reports/export', 'GET') === 'fees.reports.export' &&
    resolvePermissionForPath('/api/v1/fees/invoices/abc/cancel', 'PATCH') === 'fees.invoices.cancel'
  ), {
    metadata: resolvePermissionForPath('/api/v1/fees/metadata', 'GET'),
    paymentCreate: resolvePermissionForPath('/api/v1/fees/payments', 'POST'),
    discountApprove: resolvePermissionForPath('/api/v1/fees/discounts/abc/approve', 'PATCH'),
    reportExport: resolvePermissionForPath('/api/v1/fees/reports/export', 'GET'),
    invoiceCancel: resolvePermissionForPath('/api/v1/fees/invoices/abc/cancel', 'PATCH'),
  });

  await assertAudit('invoice generation audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: adminA.id,
    entityType: 'FEE_INVOICE',
    action: 'CREATE',
    academicSessionId: seedA.session.id,
  });
  await assertAudit('payment collection audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: accountantA.id,
    entityType: 'FEE_PAYMENT',
    action: 'CREATE',
    academicSessionId: seedA.session.id,
  });
  await assertAudit('invoice cancellation audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: adminA.id,
    entityType: 'FEE_INVOICE',
    action: 'CANCEL',
    academicSessionId: seedA.session.id,
  });
  await assertAudit('discount approval audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: adminA.id,
    entityType: 'FEE_DISCOUNT',
    action: 'APPROVED',
    academicSessionId: seedA.session.id,
  });
  await assertAudit('fine application audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: adminA.id,
    entityType: 'FEE_FINE',
    action: 'CREATE',
    academicSessionId: seedA.session.id,
  });
  await assertAudit('report export audit log exists with tenant and actor', {
    schoolId: seedA.school.id,
    actorId: adminA.id,
    entityType: 'FEE_REPORT_EXPORT',
    action: 'EXPORT_XLSX',
    academicSessionId: seedA.session.id,
  });

  const passCount = results.filter((result) => result.status === 'PASS').length;
  const failCount = results.filter((result) => result.status === 'FAIL').length;
  const output = {
    run: {
      code,
      schoolA: seedA.school.id,
      schoolB: seedB.school.id,
      academicSessionA: seedA.session.id,
      academicSessionB: seedB.session.id,
      generatedAt: new Date().toISOString(),
    },
    readiness: failCount === 0 ? 'STAGING SECURITY READY' : 'NOT READY',
    summary: { passCount, failCount },
    failed: results.filter((result) => result.status === 'FAIL'),
    results,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failCount > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('[SECURITY-QA] FATAL', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
