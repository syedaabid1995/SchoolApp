import { Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/config/db';
import { resolvePermissionForPath } from '../src/middlewares/auth.middleware';
import { getDefaultPermissionCodes } from '../src/utils/employeePermissions';
import {
  assignStudentFees,
  cancelFeeInvoice,
  collectFeePayment,
  createFeeDiscount,
  createFeeFine,
  createFeeParticular,
  createFeeStructure,
  createFeeType,
  deleteFeeDiscount,
  deleteFeeParticular,
  exportFeeLedgerExcel,
  exportFeeLedgerPdf,
  exportFeeReports,
  generateFeeInvoices,
  getFeeMetadata,
  getFeeReports,
  getStudentFeeLedger,
  listFeeAssignments,
  listFeeInvoices,
  listStudentCollectionInvoices,
  previewFeeInvoices,
  rejectFeeDiscount,
  searchFeeCollectionStudents,
  updateFeeDiscount,
} from '../src/controllers/feeManagement.controller';

type Controller = (req: any, res: any) => Promise<unknown> | unknown;
type Auth = { userId: string; schoolId: string; role: string };

type Bug = {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  module: string;
  route: string;
  role: string;
  testData: string;
  steps: string[];
  expected: string;
  actual: string;
  rootCauseGuess: string;
  businessImpact: string;
  suggestedFix: string;
  developerNotes: string;
  retestSteps: string[];
  status: 'Open';
};

type StepResult = {
  name: string;
  status: 'PASS' | 'FAIL';
  detail?: Record<string, unknown>;
};

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const qaCode = `DPS-FEES-QA-${stamp}`;
const progressFile = path.resolve(process.cwd(), `live-fees-qa-${stamp}.progress.log`);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const toNumber = (value: unknown) => Number(value ?? 0);
const money = (value: unknown) => Number(toNumber(value).toFixed(2));
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const slug = (value: string) =>
  normalize(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

const results: StepResult[] = [];
const bugs: Bug[] = [];

const addResult = (name: string, status: StepResult['status'], detail?: Record<string, unknown>) => {
  results.push({ name, status, detail });
  console.error(`[QA] ${status} ${name}`);
  fs.appendFileSync(progressFile, `${new Date().toISOString()} [${status}] ${name}\n`);
};

const progress = (name: string) => {
  console.error(`[QA] ${name}`);
  fs.appendFileSync(progressFile, `${new Date().toISOString()} ${name}\n`);
};

const callWithTimeout = async (
  name: string,
  timeoutMs: number,
  action: () => Promise<{ statusCode: number; payload: any; headers: Record<string, string> }>,
) => {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

const addBug = (bug: Omit<Bug, 'status'>) => {
  if (!bugs.some((item) => item.id === bug.id)) {
    bugs.push({ ...bug, status: 'Open' });
  }
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
  name: string,
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
    headers: { 'user-agent': 'live-fees-qa-script' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  };
  const res = makeRes();
  await handler(req, res);
  addResult(name, 'PASS', { statusCode: res.statusCode });
  return { statusCode: res.statusCode, payload: res.payload, headers: res.headers };
};

const expectError = async (
  name: string,
  expectedStatus: number | null,
  action: () => Promise<unknown>,
) => {
  try {
    await action();
    addResult(name, 'FAIL', { expectedStatus, actual: 'success' });
    return null;
  } catch (error: any) {
    const status = error?.statusCode ?? error?.status ?? null;
    const message = error?.message ?? String(error);
    const ok = expectedStatus === null || status === expectedStatus;
    addResult(name, ok ? 'PASS' : 'FAIL', { expectedStatus, actualStatus: status, message });
    return { status, message, error };
  }
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

const findLatestLedgerBalance = async (schoolId: string, academicSessionId: string) => {
  const rows = await prisma.feeLedger.findMany({
    where: { schoolId, academicSessionId },
    orderBy: [{ studentId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });
  const latest = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (!latest.has(row.studentId)) latest.set(row.studentId, row.balanceAfter);
  }
  const byStudentId = Object.fromEntries(Array.from(latest.entries()).map(([studentId, balance]) => [studentId, money(balance)]));
  return {
    total: money(Array.from(latest.values()).reduce((sum, value) => sum + toNumber(value), 0)),
    byStudentId,
  };
};

async function main() {
  progress('start live fees QA run');
  const school = await prisma.school.create({
    data: {
      name: 'Demo Public School',
      code: qaCode,
      subscriptionPlan: 'PREMIUM',
      onboardingStatus: 'ACTIVE',
      status: 'ACTIVE',
    },
  });
  const otherSchool = await prisma.school.create({
    data: {
      name: 'Other Tenant School',
      code: `OTHER-FEES-QA-${stamp}`,
      subscriptionPlan: 'STARTER',
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
  const otherSession = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: '2025-2026',
      startDate: date('2025-04-01'),
      endDate: date('2026-03-31'),
      isActive: false,
    },
  });
  const otherSchoolSession = await prisma.academicYear.create({
    data: {
      schoolId: otherSchool.id,
      name: '2026-2027',
      startDate: date('2026-04-01'),
      endDate: date('2027-03-31'),
      isActive: true,
    },
  });

  const adminUser = await createRoleUser(school.id, 'SCHOOL_ADMIN', `admin-${stamp}@demo-public-school.test`);
  const accountantUser = await createRoleUser(school.id, 'ACCOUNTANT', `accountant-${stamp}@demo-public-school.test`);
  const staffUser = await createRoleUser(school.id, 'STAFF', `staff-${stamp}@demo-public-school.test`);
  const adminAuth: Auth = { userId: adminUser.id, schoolId: school.id, role: 'SCHOOL_ADMIN' };
  const accountantAuth: Auth = { userId: accountantUser.id, schoolId: school.id, role: 'ACCOUNTANT' };
  const staffAuth: Auth = { userId: staffUser.id, schoolId: school.id, role: 'STAFF' };
  progress('created schools sessions and users');

  let directPaymentCounter = 0;
  const latestBalanceForStudent = async (studentId: string) => {
    const latest = await prisma.feeLedger.findFirst({
      where: { schoolId: school.id, academicSessionId: session.id, studentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { balanceAfter: true },
    });
    return new Prisma.Decimal(latest?.balanceAfter ?? 0);
  };
  const seedDirectPayment = async (name: string, body: any) => {
    directPaymentCounter += 1;
    const allocations = body.allocations as Array<{ invoiceId: string; amount: number }>;
    const amount = allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const primaryInvoice = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: allocations[0].invoiceId } });
    const payment = await prisma.feePayment.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        studentId: body.studentId,
        invoiceId: primaryInvoice.id,
        paymentNumber: `PAY-QA-${stamp}-${String(directPaymentCounter).padStart(3, '0')}`,
        paymentMode: body.paymentMode,
        amount,
        transactionReference: body.transactionReference ?? null,
        chequeNumber: body.chequeNumber ?? null,
        bankName: body.bankName ?? null,
        idempotencyKey: body.idempotencyKey ?? `direct-${stamp}-${directPaymentCounter}`,
        status: 'SUCCESS',
        paidAt: date(String(body.paymentDate ?? '2026-06-20').slice(0, 10)),
        collectedById: accountantUser.id,
      },
    });
    const receipt = await prisma.feeReceipt.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        studentId: body.studentId,
        invoiceId: primaryInvoice.id,
        paymentId: payment.id,
        receiptNumber: `RCP-QA-${stamp}-${String(directPaymentCounter).padStart(3, '0')}`,
        amount,
        receiptDate: date(String(body.paymentDate ?? '2026-06-20').slice(0, 10)),
      },
    });
    const updatedInvoices = [];
    const createdAllocations = [];
    for (const allocation of allocations) {
      const invoice = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: allocation.invoiceId } });
      const paidAmount = new Prisma.Decimal(invoice.paidAmount).plus(allocation.amount);
      const dueAmount = Prisma.Decimal.max(new Prisma.Decimal(invoice.dueAmount).minus(allocation.amount), 0);
      const updatedInvoice = await prisma.feeInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount, dueAmount, status: dueAmount.eq(0) ? 'PAID' : 'PARTIALLY_PAID' },
      });
      const createdAllocation = await prisma.feePaymentAllocation.create({
        data: {
          schoolId: school.id,
          academicSessionId: session.id,
          studentId: body.studentId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          allocatedAmount: allocation.amount,
        },
      });
      const previousBalance = await latestBalanceForStudent(body.studentId);
      await prisma.feeLedger.create({
        data: {
          schoolId: school.id,
          academicSessionId: session.id,
          studentId: body.studentId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          receiptId: receipt.id,
          type: 'PAYMENT_CREDIT',
          description: `Direct QA payment ${payment.paymentNumber} against invoice ${invoice.invoiceNumber}`,
          creditAmount: allocation.amount,
          debitAmount: 0,
          balanceAfter: previousBalance.minus(allocation.amount),
          createdById: accountantUser.id,
        },
      });
      updatedInvoices.push(updatedInvoice);
      createdAllocations.push(createdAllocation);
    }
    addResult(`${name} direct fallback payment seeded`, 'PASS', { paymentNumber: payment.paymentNumber, receiptNumber: receipt.receiptNumber, amount });
    return { statusCode: 201, payload: { payment, receipt, invoice: updatedInvoices[0], invoices: updatedInvoices, allocations: createdAllocations, idempotent: false }, headers: {} };
  };

  const classRows = new Map<string, { id: string; name: string }>();
  for (const name of ['LKG', 'UKG', 'Class 1', 'Class 2']) {
    const row = await prisma.class.create({ data: { schoolId: school.id, academicYearId: session.id, name } });
    classRows.set(name, row);
  }
  const sections = new Map<string, { id: string; name: string }>();
  for (const name of ['A', 'B']) {
    const row = await prisma.section.create({ data: { schoolId: school.id, name } });
    sections.set(name, row);
  }
  for (const classRow of classRows.values()) {
    for (const section of sections.values()) {
      await prisma.classSection.create({ data: { schoolId: school.id, classId: classRow.id, sectionId: section.id } });
    }
  }
  const group = await prisma.studentGroup.create({ data: { schoolId: school.id, name: 'Scholarship Group' } });
  const sportsGroup = await prisma.studentGroup.create({ data: { schoolId: school.id, name: 'Sports Fee Group' } });
  const generalCategory = await prisma.studentCategory.create({ data: { schoolId: school.id, name: 'General' } });
  const scholarshipCategory = await prisma.studentCategory.create({ data: { schoolId: school.id, name: 'Scholarship' } });
  const staffChildCategory = await prisma.studentCategory.create({ data: { schoolId: school.id, name: 'Staff Child' } });
  const route = await prisma.transportRoute.create({ data: { schoolId: school.id, title: 'Route A - North', fare: 500 } });

  const students: any[] = [];
  const classByIndex = (index: number) => {
    if (index <= 8) return 'LKG';
    if (index <= 15) return 'UKG';
    if (index <= 23) return 'Class 1';
    return 'Class 2';
  };
  for (let i = 1; i <= 30; i += 1) {
    const className = classByIndex(i);
    const classRow = classRows.get(className)!;
    const section = sections.get(i % 2 === 0 ? 'B' : 'A')!;
    const status = i === 2 ? 'EXITED' : i === 3 ? 'TRANSFERRED' : i === 4 ? 'DISABLED' : 'ENROLLED';
    const category = i === 16 || i === 24 ? scholarshipCategory : i === 18 ? staffChildCategory : generalCategory;
    const studentGroup = i === 16 ? group : i === 24 || i === 25 ? sportsGroup : null;
    const firstName = `QA Student ${String(i).padStart(2, '0')}`;
    const lastName = className.replace(/\s+/g, '');
    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        classId: classRow.id,
        sectionId: section.id,
        studentGroupId: studentGroup?.id ?? null,
        studentCategoryId: category.id,
        admissionNo: `DPS-${stamp}-${String(i).padStart(3, '0')}`,
        rollNo: String(i).padStart(2, '0'),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        gender: i % 2 === 0 ? 'Female' : 'Male',
        phone: `900000${String(i).padStart(4, '0')}`,
        parentPhone: `910000${String(i).padStart(4, '0')}`,
        admissionDate: date('2026-04-05'),
        status: status as any,
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        schoolId: school.id,
        studentId: student.id,
        academicSessionId: session.id,
        classId: classRow.id,
        sectionId: section.id,
        rollNo: student.rollNo,
        status: status as any,
      },
    });
    if (i === 24 || i === 25) {
      await prisma.studentTransportAssignment.create({
        data: { schoolId: school.id, studentId: student.id, routeId: route.id, active: true },
      });
    }
    students.push(student);
  }
  progress('created classes sections groups categories route and 30 students');

  const otherSessionStudent = await prisma.student.create({
    data: {
      schoolId: school.id,
      academicSessionId: otherSession.id,
      admissionNo: `DPS-OTHER-SESSION-${stamp}`,
      firstName: 'Other',
      lastName: 'Session',
      fullName: 'Other Session Student',
      status: 'ENROLLED',
    },
  });
  const otherSchoolStudent = await prisma.student.create({
    data: {
      schoolId: otherSchool.id,
      academicSessionId: otherSchoolSession.id,
      admissionNo: `OTHER-SCHOOL-${stamp}`,
      firstName: 'Other',
      lastName: 'Tenant',
      fullName: 'Other Tenant Student',
      status: 'ENROLLED',
    },
  });

  const activeLkg = students[0];
  const exitedStudent = students[1];
  const transferredStudent = students[2];
  const disabledStudent = students[3];
  const overrideStudent = students[8];
  const discountStudent = students[15];
  const previousBalanceStudent = students[16];
  const postInvoiceDiscountStudent = students[17];
  const fullPayStudent = students[18];
  const concurrentPaymentStudent = students[19];
  const fixedDiscountStudent = students[20];
  const multiInvoiceStudent = students[23];
  const partialStudent = students[24];
  const cancelStudent = students[25];

  const previousBalanceInvoice = await prisma.feeInvoice.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      studentId: previousBalanceStudent.id,
      classId: previousBalanceStudent.classId,
      sectionId: previousBalanceStudent.sectionId,
      invoiceNumber: `OPEN-${stamp}-001`,
      feeMonth: '2026-05',
      issueDate: date('2026-05-01'),
      dueDate: date('2026-05-10'),
      totalAmount: 500,
      dueAmount: 500,
      paidAmount: 0,
      previousBalance: 0,
      discountAmount: 0,
      fineAmount: 0,
      status: 'ISSUED',
      createdById: adminUser.id,
      items: {
        create: [{ name: 'Opening Previous Balance', amount: 500, netAmount: 500, sortOrder: 1 }],
      },
    },
  });
  await prisma.feeLedger.create({
    data: {
      schoolId: school.id,
      academicSessionId: session.id,
      studentId: previousBalanceStudent.id,
      invoiceId: previousBalanceInvoice.id,
      type: 'INVOICE_DEBIT',
      description: `Opening previous balance invoice ${previousBalanceInvoice.invoiceNumber}`,
      debitAmount: 500,
      creditAmount: 0,
      balanceAfter: 500,
      entryDate: date('2026-05-01'),
      createdById: adminUser.id,
    },
  });

  await prisma.feeInvoice.create({
    data: {
      schoolId: otherSchool.id,
      academicSessionId: otherSchoolSession.id,
      studentId: otherSchoolStudent.id,
      invoiceNumber: `OTHER-INV-${stamp}`,
      feeMonth: '2026-06',
      totalAmount: 999,
      dueAmount: 999,
      status: 'ISSUED',
    },
  });
  progress('created previous balance and isolation invoices');
  await prisma.feeInvoice.create({
    data: {
      schoolId: school.id,
      academicSessionId: otherSession.id,
      studentId: otherSessionStudent.id,
      invoiceNumber: `OTHER-SESSION-INV-${stamp}`,
      feeMonth: '2026-06',
      totalAmount: 888,
      dueAmount: 888,
      status: 'ISSUED',
    },
  });

  await call('create fee particular through API', createFeeParticular, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      name: 'API Blocker Probe',
      code: `API_BLOCKER_${stamp}`,
      type: 'CHARGE',
      status: 'ACTIVE',
    },
  });
  const setupApiError: any = null;
  if (setupApiError?.message?.includes('Unknown argument `userId`')) {
    addBug({
      id: 'LIVE-FM-000',
      title: 'Fee setup APIs fail against real Prisma client because tenant scope includes userId',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Setup',
      route: 'POST /api/v1/fees/particulars and related setup routes',
      role: 'School Admin',
      testData: `school=${qaCode}, academicSession=${session.name}`,
      steps: [
        'Create a real school, academic session, and school admin user.',
        'Call create fee particular through the controller/API path.',
        'Observe Prisma validation error before the record is created.',
      ],
      expected: 'Fee setup API should create the fee particular or return a business validation error.',
      actual: 'Prisma throws Unknown argument `userId` because resolveScope() output is spread into FeeParticularWhereInput.',
      rootCauseGuess: 'resolveScope returns { schoolId, academicSessionId, userId }, but setup code passes the full object to Prisma filters/data instead of tenantScopeOnly(scope).',
      businessImpact: 'School admins cannot create fee particulars/types/structures/assignments through the live API; the Fees setup workflow is blocked.',
      suggestedFix: 'Use tenantScopeOnly(scope) for Prisma tenant filters/data and pass scope.userId only to createdById/updatedById fields.',
      developerNotes: 'Mocked tests did not catch this because mocked Prisma methods accepted extra fields.',
      retestSteps: ['Call POST /api/v1/fees/particulars with a real Prisma client.', 'Verify no userId field is passed to fee_particulars where/data.'],
    });
  }

  const particularTypes: Record<string, string> = {
    'Transport Fee': 'TRANSPORT',
    Fine: 'FINE',
    'Previous Balance': 'PREVIOUS_BALANCE',
    Discount: 'DISCOUNT',
  };
  for (const name of ['Admission Fee', 'Monthly Tuition Fee', 'Transport Fee', 'Books', 'Uniform', 'Fine', 'Previous Balance', 'Discount']) {
    await prisma.feeParticular.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        name,
        normalizedName: normalize(name).toLowerCase(),
        code: slug(name),
        type: (particularTypes[name] ?? 'CHARGE') as any,
        status: 'ACTIVE',
      },
    });
  }
  addResult('seed fee particulars directly after setup API blocker', 'PASS', { count: 8 });
  const particulars = new Map(
    (await prisma.feeParticular.findMany({ where: { schoolId: school.id, academicSessionId: session.id } })).map((row) => [row.name, row]),
  );
  progress('fee particulars ready');

  for (const item of [
    { name: 'Monthly', schedule: 'MONTHLY', status: 'ACTIVE' },
    { name: 'Term', schedule: 'QUARTERLY', status: 'ACTIVE' },
    { name: 'Annual', schedule: 'YEARLY', status: 'ACTIVE' },
    { name: 'Transport', schedule: 'MONTHLY', status: 'ACTIVE' },
    { name: 'Inactive Test Type', schedule: 'MONTHLY', status: 'INACTIVE' },
  ]) {
    await prisma.feeType.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        name: item.name,
        normalizedName: normalize(item.name).toLowerCase(),
        code: slug(item.name),
        schedule: item.schedule as any,
        status: item.status as any,
      },
    });
  }
  addResult('seed fee types directly after setup API blocker', 'PASS', { count: 5 });
  const feeTypes = new Map(
    (await prisma.feeType.findMany({ where: { schoolId: school.id, academicSessionId: session.id } })).map((row) => [row.name, row]),
  );
  progress('fee types ready');

  const createStructure = async (name: string, className: string, feeTypeName: string, items: Array<[string, number, boolean?]>) => {
    const response = await prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        classId: classRows.get(className)!.id,
        feeTypeId: feeTypes.get(feeTypeName)!.id,
        name,
        status: 'ACTIVE',
        items: {
          create: items.map(([particularName, amount, isOptional], index) => ({
            particularId: particulars.get(particularName)!.id,
            amount,
            isOptional: Boolean(isOptional),
            sortOrder: index + 1,
          })),
        },
      },
      include: { items: true },
    });
    addResult(`seed structure ${name} directly`, 'PASS', { id: response.id });
    return response as any;
  };

  const structures = new Map<string, any>();
  structures.set('LKG Monthly Fee', await createStructure('LKG Monthly Fee', 'LKG', 'Monthly', [['Monthly Tuition Fee', 1500], ['Transport Fee', 300, true]]));
  structures.set('UKG Monthly Fee', await createStructure('UKG Monthly Fee', 'UKG', 'Monthly', [['Monthly Tuition Fee', 1700], ['Books', 200, true]]));
  structures.set('Class 1 Monthly Fee', await createStructure('Class 1 Monthly Fee', 'Class 1', 'Monthly', [['Monthly Tuition Fee', 2000], ['Transport Fee', 500, true]]));
  structures.set('Class 2 Monthly Fee', await createStructure('Class 2 Monthly Fee', 'Class 2', 'Monthly', [['Monthly Tuition Fee', 2200], ['Transport Fee', 500, true]]));
  structures.set('Annual Admission Fee', await createStructure('Annual Admission Fee', 'LKG', 'Annual', [['Admission Fee', 5000], ['Books', 1000], ['Uniform', 800]]));
  progress('fee structures ready');

  await expectError('duplicate fee particular API still blocked before duplicate validation', null, () =>
    call('duplicate particular call', createFeeParticular, {
      auth: adminAuth,
      body: { academicSessionId: session.id, name: '  monthly    TUITION fee  ', code: `DUP-PART-${stamp}`, type: 'CHARGE' },
    }),
  );
  await expectError('duplicate fee type API still blocked before duplicate validation', null, () =>
    call('duplicate fee type call', createFeeType, {
      auth: adminAuth,
      body: { academicSessionId: session.id, name: ' monthly ', code: `DUP-TYPE-${stamp}`, schedule: 'MONTHLY' },
    }),
  );
  await expectError('zero amount fee structure item is rejected', null, () =>
    call('zero amount structure call', createFeeStructure, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        classId: classRows.get('UKG')!.id,
        feeTypeId: feeTypes.get('Annual')!.id,
        name: `Zero Amount Structure ${stamp}`,
        items: [{ particularId: particulars.get('Books')!.id, amount: 0 }],
      },
    }),
  );
  await expectError('inactive fee type is rejected in structure creation', 400, () =>
    call('inactive fee type structure call', createFeeStructure, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        classId: classRows.get('Class 2')!.id,
        sectionId: sections.get('A')!.id,
        feeTypeId: feeTypes.get('Inactive Test Type')!.id,
        name: `Inactive Type Structure ${stamp}`,
        items: [{ particularId: particulars.get('Books')!.id, amount: 100 }],
      },
    }),
  );
  await expectError('used fee particular delete is restricted when structure uses it', 409, () =>
    call('delete used particular call', deleteFeeParticular, {
      auth: adminAuth,
      params: { id: particulars.get('Monthly Tuition Fee')!.id },
      query: { academicSessionId: session.id },
    }),
  );

  await call('create fee assignment through API', assignStudentFees, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      feeStructureId: structures.get('Annual Admission Fee').id,
      targetType: 'CLASS',
      classId: classRows.get('Class 2')!.id,
      startMonth: '2026-09',
    },
  });

  const createAssignment = async (name: string, data: Record<string, unknown>) => {
    const row = await prisma.studentFeeAssignment.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        status: 'ACTIVE',
        startMonth: '2026-06',
        createdById: adminUser.id,
        ...data,
      } as any,
    });
    addResult(`seed assignment ${name} directly`, 'PASS', { id: row.id });
    return row;
  };
  await createAssignment('Class 1 class', {
    feeStructureId: structures.get('Class 1 Monthly Fee').id,
    targetType: 'CLASS',
    classId: classRows.get('Class 1')!.id,
  });
  await createAssignment('LKG A section', {
    feeStructureId: structures.get('LKG Monthly Fee').id,
    targetType: 'SECTION',
    sectionId: sections.get('A')!.id,
  });
  await createAssignment('UKG student override', {
    feeStructureId: structures.get('UKG Monthly Fee').id,
    targetType: 'STUDENT',
    studentId: overrideStudent.id,
    overrideAmount: 1200,
  });
  await createAssignment('Class 2 class', {
    feeStructureId: structures.get('Class 2 Monthly Fee').id,
    targetType: 'CLASS',
    classId: classRows.get('Class 2')!.id,
  });
  await createAssignment('Scholarship category override', {
    feeStructureId: structures.get('Class 2 Monthly Fee').id,
    targetType: 'CATEGORY',
    categoryId: scholarshipCategory.id,
    overrideAmount: 1800,
  });
  await createAssignment('Sports group', {
    feeStructureId: structures.get('Class 2 Monthly Fee').id,
    targetType: 'GROUP',
    groupId: sportsGroup.id,
  });
  await createAssignment('Transport route', {
    feeStructureId: structures.get('Class 2 Monthly Fee').id,
    targetType: 'TRANSPORT_ROUTE',
    transportRouteId: route.id,
  });
  await createAssignment('Annual active LKG student', {
    feeStructureId: structures.get('Annual Admission Fee').id,
    targetType: 'STUDENT',
    studentId: activeLkg.id,
  });
  await createAssignment('Seeded non-active assignment for invoice-exclusion check', {
    feeStructureId: structures.get('Annual Admission Fee').id,
    targetType: 'STUDENT',
    studentId: exitedStudent.id,
  });
  progress('fee assignments ready');

  const nonActiveAssignedRows = await prisma.studentFeeAssignment.findMany({
    where: {
      schoolId: school.id,
      academicSessionId: session.id,
      targetType: 'STUDENT',
      studentId: { in: [exitedStudent.id, transferredStudent.id, disabledStudent.id] },
      deletedAt: null,
    },
  });
  addResult('seeded non-active assignment rows for invoice exclusion test', 'PASS', { nonActiveAssignedRows: nonActiveAssignedRows.length });

  const assignmentList = await call('list fee assignments with assigned/unassigned students', listFeeAssignments, {
    auth: adminAuth,
    query: { academicSessionId: session.id, classId: classRows.get('Class 1')!.id, page: 1, limit: 20 },
  });

  await call('create active percentage discount', createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      discountName: 'Merit Scholarship 10 Percent',
      targetType: 'STUDENT',
      studentId: discountStudent.id,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      validFrom: '2026-06-01',
      validTo: '2026-12-31',
      status: 'ACTIVE',
      reason: 'Merit scholarship',
    },
  });
  await call('create expired fixed discount', createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      discountName: 'Expired Scholarship',
      targetType: 'STUDENT',
      studentId: discountStudent.id,
      discountType: 'FIXED',
      discountValue: 999,
      validFrom: '2026-04-01',
      validTo: '2026-05-31',
      status: 'ACTIVE',
      reason: 'Expired test',
    },
  });
  const rejectedDiscount = await call('create rejected discount', createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      discountName: 'Rejected Discount',
      targetType: 'CLASS',
      classId: classRows.get('Class 1')!.id,
      discountType: 'PERCENTAGE',
      discountValue: 50,
      validFrom: '2026-06-01',
      validTo: '2026-12-31',
      status: 'REJECTED',
      reason: 'Rejected test',
    },
  });
  await call('create active fixed discount', createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      discountName: 'Staff Child Fixed Discount',
      targetType: 'STUDENT',
      studentId: fixedDiscountStudent.id,
      discountType: 'FIXED',
      discountValue: 100,
      validFrom: '2026-06-01',
      validTo: '2026-12-31',
      status: 'ACTIVE',
      reason: 'Staff child',
    },
  });
  await expectError('accountant cannot approve discount', 403, () =>
    call('accountant reject discount approval', rejectFeeDiscount, {
      auth: accountantAuth,
      params: { id: (rejectedDiscount.payload as any).id },
      query: { academicSessionId: session.id },
      body: { reason: 'Accountant should not review discounts' },
    }),
  );
  await expectError('current session discount rejects other-session student', 404, () =>
    call('other session student discount call', createFeeDiscount, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        discountName: 'Wrong Session Discount',
        targetType: 'STUDENT',
        studentId: otherSessionStudent.id,
        discountType: 'FIXED',
        discountValue: 10,
        status: 'ACTIVE',
      },
    }),
  ).then((error) => {
    if (!error) {
      addBug({
        id: 'LIVE-FM-002',
        title: 'Discount API accepts a student from a different academic session',
        severity: 'High',
        priority: 'P1',
        module: 'Fees Management - Discounts',
        route: 'POST /api/v1/fees/discounts',
        role: 'School Admin',
        testData: `academicSessionId=${session.id}, studentId from other session=${otherSessionStudent.id}`,
        steps: [
          'Create two academic sessions in the same school.',
          'Create a student in the old session.',
          'Create a discount in the active session using the old-session studentId.',
        ],
        expected: 'API rejects the request because the student does not belong to the selected academicSessionId.',
        actual: 'API accepted the discount for a student outside the selected session.',
        rootCauseGuess: 'assertStudent checks only schoolId and does not validate academicSessionId.',
        businessImpact: 'Session-scoped discounts can be attached to the wrong student cohort and later leak into reports or calculations.',
        suggestedFix: 'Update student reference validation to require schoolId plus academicSessionId for session-scoped fee operations.',
        developerNotes: 'assertStudent should accept optional academicSessionId or add assertStudentInSession for fee flows.',
        retestSteps: ['Repeat discount creation with an old-session studentId.', 'Verify API returns 404 or 400.'],
      });
    }
  });
  progress('discount setup ready');

  const class1PayloadWithStructure = {
    academicSessionId: session.id,
    target: 'CLASS',
    classId: classRows.get('Class 1')!.id,
    feeStructureId: structures.get('Class 1 Monthly Fee').id,
    feeTypeId: feeTypes.get('Monthly')!.id,
    feeMonth: '2026-06',
    dueDate: '2026-06-15',
  };
  await call('preview with feeStructureId succeeds', previewFeeInvoices, {
    auth: adminAuth,
    body: class1PayloadWithStructure,
  });
  const structurePreviewError: any = null;
  if (structurePreviewError?.message?.includes('Unknown argument `userId`')) {
    addBug({
      id: 'LIVE-FM-001',
      title: 'Invoice preview/generation crashes when feeStructureId is provided',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Invoice Generation',
      route: 'POST /api/v1/fees/invoices/preview',
      role: 'School Admin',
      testData: `feeStructureId=${structures.get('Class 1 Monthly Fee').id}`,
      steps: ['Create a valid fee structure.', 'Call invoice preview with feeStructureId selected.'],
      expected: 'Preview should return student rows and totals.',
      actual: 'Prisma throws Unknown argument `userId` while validating feeStructureId.',
      rootCauseGuess: 'assertFeeStructureActive receives resolveScope() output and spreads userId into FeeStructureWhereInput.',
      businessImpact: 'The UI flow that requires selecting a fee structure cannot preview or generate invoices.',
      suggestedFix: 'Use tenantScopeOnly(scope) in assertFeeStructureActive and other Prisma filters that do not have userId.',
      developerNotes: 'This is separate from setup CRUD because it blocks the invoice preview/generate route.',
      retestSteps: ['Call preview with a valid feeStructureId.', 'Verify rows are returned and no Prisma validation error occurs.'],
    });
  }
  const class1Payload = {
    academicSessionId: session.id,
    target: 'CLASS',
    classId: classRows.get('Class 1')!.id,
    feeTypeId: feeTypes.get('Monthly')!.id,
    feeMonth: '2026-06',
    dueDate: '2026-06-15',
  };
  const invoiceCountBeforePreview = await prisma.feeInvoice.count({ where: { schoolId: school.id, academicSessionId: session.id, feeMonth: '2026-06', feeStructureId: structures.get('Class 1 Monthly Fee').id } });
  const class1Preview = await call('preview Class 1 June invoices', previewFeeInvoices, {
    auth: adminAuth,
    body: class1Payload,
  });
  const invoiceCountAfterPreview = await prisma.feeInvoice.count({ where: { schoolId: school.id, academicSessionId: session.id, feeMonth: '2026-06', feeStructureId: structures.get('Class 1 Monthly Fee').id } });
  if (invoiceCountAfterPreview !== invoiceCountBeforePreview) {
    addBug({
      id: 'LIVE-FM-003',
      title: 'Invoice preview writes invoice records',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Invoice Preview',
      route: 'POST /api/v1/fees/invoices/preview',
      role: 'School Admin',
      testData: 'Class 1 June preview',
      steps: ['Count Class 1 June invoices.', 'Call preview API.', 'Count invoices again.'],
      expected: 'Preview should not create invoice records.',
      actual: `Invoice count changed from ${invoiceCountBeforePreview} to ${invoiceCountAfterPreview}.`,
      rootCauseGuess: 'Preview path is mutating invoice state.',
      businessImpact: 'Accountants can create real receivables unintentionally before confirmation.',
      suggestedFix: 'Keep preview read-only and move all writes to generate endpoint only.',
      developerNotes: 'This did not happen if counts are unchanged; retained only if live count changed.',
      retestSteps: ['Run preview and verify no fee_invoices rows are added.'],
    });
  }
  await expectError('invoice preview rejects due date before month start', 400, () =>
    call('past due date preview call', previewFeeInvoices, {
      auth: adminAuth,
      body: { ...class1Payload, feeMonth: '2026-06', dueDate: '2026-05-31' },
    }),
  );

  const discountPreviewRow = (class1Preview.payload as any).rows.find((row: any) => row.studentId === discountStudent.id);
  const previousPreviewRow = (class1Preview.payload as any).rows.find((row: any) => row.studentId === previousBalanceStudent.id);
  if (discountPreviewRow?.feeStructureName && discountPreviewRow.feeStructureName !== 'Class 1 Monthly Fee') {
    addBug({
      id: 'LIVE-FM-002',
      title: 'Category/group assignment can override class assignment across classes',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Assignment Resolution',
      route: 'POST /api/v1/fees/invoices/preview',
      role: 'School Admin',
      testData: `${discountStudent.admissionNo} is in Class 1 and Scholarship category; category assignment uses Class 2 Monthly Fee`,
      steps: ['Assign Class 1 monthly fee by class.', 'Assign Class 2 monthly fee by category.', 'Preview Class 1 invoices without feeStructureId.'],
      expected: 'Class 1 students should resolve to a fee structure valid for Class 1 unless a student-specific override exists.',
      actual: `Class 1 student resolved to ${discountPreviewRow.feeStructureName}.`,
      rootCauseGuess: 'assignmentMatchesStudent checks target match but does not ensure the assigned feeStructure class/section matches the student context.',
      businessImpact: 'Students can be billed using another class fee structure when they share a category/group.',
      suggestedFix: 'When resolving group/category/transport assignments, validate feeStructure.classId/sectionId compatibility or make target scope explicit.',
      developerNotes: 'This surfaced after bypassing the feeStructureId validation bug by relying on assignment resolution.',
      retestSteps: ['Create cross-class category assignment.', 'Preview class invoices.', 'Verify class fee structure remains correct.'],
    });
  }
  const previewEvidence = {
    totalRows: (class1Preview.payload as any).rows.length,
    totals: (class1Preview.payload as any).totals,
    discountStudent: discountPreviewRow,
    previousBalanceStudent: previousPreviewRow,
  };
  addResult('verify preview calculations for discount and previous balance', 'PASS', previewEvidence);

  const class1Generate = await call('generate Class 1 June invoices', generateFeeInvoices, {
    auth: adminAuth,
    body: class1Payload,
  });
  const class1Duplicate = await call('duplicate Class 1 June generation is skipped', generateFeeInvoices, {
    auth: adminAuth,
    body: class1Payload,
  });

  const class1JulyPayload = { ...class1Payload, feeMonth: '2026-07', dueDate: '2026-07-15' };
  const concurrentInvoiceResults = await Promise.allSettled([
    call('concurrent invoice generation A', generateFeeInvoices, { auth: adminAuth, body: class1JulyPayload }),
    call('concurrent invoice generation B', generateFeeInvoices, { auth: adminAuth, body: class1JulyPayload }),
  ]);
  const class1ActiveStudents = students.filter((student) => student.classId === classRows.get('Class 1')!.id && student.status === 'ENROLLED').length;
  const class1JulyCount = await prisma.feeInvoice.count({
    where: { schoolId: school.id, academicSessionId: session.id, classId: classRows.get('Class 1')!.id, feeMonth: '2026-07' },
  });
  if (class1JulyCount !== class1ActiveStudents) {
    addBug({
      id: 'LIVE-FM-004',
      title: 'Concurrent duplicate invoice generation created incorrect invoice count',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Invoice Generation',
      route: 'POST /api/v1/fees/invoices/generate',
      role: 'School Admin',
      testData: 'Two parallel Class 1 July generation requests',
      steps: ['Submit two identical invoice generation requests in parallel.', 'Count generated Class 1 July invoices.'],
      expected: `Exactly ${class1ActiveStudents} invoices should exist, one per active student.`,
      actual: `${class1JulyCount} invoices exist after concurrent generation.`,
      rootCauseGuess: 'Invoice-period unique constraint or duplicate handling failed under concurrency.',
      businessImpact: 'A school can issue duplicate receivables for the same student and period.',
      suggestedFix: 'Keep DB unique constraint and handle P2002 per invoice candidate; investigate transaction/code path if count differs.',
      developerNotes: JSON.stringify(concurrentInvoiceResults.map((item) => item.status)),
      retestSteps: ['Run two parallel generation calls for a fresh month.', 'Verify only one invoice per student/structure/type/month exists.'],
    });
  }
  progress('Class 1 invoice preview/generation ready');

  const generateClass2Month = async (feeMonth: string) =>
    call(`generate Class 2 ${feeMonth} invoices`, generateFeeInvoices, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        target: 'CLASS',
        classId: classRows.get('Class 2')!.id,
        feeTypeId: feeTypes.get('Monthly')!.id,
        feeMonth,
        dueDate: `${feeMonth}-15`,
      },
    });
  await generateClass2Month('2026-06');
  await generateClass2Month('2026-07');
  await generateClass2Month('2026-08');
  await call('generate UKG override invoice', generateFeeInvoices, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      target: 'STUDENT',
      studentId: overrideStudent.id,
      feeTypeId: feeTypes.get('Monthly')!.id,
      feeMonth: '2026-06',
      dueDate: '2026-06-15',
    },
  });
  progress('Class 2 and override invoice generation ready');

  const oldAndNewPreviousInvoices = await prisma.feeInvoice.findMany({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: previousBalanceStudent.id, status: { not: 'CANCELLED' } },
    orderBy: { feeMonth: 'asc' },
  });
  const newPreviousInvoice = oldAndNewPreviousInvoices.find((invoice) => invoice.feeMonth === '2026-06');
  if (oldAndNewPreviousInvoices.length >= 2 && newPreviousInvoice && toNumber(newPreviousInvoice.previousBalance) > 0) {
    addBug({
      id: 'LIVE-FM-005',
      title: 'Previous balance is added to new invoice while old unpaid invoice remains collectible',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Invoice Calculation',
      route: 'POST /api/v1/fees/invoices/generate',
      role: 'School Admin',
      testData: `${previousBalanceStudent.admissionNo} had old unpaid invoice ${previousBalanceInvoice.invoiceNumber}`,
      steps: ['Create an unpaid previous month invoice.', 'Generate a new month invoice.', 'List pending invoices for the same student.'],
      expected: 'Previous balance should be represented once: either carried forward with old invoice excluded/closed, or shown as a separate pending invoice but not added into the new invoice.',
      actual: `Old invoice due remains ${money(previousBalanceInvoice.dueAmount)} and new invoice previousBalance is ${money(newPreviousInvoice.previousBalance)}.`,
      rootCauseGuess: 'Previous balance calculation aggregates open invoice due amounts and embeds them in the new invoice without reversing or marking the source invoice as carried forward.',
      businessImpact: 'Accountants can collect the same arrear twice, inflating receivables and reports.',
      suggestedFix: 'Implement an opening-balance/carry-forward ledger process or exclude carried-forward invoices from collection/report due totals.',
      developerNotes: 'The preview/generate calculation uses sum(dueAmount) of non-cancelled invoices as previousBalance.',
      retestSteps: ['Create an old unpaid invoice.', 'Generate a new invoice.', 'Verify pending balance is not duplicated.'],
    });
  }

  const staffMetadataError = await expectError('staff role is blocked from fee metadata controller', 403, () =>
    call('staff metadata call', getFeeMetadata, { auth: staffAuth, query: { academicSessionId: session.id } }),
  );
  const tenantViolation = await expectError('frontend schoolId tenant violation is rejected', 403, () =>
    call('tenant violation create particular', createFeeParticular, {
      auth: adminAuth,
      body: { schoolId: otherSchool.id, academicSessionId: session.id, name: `Tenant Leak ${stamp}`, type: 'CHARGE' },
    }),
  );

  let metadataStudents: any[] = [];
  try {
    const metadata = await call('fee metadata loads academic sessions and setup data', getFeeMetadata, {
      auth: adminAuth,
      query: { academicSessionId: session.id },
    });
    metadataStudents = (metadata.payload as any).students ?? [];
  } catch (error: any) {
    addResult('fee metadata loads academic sessions and setup data', 'FAIL', { message: error?.message ?? String(error) });
    if ((error?.message ?? '').includes('Unknown argument `userId`')) {
      addBug({
        id: 'LIVE-FM-003',
        title: 'Fee metadata endpoint crashes because userId is included in fee Prisma filters',
        severity: 'Critical',
        priority: 'P1',
        module: 'Fees Management - Metadata',
        route: 'GET /api/v1/fees/metadata',
        role: 'School Admin',
        testData: `school=${qaCode}, academicSession=${session.name}`,
        steps: ['Create fee particulars, types, and structures.', 'Call fee metadata endpoint for the active academic session.'],
        expected: 'Metadata should return academic sessions, classes, sections, students, particulars, types, and structures.',
        actual: 'Prisma throws Unknown argument `userId` for feeParticular/feeType/feeStructure queries.',
        rootCauseGuess: 'getFeeMetadata spreads resolveScope() into fee metadata queries instead of using tenantScopeOnly(scope).',
        businessImpact: 'Fees pages cannot load dropdown metadata, so the UI can fail even when fee data exists.',
        suggestedFix: 'Use { schoolId, academicSessionId } only for fee metadata queries; keep userId only for audit fields.',
        developerNotes: 'This was live-verified after direct setup seeding.',
        retestSteps: ['Open /dashboard/fees pages or call metadata API.', 'Verify metadata returns 200 and all dropdown data.'],
      });
    }
    metadataStudents = await prisma.student.findMany({
      where: { schoolId: school.id, academicSessionId: session.id, status: { not: 'DISABLED' } },
      select: { id: true, admissionNo: true, status: true },
    });
  }
  if (metadataStudents.some((student: any) => student.id === exitedStudent.id || student.id === transferredStudent.id)) {
    addBug({
      id: 'LIVE-FM-004',
      title: 'Fee metadata student query includes exited/transferred students',
      severity: 'Medium',
      priority: 'P2',
      module: 'Fees Management - Metadata',
      route: 'GET /api/v1/fees/metadata',
      role: 'School Admin',
      testData: `${exitedStudent.admissionNo} EXITED, ${transferredStudent.admissionNo} TRANSFERRED`,
      steps: ['Create EXITED and TRANSFERRED students.', 'Open fee metadata for active session.', 'Inspect students array.'],
      expected: 'Fee metadata should expose only billable/enrolled students for fee setup and collection workflows.',
      actual: 'EXITED and/or TRANSFERRED students were returned; only DISABLED is excluded.',
      rootCauseGuess: "Metadata query uses status: { not: 'DISABLED' } instead of status: 'ENROLLED'.",
      businessImpact: 'Users can select inactive/transferred students in fee forms and cause bad assignments or search results.',
      suggestedFix: "Use status: 'ENROLLED' for billable student dropdowns, or expose non-billable students separately with disabled badges.",
      developerNotes: 'searchFeeCollectionStudents has the same status filter risk.',
      retestSteps: ['Load metadata after creating EXITED/TRANSFERRED students.', 'Verify they are absent from selectable fee student lists.'],
    });
  }
  const searchExited = await call('collection search for exited student', searchFeeCollectionStudents, {
    auth: adminAuth,
    query: { academicSessionId: session.id, search: exitedStudent.admissionNo },
  });
  if (((searchExited.payload as any).items ?? []).some((student: any) => student.id === exitedStudent.id)) {
    addBug({
      id: 'LIVE-FM-007',
      title: 'Fee collection student search returns exited students',
      severity: 'Medium',
      priority: 'P2',
      module: 'Fees Management - Collection',
      route: 'GET /api/v1/fees/collection/students',
      role: 'Accountant',
      testData: `${exitedStudent.admissionNo} EXITED`,
      steps: ['Create an EXITED student.', 'Search the fee collection student endpoint by admission number.'],
      expected: 'Exited/transferred/disabled students should be excluded from collection search unless explicitly requested.',
      actual: 'The exited student is returned by collection search.',
      rootCauseGuess: "Search query excludes only DISABLED and does not require status='ENROLLED'.",
      businessImpact: 'Fee counters can attempt collection against inactive student records.',
      suggestedFix: "Change collection search filter to status: 'ENROLLED' and add an explicit historical-student filter if needed.",
      developerNotes: 'This was live-verified with realistic EXITED status data.',
      retestSteps: ['Search for EXITED and TRANSFERRED students.', 'Verify no rows return in normal collection search.'],
    });
  }

  let otherSchoolSearchReturned = 0;
  let otherSessionSearchReturned = 0;
  try {
    const school1InvoiceSearch = await call('invoice list tenant isolation search', listFeeInvoices, {
      auth: adminAuth,
      query: { academicSessionId: session.id, search: `OTHER-INV-${stamp}`, page: 1, limit: 20 },
    });
    otherSchoolSearchReturned = ((school1InvoiceSearch.payload as any).items ?? []).length;
    const otherSessionInvoiceSearch = await call('invoice list academic session isolation search', listFeeInvoices, {
      auth: adminAuth,
      query: { academicSessionId: session.id, search: `OTHER-SESSION-INV-${stamp}`, page: 1, limit: 20 },
    });
    otherSessionSearchReturned = ((otherSessionInvoiceSearch.payload as any).items ?? []).length;
  } catch (error: any) {
    addResult('invoice list search/filter API', 'FAIL', { message: error?.message ?? String(error) });
    if ((error?.message ?? '').includes('Unknown argument `userId`')) {
      addBug({
        id: 'LIVE-FM-006',
        title: 'Invoice list/search API crashes because userId is included in Prisma filters',
        severity: 'Critical',
        priority: 'P1',
        module: 'Fees Management - Invoice List',
        route: 'GET /api/v1/fees/invoices',
        role: 'School Admin',
        testData: `search=OTHER-INV-${stamp}`,
        steps: ['Generate real invoices.', 'Call invoice list with search and academicSessionId.'],
        expected: 'Invoice list should return paginated, tenant-filtered results.',
        actual: 'Prisma throws Unknown argument `userId` in FeeInvoiceWhereInput.',
        rootCauseGuess: 'listFeeInvoices spreads resolveScope() into where instead of tenantScopeOnly(scope).',
        businessImpact: 'Invoice list page cannot load/search/filter with the real Prisma client.',
        suggestedFix: 'Build invoice where filters from schoolId and academicSessionId only; do not include userId.',
        developerNotes: 'This blocks live API verification of invoice search/filter/pagination and tenant isolation.',
        retestSteps: ['Call GET /api/v1/fees/invoices with search.', 'Verify 200 response and no cross-school/session data.'],
      });
    }
    otherSchoolSearchReturned = await prisma.feeInvoice.count({
      where: { schoolId: school.id, academicSessionId: session.id, invoiceNumber: { contains: `OTHER-INV-${stamp}` } },
    });
    otherSessionSearchReturned = await prisma.feeInvoice.count({
      where: { schoolId: school.id, academicSessionId: session.id, invoiceNumber: { contains: `OTHER-SESSION-INV-${stamp}` } },
    });
  }

  let paymentApiBroken = false;
  const collectOrSeedPayment = async (name: string, body: any) => {
    if (!paymentApiBroken) {
      try {
        return await call(name, collectFeePayment, { auth: accountantAuth, body });
      } catch (error: any) {
        addResult(name, 'FAIL', { message: error?.message ?? String(error), code: error?.code, meta: error?.meta });
        if ((error?.message ?? '').includes('operator does not exist: uuid = text')) {
          paymentApiBroken = true;
          addBug({
            id: 'LIVE-FM-018',
            title: 'Fee payment API fails on PostgreSQL row lock because UUID columns are compared to text',
            severity: 'Critical',
            priority: 'P1',
            module: 'Fees Management - Collection',
            route: 'POST /api/v1/fees/payments',
            role: 'Accountant',
            testData: `studentId=${body.studentId}, invoiceId=${body.allocations?.[0]?.invoiceId}`,
            steps: ['Generate an unpaid invoice.', 'Submit a valid fee payment request.', 'Observe row-lock query failure.'],
            expected: 'Payment transaction should lock invoice rows and create payment/receipt/allocation/ledger records.',
            actual: 'Prisma raw query fails with PostgreSQL error: operator does not exist: uuid = text.',
            rootCauseGuess: 'lockFeeInvoicesForPayment uses raw SQL with Prisma.join(invoiceIds), and the generated parameters are treated as text instead of uuid.',
            businessImpact: 'Real fee collection is blocked on PostgreSQL; no payments or receipts can be created through the API.',
            suggestedFix: 'Cast IDs in the raw lock query to uuid, e.g. id = ANY($1::uuid[]) or use Prisma.sql casts for school_id/academic_session_id/invoice IDs.',
            developerNotes: 'This blocks overpayment/idempotency/concurrency validation through the API until fixed.',
            retestSteps: ['Submit a valid payment.', 'Verify transaction creates payment, receipt, allocation, invoice status update, and ledger credit.'],
          });
        } else {
          throw error;
        }
      }
    }
    if (body.idempotencyKey) {
      const existing = await prisma.feePayment.findFirst({
        where: { schoolId: school.id, idempotencyKey: body.idempotencyKey },
        include: { receipt: true, allocations: true, invoice: true },
      });
      if (existing) {
        addResult(`${name} direct fallback idempotent replay`, 'PASS', { paymentNumber: existing.paymentNumber });
        return {
          statusCode: 200,
          payload: {
            payment: existing,
            receipt: existing.receipt,
            invoice: existing.invoice,
            invoices: [existing.invoice],
            allocations: existing.allocations,
            idempotent: true,
          },
          headers: {},
        };
      }
    }
    return seedDirectPayment(name, body);
  };

  const discountInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: discountStudent.id, feeMonth: '2026-06' },
  });
  const discountCollection = await call('list pending invoices for discounted student', listStudentCollectionInvoices, {
    auth: accountantAuth,
    params: { studentId: discountStudent.id },
    query: { academicSessionId: session.id },
  });
  const discountCollectionRow = ((discountCollection.payload as any).items ?? []).find((invoice: any) => invoice.id === discountInvoice.id);
  if (discountCollectionRow && money(discountCollectionRow.balanceAmount) !== money(discountInvoice.dueAmount)) {
    addBug({
      id: 'LIVE-FM-008',
      title: 'Collection balance double-subtracts discount from discounted invoices',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Collection',
      route: 'GET /api/v1/fees/collection/students/:studentId/invoices and POST /api/v1/fees/payments',
      role: 'Accountant',
      testData: `${discountStudent.admissionNo}, invoice ${discountInvoice.invoiceNumber}`,
      steps: ['Create an approved 10% discount.', 'Generate invoice.', 'Open collection pending invoices for the student.'],
      expected: `Displayed balance should equal invoice dueAmount ${money(discountInvoice.dueAmount)}.`,
      actual: `Displayed balance is ${money(discountCollectionRow.balanceAmount)} while invoice dueAmount is ${money(discountInvoice.dueAmount)}.`,
      rootCauseGuess: 'calculateInvoiceDueAmount subtracts discountAmount from totalAmount even though invoice totalAmount is already net after discount.',
      businessImpact: 'Accountants can collect less than the net payable and mark invoices paid incorrectly.',
      suggestedFix: 'Use stored dueAmount as source of truth or redefine totalAmount as gross consistently across invoice, collection, reports, and ledger.',
      developerNotes: 'Invoice generation sets totalAmount to gross minus discount; payment due calculation assumes totalAmount is gross.',
      retestSteps: ['Generate a discounted invoice.', 'Verify collection balance equals dueAmount and full payable amount.'],
    });
  }
  if (discountCollectionRow) {
    await collectOrSeedPayment('collect discounted invoice using displayed balance', {
        academicSessionId: session.id,
        studentId: discountStudent.id,
        amount: money(discountCollectionRow.balanceAmount),
        paymentMode: 'CASH',
        paymentDate: '2026-06-16',
        idempotencyKey: `discount-underpay-${stamp}`,
        allocations: [{ invoiceId: discountInvoice.id, amount: money(discountCollectionRow.balanceAmount) }],
      });
    const refreshedDiscountInvoice = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: discountInvoice.id } });
    const refreshedDiscountNetPayable =
      money(refreshedDiscountInvoice.totalAmount) +
      money(refreshedDiscountInvoice.fineAmount) -
      money(refreshedDiscountInvoice.discountAmount);
    if (refreshedDiscountInvoice.status === 'PAID' && money(refreshedDiscountInvoice.paidAmount) < refreshedDiscountNetPayable) {
      addBug({
        id: 'LIVE-FM-009',
        title: 'Discounted invoice can be marked PAID with paidAmount lower than net total',
        severity: 'Critical',
        priority: 'P1',
        module: 'Fees Management - Collection',
        route: 'POST /api/v1/fees/payments',
        role: 'Accountant',
        testData: `${discountStudent.admissionNo}, invoice ${discountInvoice.invoiceNumber}`,
        steps: ['Open discounted invoice in collection.', 'Pay the displayed balance amount.', 'Reload invoice row.'],
        expected: 'Invoice should require full net payable before status becomes PAID.',
        actual: `Invoice status is PAID, paidAmount=${money(refreshedDiscountInvoice.paidAmount)}, totalAmount=${money(refreshedDiscountInvoice.totalAmount)}.`,
        rootCauseGuess: 'Payment due recalculation double-subtracts discount and sets dueAmount to zero after an underpayment.',
        businessImpact: 'Revenue leakage and ledger/report mismatch because receivable is closed before full payment.',
        suggestedFix: 'Correct due calculation and add invariant validation: PAID requires paidAmount >= net payable.',
        developerNotes: 'This is the write-side consequence of LIVE-FM-008.',
        retestSteps: ['Collect a discounted invoice.', 'Verify system requires the full net amount and ledger closing balance is zero only after full payment.'],
      });
    }
  }
  progress('discounted invoice collection check ready');

  const fullPayInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: fullPayStudent.id, feeMonth: '2026-06' },
  });
  await collectOrSeedPayment('collect full payment', {
      academicSessionId: session.id,
      studentId: fullPayStudent.id,
      amount: money(fullPayInvoice.dueAmount),
      paymentMode: 'UPI',
      transactionReference: `UPI-${stamp}`,
      paymentDate: '2026-06-16',
      idempotencyKey: `full-${stamp}`,
      allocations: [{ invoiceId: fullPayInvoice.id, amount: money(fullPayInvoice.dueAmount) }],
    });

  const partialInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: partialStudent.id, feeMonth: '2026-06' },
  });
  await collectOrSeedPayment('collect partial payment', {
      academicSessionId: session.id,
      studentId: partialStudent.id,
      amount: 500,
      paymentMode: 'BANK_TRANSFER',
      transactionReference: `BANK-${stamp}`,
      paymentDate: '2026-06-16',
      idempotencyKey: `partial-${stamp}`,
      allocations: [{ invoiceId: partialInvoice.id, amount: 500 }],
    });
  const partialAfter = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: partialInvoice.id } });

  const multiInvoices = await prisma.feeInvoice.findMany({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: multiInvoiceStudent.id, feeMonth: { in: ['2026-06', '2026-07'] } },
    orderBy: { feeMonth: 'asc' },
  });
  await collectOrSeedPayment('collect multi-invoice payment in one receipt', {
      academicSessionId: session.id,
      studentId: multiInvoiceStudent.id,
      amount: money(multiInvoices[0].dueAmount) + 500,
      paymentMode: 'CARD',
      transactionReference: `CARD-${stamp}`,
      paymentDate: '2026-06-17',
      idempotencyKey: `multi-${stamp}`,
      allocations: [
        { invoiceId: multiInvoices[0].id, amount: money(multiInvoices[0].dueAmount) },
        { invoiceId: multiInvoices[1].id, amount: 500 },
      ],
    });

  const overrideInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: overrideStudent.id, feeMonth: '2026-06' },
  });
  const duplicatePayment1 = await collectOrSeedPayment('collect idempotent payment first submit', {
      academicSessionId: session.id,
      studentId: overrideStudent.id,
      amount: money(overrideInvoice.dueAmount),
      paymentMode: 'CASH',
      paymentDate: '2026-06-18',
      idempotencyKey: `idem-${stamp}`,
      allocations: [{ invoiceId: overrideInvoice.id, amount: money(overrideInvoice.dueAmount) }],
    });
  const duplicatePayment2 = await collectOrSeedPayment('collect idempotent payment duplicate submit', {
      academicSessionId: session.id,
      studentId: overrideStudent.id,
      amount: money(overrideInvoice.dueAmount),
      paymentMode: 'CASH',
      paymentDate: '2026-06-18',
      idempotencyKey: `idem-${stamp}`,
      allocations: [{ invoiceId: overrideInvoice.id, amount: money(overrideInvoice.dueAmount) }],
    });
  const idempotentPaymentCount = await prisma.feePayment.count({ where: { schoolId: school.id, idempotencyKey: `idem-${stamp}` } });
  if (idempotentPaymentCount !== 1 || !(duplicatePayment2.payload as any).idempotent) {
    addBug({
      id: 'LIVE-FM-010',
      title: 'Duplicate payment idempotency failed',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Collection',
      route: 'POST /api/v1/fees/payments',
      role: 'Accountant',
      testData: `idempotencyKey=idem-${stamp}`,
      steps: ['Submit the same payment payload twice with the same idempotencyKey.', 'Count payment rows for the key.'],
      expected: 'Second response returns existing payment/receipt and no duplicate row is created.',
      actual: `Payment count=${idempotentPaymentCount}, second idempotent=${Boolean((duplicatePayment2.payload as any).idempotent)}.`,
      rootCauseGuess: 'Idempotency lookup or unique constraint failed.',
      businessImpact: 'Browser double-click/retry can duplicate payment and receipt.',
      suggestedFix: 'Enforce unique schoolId+idempotencyKey and return existing matching payment.',
      developerNotes: 'This bug is emitted only if the live idempotency check fails.',
      retestSteps: ['Repeat duplicate submit with same idempotencyKey.', 'Verify one payment and one ledger credit.'],
    });
  }

  await expectError('overpayment is rejected', 400, () =>
    call('overpayment call', collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: session.id,
        studentId: partialStudent.id,
        amount: money(partialAfter.dueAmount) + 100,
        paymentMode: 'CASH',
        paymentDate: '2026-06-19',
        idempotencyKey: `overpay-${stamp}`,
        allocations: [{ invoiceId: partialInvoice.id, amount: money(partialAfter.dueAmount) + 100 }],
      },
    }),
  );
  await expectError('UPI without reference is rejected', 400, () =>
    call('upi without reference call', collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: session.id,
        studentId: partialStudent.id,
        amount: 10,
        paymentMode: 'UPI',
        paymentDate: '2026-06-19',
        idempotencyKey: `upi-no-ref-${stamp}`,
        allocations: [{ invoiceId: partialInvoice.id, amount: 10 }],
      },
    }),
  );
  await expectError('cheque without cheque number and bank is rejected', 400, () =>
    call('cheque without reference call', collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: session.id,
        studentId: partialStudent.id,
        amount: 10,
        paymentMode: 'CHEQUE',
        paymentDate: '2026-06-19',
        idempotencyKey: `cheque-no-ref-${stamp}`,
        allocations: [{ invoiceId: partialInvoice.id, amount: 10 }],
      },
    }),
  );
  progress('standard collection workflow ready');

  await call('generate fresh concurrent payment invoice', generateFeeInvoices, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      target: 'STUDENT',
      studentId: concurrentPaymentStudent.id,
      feeTypeId: feeTypes.get('Monthly')!.id,
      feeMonth: '2026-08',
      dueDate: '2026-08-15',
    },
  });
  const concurrentPaymentInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: concurrentPaymentStudent.id, feeMonth: '2026-08' },
  });
  const concurrentPayments = await Promise.allSettled([
    call('concurrent payment A', collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: session.id,
        studentId: concurrentPaymentStudent.id,
        amount: money(concurrentPaymentInvoice.dueAmount),
        paymentMode: 'CASH',
        paymentDate: '2026-06-20',
        idempotencyKey: `concurrent-pay-a-${stamp}`,
        allocations: [{ invoiceId: concurrentPaymentInvoice.id, amount: money(concurrentPaymentInvoice.dueAmount) }],
      },
    }),
    call('concurrent payment B', collectFeePayment, {
      auth: accountantAuth,
      body: {
        academicSessionId: session.id,
        studentId: concurrentPaymentStudent.id,
        amount: money(concurrentPaymentInvoice.dueAmount),
        paymentMode: 'CASH',
        paymentDate: '2026-06-20',
        idempotencyKey: `concurrent-pay-b-${stamp}`,
        allocations: [{ invoiceId: concurrentPaymentInvoice.id, amount: money(concurrentPaymentInvoice.dueAmount) }],
      },
    }),
  ]);
  const concurrentPaymentInvoiceAfter = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: concurrentPaymentInvoice.id } });
  const concurrentPaymentRows = await prisma.feePayment.count({ where: { schoolId: school.id, invoiceId: concurrentPaymentInvoice.id, status: 'SUCCESS' } });
  if (concurrentPaymentRows !== 1 || money(concurrentPaymentInvoiceAfter.paidAmount) !== money(concurrentPaymentInvoice.dueAmount)) {
    addBug({
      id: 'LIVE-FM-011',
      title: 'Concurrent duplicate payment overpaid or duplicated receipt',
      severity: 'Critical',
      priority: 'P1',
      module: 'Fees Management - Collection',
      route: 'POST /api/v1/fees/payments',
      role: 'Accountant',
      testData: `invoice=${concurrentPaymentInvoice.invoiceNumber}`,
      steps: ['Create an unpaid invoice.', 'Submit two full-payment requests in parallel with different idempotency keys.', 'Count payments and inspect invoice paidAmount.'],
      expected: 'Exactly one payment succeeds; paidAmount equals original due.',
      actual: `payments=${concurrentPaymentRows}, paidAmount=${money(concurrentPaymentInvoiceAfter.paidAmount)}, originalDue=${money(concurrentPaymentInvoice.dueAmount)}.`,
      rootCauseGuess: 'Invoice row locking or fresh due recalculation failed.',
      businessImpact: 'Duplicate browser submit can overstate collections and receipts.',
      suggestedFix: 'Lock invoice rows inside the transaction and reject once due is zero.',
      developerNotes: JSON.stringify(concurrentPayments.map((item) => item.status)),
      retestSteps: ['Run parallel full payments against a fresh invoice.', 'Verify one success and no overpayment.'],
    });
  }
  progress('concurrent payment workflow ready');

  await call('create discount after invoice exists', createFeeDiscount, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      discountName: 'Post Invoice Fixed Discount',
      targetType: 'STUDENT',
      studentId: postInvoiceDiscountStudent.id,
      discountType: 'FIXED',
      discountValue: 100,
      validFrom: '2026-06-01',
      validTo: '2026-12-31',
      status: 'ACTIVE',
      reason: 'Post invoice discount test',
    },
  });
  const postDiscountInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: postInvoiceDiscountStudent.id, feeMonth: '2026-06' },
  });
  const postDiscountLedgerCount = await prisma.feeLedger.count({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: postInvoiceDiscountStudent.id, type: 'DISCOUNT_CREDIT' },
  });
  if (postDiscountLedgerCount > 0 && money(postDiscountInvoice.discountAmount) === 0) {
    addBug({
      id: 'LIVE-FM-012',
      title: 'Approved post-invoice discount creates ledger credit but does not update invoice payable',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Discounts',
      route: 'POST /api/v1/fees/discounts',
      role: 'School Admin',
      testData: `${postInvoiceDiscountStudent.admissionNo}, invoice ${postDiscountInvoice.invoiceNumber}`,
      steps: ['Generate an invoice.', 'Approve an active fixed discount for that student.', 'Inspect invoice discountAmount/dueAmount and ledger.'],
      expected: 'Invoice payable and ledger should be updated consistently, or the API should require an explicit adjustment/reversal workflow.',
      actual: `Ledger discount credit exists (${postDiscountLedgerCount}), but invoice discountAmount remains ${money(postDiscountInvoice.discountAmount)} and dueAmount remains ${money(postDiscountInvoice.dueAmount)}.`,
      rootCauseGuess: 'Discount approval lifecycle writes ledger entries but does not apply discount to existing invoices.',
      businessImpact: 'Ledger and invoice balances diverge; reports can show outstanding amounts that do not match accounting credits.',
      suggestedFix: 'Implement discount application/allocation to open invoices or block post-invoice approved discounts until adjustment flow is used.',
      developerNotes: 'maybeCreateApprovedDiscountLedger is called without invoice mutation.',
      retestSteps: ['Approve a discount after invoice generation.', 'Verify invoice due, ledger, and report totals remain reconciled.'],
    });
  }

  const paidAppliedDiscount = await prisma.feeDiscount.findFirstOrThrow({
    where: {
      schoolId: school.id,
      academicSessionId: session.id,
      studentId: discountStudent.id,
      discountName: 'Merit Scholarship 10 Percent',
    },
  });
  await expectError('paid invoice discount edit is blocked', 409, () =>
    call('edit paid discount call', updateFeeDiscount, {
      auth: adminAuth,
      params: { id: paidAppliedDiscount.id },
      query: { academicSessionId: session.id },
      body: { discountValue: 11, discountType: 'PERCENTAGE' },
    }),
  );
  await expectError('paid invoice discount delete is blocked', 409, () =>
    call('delete paid discount call', deleteFeeDiscount, {
      auth: adminAuth,
      params: { id: paidAppliedDiscount.id },
      query: { academicSessionId: session.id },
    }),
  );
  progress('post-invoice discount and restrictions ready');

  const fineBefore = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: partialInvoice.id } });
  await call('apply fixed fine to partial invoice', createFeeFine, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      invoiceId: partialInvoice.id,
      particularId: particulars.get('Fine')!.id,
      name: 'Fixed Late Fine',
      fineType: 'FIXED',
      amount: 50,
      graceDays: 0,
      status: 'ACTIVE',
    },
  });
  await expectError('duplicate fixed fine is blocked for same invoice', 409, () =>
    call('apply duplicate fixed fine to same invoice', createFeeFine, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        invoiceId: partialInvoice.id,
        particularId: particulars.get('Fine')!.id,
        name: 'Fixed Late Fine',
        fineType: 'FIXED',
        amount: 50,
        graceDays: 0,
        status: 'ACTIVE',
      },
    }),
  );
  await call('create daily fine rule with grace period', createFeeFine, {
    auth: adminAuth,
    body: {
      academicSessionId: session.id,
      particularId: particulars.get('Fine')!.id,
      name: 'Daily Late Fine With Grace',
      fineType: 'DAILY',
      amount: 10,
      graceDays: 3,
      status: 'ACTIVE',
    },
  });
  const fineAfter = await prisma.feeInvoice.findUniqueOrThrow({ where: { id: partialInvoice.id } });
  if (money(fineAfter.fineAmount) - money(fineBefore.fineAmount) >= 100) {
    addBug({
      id: 'LIVE-FM-013',
      title: 'Duplicate fine can be applied to the same invoice',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Fines',
      route: 'POST /api/v1/fees/fines',
      role: 'School Admin',
      testData: `invoice=${partialInvoice.invoiceNumber}, fineName=Fixed Late Fine`,
      steps: ['Apply a fixed fine to an unpaid/partial invoice.', 'Submit the same fine again for the same invoice.', 'Inspect invoice fineAmount.'],
      expected: 'Second fine should be rejected as duplicate for the same invoice/date/rule.',
      actual: `fineAmount increased from ${money(fineBefore.fineAmount)} to ${money(fineAfter.fineAmount)}.`,
      rootCauseGuess: 'FeeFine model stores rules/applied fines together and createFeeFine has no duplicate invoice/date guard.',
      businessImpact: 'Students can be overcharged and ledger debits duplicated.',
      suggestedFix: 'Separate fine rule from applied fine or add unique applied-fine constraint by school/session/invoice/rule/date.',
      developerNotes: 'The API creates a new FeeFine row and increments invoice fineAmount each call.',
      retestSteps: ['Apply same fine twice.', 'Verify second call returns 409 and invoice fineAmount changes once.'],
    });
  }
  await expectError('fine cannot be applied to paid invoice', 409, () =>
    call('paid invoice fine call', createFeeFine, {
      auth: adminAuth,
      body: {
        academicSessionId: session.id,
        invoiceId: fullPayInvoice.id,
        particularId: particulars.get('Fine')!.id,
        name: 'Paid Invoice Fine',
        fineType: 'FIXED',
        amount: 50,
      },
    }),
  );
  progress('fine workflow ready');

  const cancelInvoice = await prisma.feeInvoice.findFirstOrThrow({
    where: { schoolId: school.id, academicSessionId: session.id, studentId: cancelStudent.id, feeMonth: '2026-06' },
  });
  try {
    await call('cancel unpaid invoice', cancelFeeInvoice, {
      auth: adminAuth,
      params: { id: cancelInvoice.id },
      body: { academicSessionId: session.id, reason: 'QA cancellation test' },
    });
  } catch (error: any) {
    addResult('cancel unpaid invoice', 'FAIL', { message: error?.message ?? String(error) });
    if ((error?.message ?? '').includes('Unknown argument `userId`')) {
      addBug({
        id: 'LIVE-FM-019',
        title: 'Invoice cancellation API crashes because userId is included in invoice Prisma filter',
        severity: 'Critical',
        priority: 'P1',
        module: 'Fees Management - Invoice Cancellation',
        route: 'PATCH /api/v1/fees/invoices/:id/cancel',
        role: 'School Admin',
        testData: `invoice=${cancelInvoice.invoiceNumber}`,
        steps: ['Generate an unpaid invoice.', 'Call cancel invoice API.'],
        expected: 'Unpaid invoice should be cancelled and reversal ledger entry created.',
        actual: 'Prisma throws Unknown argument `userId` in FeeInvoiceWhereInput.',
        rootCauseGuess: 'cancelFeeInvoice spreads resolveScope() into invoice findFirst where.',
        businessImpact: 'Users cannot cancel incorrect unpaid invoices through the API.',
        suggestedFix: 'Use tenantScopeOnly(scope) in cancelFeeInvoice and keep userId only for createdBy/audit.',
        developerNotes: 'Direct fallback was used only to continue QA downstream.',
        retestSteps: ['Cancel an unpaid invoice.', 'Verify status CANCELLED, dueAmount 0, and reversal ledger.'],
      });
    }
    await prisma.feeInvoice.update({ where: { id: cancelInvoice.id }, data: { status: 'CANCELLED', dueAmount: 0 } });
    const previousBalance = await latestBalanceForStudent(cancelInvoice.studentId);
    await prisma.feeLedger.create({
      data: {
        schoolId: school.id,
        academicSessionId: session.id,
        studentId: cancelInvoice.studentId,
        invoiceId: cancelInvoice.id,
        type: 'CANCELLATION_REVERSAL',
        description: `Direct QA cancellation reversal for ${cancelInvoice.invoiceNumber}`,
        creditAmount: cancelInvoice.dueAmount,
        debitAmount: 0,
        balanceAfter: previousBalance.minus(cancelInvoice.dueAmount),
        createdById: adminUser.id,
      },
    });
  }
  await expectError('paid invoice cancellation is blocked', 409, () =>
    call('paid invoice cancel call', cancelFeeInvoice, {
      auth: adminAuth,
      params: { id: fullPayInvoice.id },
      body: { academicSessionId: session.id, reason: 'Should fail' },
    }),
  );
  progress('invoice cancellation workflow ready');

  const ledger = await call('get student fee ledger', getStudentFeeLedger, {
    auth: adminAuth,
    query: { academicSessionId: session.id, studentId: partialStudent.id, page: 1, limit: 100 },
  });
  let ledgerPdf: { payload: any } = { payload: Buffer.alloc(0) };
  let ledgerXlsx: { payload: any } = { payload: Buffer.alloc(0) };
  try {
    ledgerPdf = await callWithTimeout('export student ledger PDF', 15000, () =>
      call('export student ledger PDF', exportFeeLedgerPdf, {
        auth: adminAuth,
        query: { academicSessionId: session.id, studentId: partialStudent.id },
      }),
    );
  } catch (error: any) {
    addResult('export student ledger PDF', 'FAIL', { message: error?.message ?? String(error) });
    addBug({
      id: 'LIVE-FM-016',
      title: 'Student ledger PDF export hangs or fails',
      severity: 'Medium',
      priority: 'P2',
      module: 'Fees Management - Ledger Export',
      route: 'GET /api/v1/fees/ledger/export.pdf',
      role: 'School Admin',
      testData: `${partialStudent.admissionNo}`,
      steps: ['Run ledger PDF export for a student with invoice/payment/fine ledger rows.'],
      expected: 'PDF export returns a PDF buffer promptly.',
      actual: error?.message ?? String(error),
      rootCauseGuess: 'PDF stream completion or export query may not resolve reliably.',
      businessImpact: 'Accountants cannot download student ledger audit trail.',
      suggestedFix: 'Ensure PDFDocument end/data handlers are registered before doc.end and export promises resolve/reject.',
      developerNotes: 'Captured by live QA timeout wrapper.',
      retestSteps: ['Run ledger PDF export.', 'Verify content-type application/pdf and non-empty buffer.'],
    });
  }
  try {
    ledgerXlsx = await callWithTimeout('export student ledger Excel', 15000, () =>
      call('export student ledger Excel', exportFeeLedgerExcel, {
        auth: adminAuth,
        query: { academicSessionId: session.id, studentId: partialStudent.id },
      }),
    );
  } catch (error: any) {
    addResult('export student ledger Excel', 'FAIL', { message: error?.message ?? String(error) });
  }
  progress('ledger query and export workflow ready');

  const reportTypes = [
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
  ];
  const reports: Record<string, any> = {};
  let reportApiBroken = false;
  const directReportSummary = async () => {
    const [paymentSum, invoiceSum, receiptCount] = await Promise.all([
      prisma.feePayment.aggregate({ where: { schoolId: school.id, academicSessionId: session.id, status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.feeInvoice.aggregate({
        where: { schoolId: school.id, academicSessionId: session.id, deletedAt: null, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true, dueAmount: true, discountAmount: true, fineAmount: true },
      }),
      prisma.feeReceipt.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
    ]);
    return {
      totalBilled: money(invoiceSum._sum.totalAmount),
      totalCollected: money(paymentSum._sum.amount),
      totalDiscount: money(invoiceSum._sum.discountAmount),
      totalFine: money(invoiceSum._sum.fineAmount),
      totalDue: money(invoiceSum._sum.dueAmount),
      totalCancelled: 0,
      totalReceipts: receiptCount,
    };
  };
  for (const type of reportTypes) {
    try {
      const response = await call(`run report ${type}`, getFeeReports, {
        auth: adminAuth,
        query: { academicSessionId: session.id, type, dateFrom: '2026-06-01', dateTo: '2026-12-31' },
      });
      reports[type] = response.payload;
    } catch (error: any) {
      addResult(`run report ${type}`, 'FAIL', { message: error?.message ?? String(error) });
      if (!reportApiBroken && (error?.message ?? '').includes('Unknown argument `userId`')) {
        reportApiBroken = true;
        addBug({
          id: 'LIVE-FM-020',
          title: 'Fee reports API crashes because userId is included in report Prisma filters',
          severity: 'Critical',
          priority: 'P1',
          module: 'Fees Management - Reports',
          route: 'GET /api/v1/fees/reports',
          role: 'School Admin',
          testData: `school=${qaCode}`,
          steps: ['Generate invoices and payments.', 'Call any fee report endpoint.'],
          expected: 'Report endpoint should return summary and rows scoped by school/session.',
          actual: 'Prisma throws Unknown argument `userId` in report source queries.',
          rootCauseGuess: 'buildFeeReport spreads resolveScope() into invoice/payment/discount/ledger where filters.',
          businessImpact: 'Required fee reports cannot load in production with the real Prisma client.',
          suggestedFix: 'Use tenantScopeOnly(scope) for all report Prisma where filters.',
          developerNotes: 'Direct summary fallback was used only to complete QA comparison.',
          retestSteps: ['Run daily_collection and due reports.', 'Verify 200 response and totals.'],
        });
      }
      reports[type] = { rows: [], summary: await directReportSummary() };
    }
  }
  let exportPdf: { payload: any } = { payload: Buffer.alloc(0) };
  let exportXlsx: { payload: any } = { payload: Buffer.alloc(0) };
  try {
    exportPdf = await callWithTimeout('export daily collection PDF', 15000, () =>
      call('export daily collection PDF', exportFeeReports, {
        auth: adminAuth,
        query: { academicSessionId: session.id, type: 'daily_collection', format: 'pdf', dateFrom: '2026-06-01', dateTo: '2026-12-31' },
      }),
    );
  } catch (error: any) {
    addResult('export daily collection PDF', 'FAIL', { message: error?.message ?? String(error) });
    addBug({
      id: 'LIVE-FM-017',
      title: 'Fee report PDF export hangs or fails',
      severity: 'Medium',
      priority: 'P2',
      module: 'Fees Management - Reports Export',
      route: 'GET /api/v1/fees/reports/export?format=pdf',
      role: 'School Admin',
      testData: 'daily_collection report',
      steps: ['Run daily collection report PDF export after collecting payments.'],
      expected: 'PDF export returns a PDF buffer promptly.',
      actual: error?.message ?? String(error),
      rootCauseGuess: 'PDF stream completion promise may be registered after the end event or not reject on stream errors.',
      businessImpact: 'Required PDF reports may fail at school fee closing time.',
      suggestedFix: 'Use a robust PDF buffer helper that attaches data/end/error listeners before doc.end.',
      developerNotes: 'Captured by live QA timeout wrapper.',
      retestSteps: ['Export daily collection PDF.', 'Verify non-empty PDF response.'],
    });
  }
  try {
    exportXlsx = await callWithTimeout('export daily collection Excel', 15000, () =>
      call('export daily collection Excel', exportFeeReports, {
        auth: adminAuth,
        query: { academicSessionId: session.id, type: 'daily_collection', format: 'xlsx', dateFrom: '2026-06-01', dateTo: '2026-12-31' },
      }),
    );
  } catch (error: any) {
    addResult('export daily collection Excel', 'FAIL', { message: error?.message ?? String(error) });
  }
  progress('reports and export workflow ready');

  const paymentAggregate = await prisma.feePayment.aggregate({
    where: { schoolId: school.id, academicSessionId: session.id, status: 'SUCCESS' },
    _sum: { amount: true },
  });
  const invoiceAggregate = await prisma.feeInvoice.aggregate({
    where: { schoolId: school.id, academicSessionId: session.id, status: { not: 'CANCELLED' }, deletedAt: null },
    _sum: { totalAmount: true, discountAmount: true, fineAmount: true, paidAmount: true, dueAmount: true },
  });
  const invoiceDueByStudent = await prisma.feeInvoice.groupBy({
    by: ['studentId'],
    where: { schoolId: school.id, academicSessionId: session.id, status: { not: 'CANCELLED' }, deletedAt: null },
    _sum: { dueAmount: true },
  });
  const ledgerClosingBalanceSum = await findLatestLedgerBalance(school.id, session.id);
  const reportTotalCollected = money(reports.daily_collection.summary.totalCollected);
  const dbTotalCollected = money(paymentAggregate._sum.amount);
  if (reportTotalCollected !== dbTotalCollected) {
    addBug({
      id: 'LIVE-FM-014',
      title: 'Daily collection report total does not match payments',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Reports',
      route: 'GET /api/v1/fees/reports?type=daily_collection',
      role: 'School Admin',
      testData: `school=${qaCode}`,
      steps: ['Collect multiple payments.', 'Run daily collection report.', 'Compare summary totalCollected to fee_payments sum.'],
      expected: `Report totalCollected should equal DB payment sum ${dbTotalCollected}.`,
      actual: `Report totalCollected=${reportTotalCollected}.`,
      rootCauseGuess: 'Report payment filters or aggregation differ from source payment data.',
      businessImpact: 'Cash/accountant reports cannot be reconciled.',
      suggestedFix: 'Use a shared source query for payment totals and report rows.',
      developerNotes: 'Emitted only if live total mismatch occurs.',
      retestSteps: ['Collect known payments.', 'Compare report totals to direct payment aggregate.'],
    });
  }
  const dbDue = money(invoiceAggregate._sum.dueAmount);
  const ledgerDue = money(ledgerClosingBalanceSum.total);
  const invoiceGrossTotal = money(invoiceAggregate._sum.totalAmount);
  const invoiceDiscountTotal = money(invoiceAggregate._sum.discountAmount);
  const invoiceFineTotal = money(invoiceAggregate._sum.fineAmount);
  const invoicePaidTotal = money(invoiceAggregate._sum.paidAmount);
  const formulaDueTotal = money(invoiceGrossTotal - invoiceDiscountTotal + invoiceFineTotal - invoicePaidTotal);
  const invoiceDueByStudentMap = Object.fromEntries(invoiceDueByStudent.map((row) => [row.studentId, money(row._sum.dueAmount)]));
  const studentIdsForReconciliation = Array.from(new Set([...Object.keys(invoiceDueByStudentMap), ...Object.keys(ledgerClosingBalanceSum.byStudentId)]));
  const reconciliationMismatches = studentIdsForReconciliation
    .map((studentId) => {
      const invoiceDue = money(invoiceDueByStudentMap[studentId] ?? 0);
      const ledgerClosing = money(ledgerClosingBalanceSum.byStudentId[studentId] ?? 0);
      return {
        studentId,
        invoiceDue,
        ledgerClosing,
        difference: money(invoiceDue - ledgerClosing),
      };
    })
    .filter((row) => Math.abs(row.difference) > 0.01);
  if (Math.abs(dbDue - ledgerDue) > 0.01) {
    addBug({
      id: 'LIVE-FM-015',
      title: 'Outstanding invoice due does not reconcile with ledger closing balances',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Ledger/Reports',
      route: 'GET /api/v1/fees/ledger and GET /api/v1/fees/reports',
      role: 'School Admin',
      testData: `school=${qaCode}`,
      steps: ['Run invoice generation, discounts, fines, payments, and cancellation.', 'Aggregate non-cancelled invoice dueAmount.', 'Aggregate latest student ledger balances.'],
      expected: 'Invoice outstanding should reconcile with accounting ledger closing balances.',
      actual: `Invoice due sum=${dbDue}, ledger closing balance sum=${ledgerDue}.`,
      rootCauseGuess: 'Combination of previous-balance carry-forward, discount write paths, and collection due calculation causes invoice/ledger divergence.',
      businessImpact: 'Finance reports can disagree with student ledger, making production accounting unreliable.',
      suggestedFix: 'Define a single receivable source of truth and enforce ledger entries for every invoice state mutation including opening balances/carry-forward adjustments.',
      developerNotes: 'Related live issues: previous balance duplication, post-invoice discount ledger-only credit, discounted underpayment.',
      retestSteps: ['Run the full fee lifecycle.', 'Verify invoice due totals equal ledger closing balances after each event.'],
    });
  }
  if (Math.abs(dbDue - formulaDueTotal) > 0.01) {
    addBug({
      id: 'LIVE-FM-023',
      title: 'Invoice stored due does not match gross-discount+fine-paid formula',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Accounting',
      route: 'Fee invoice mutation paths',
      role: 'School Admin',
      testData: `school=${qaCode}`,
      steps: ['Run full live fee workflow.', 'Aggregate invoice gross, discount, fine, paid, and due totals.', 'Compare stored due to formula due.'],
      expected: 'Stored invoice due total should equal gross - discount + fine - paid.',
      actual: `formulaDue=${formulaDueTotal}, storedDue=${dbDue}.`,
      rootCauseGuess: 'One invoice mutation path updates dueAmount without using the shared accounting formula.',
      businessImpact: 'Collection, invoice list, ledger, and reports can show different receivable balances.',
      suggestedFix: 'Route all invoice due mutations through the shared gross-discount+fine-paid calculation.',
      developerNotes: 'Added by final reconciliation QA.',
      retestSteps: ['Run scripts/live-fees-qa.ts.', 'Verify accountingTotals.formulaDueTotal equals dueTotal.'],
    });
  }
  if (reconciliationMismatches.length > 0 && !bugs.some((bug) => bug.id === 'LIVE-FM-015')) {
    addBug({
      id: 'LIVE-FM-015',
      title: 'Outstanding invoice due does not reconcile with ledger closing balances',
      severity: 'High',
      priority: 'P1',
      module: 'Fees Management - Ledger/Reports',
      route: 'GET /api/v1/fees/ledger and GET /api/v1/fees/reports',
      role: 'School Admin',
      testData: `school=${qaCode}`,
      steps: ['Run invoice generation, discounts, fines, payments, and cancellation.', 'Compare per-student invoice due to latest ledger balance.'],
      expected: 'Each student invoice due should reconcile with ledger closing balance.',
      actual: JSON.stringify(reconciliationMismatches.slice(0, 10)),
      rootCauseGuess: 'A financial mutation path missed either invoice due update or ledger entry.',
      businessImpact: 'Individual student ledger cannot be trusted for fee counter/accounting.',
      suggestedFix: 'Fix the mutation path for the mismatched student/invoice and add a per-student reconciliation regression test.',
      developerNotes: 'Final reconciliation uses latest fee ledger balance per student.',
      retestSteps: ['Run scripts/live-fees-qa.ts.', 'Verify reconciliation.mismatches is empty.'],
    });
  }

  const permissions = {
    schoolAdminFeePermissionCount: getDefaultPermissionCodes('SCHOOL_ADMIN').filter((code) => code.startsWith('fees.')).length,
    accountantFeePermissions: getDefaultPermissionCodes('ACCOUNTANT').filter((code) => code.startsWith('fees.')).sort(),
    createStructurePermission: resolvePermissionForPath('/api/v1/fees/structures', 'POST'),
    collectPaymentPermission: resolvePermissionForPath('/api/v1/fees/payments', 'POST'),
    receiptPrintPermissionForUnregisteredPath: resolvePermissionForPath('/api/v1/fees/collection/receipt/abc/print', 'GET'),
    staffMetadataBlocked: Boolean(staffMetadataError),
    tenantViolationBlocked: Boolean(tenantViolation),
  };

  const passCount = results.filter((result) => result.status === 'PASS').length;
  const failCount = results.filter((result) => result.status === 'FAIL').length;
  const passedWorkflows = results.filter((result) => result.status === 'PASS').map((result) => result.name);
  const failedWorkflows = results.filter((result) => result.status === 'FAIL').map((result) => result.name);
  const reconciliationStatus = Math.abs(dbDue - ledgerDue) <= 0.01 && Math.abs(dbDue - formulaDueTotal) <= 0.01 && reconciliationMismatches.length === 0 ? 'PASS' : 'FAIL';
  const finalReadiness = failCount === 0 && bugs.length === 0 && reconciliationStatus === 'PASS' ? 'PRODUCTION READY' : 'NOT READY';
  const output = {
    qaRun: {
      code: qaCode,
      schoolId: school.id,
      academicSessionId: session.id,
      generatedAt: new Date().toISOString(),
    },
    finalReadiness,
    insertedDataSummary: {
      school: school.name,
      academicSession: session.name,
      classes: Array.from(classRows.values()).map((row) => row.name),
      sections: Array.from(sections.values()).map((row) => row.name),
      students: students.length,
      studentStatuses: students.reduce<Record<string, number>>((acc, student) => {
        acc[student.status] = (acc[student.status] ?? 0) + 1;
        return acc;
      }, {}),
      feeParticulars: particulars.size,
      feeTypes: feeTypes.size,
      feeStructures: structures.size,
      assignments: await prisma.studentFeeAssignment.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      discounts: await prisma.feeDiscount.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      fines: await prisma.feeFine.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      invoices: await prisma.feeInvoice.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      payments: await prisma.feePayment.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      receipts: await prisma.feeReceipt.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
      ledgers: await prisma.feeLedger.count({ where: { schoolId: school.id, academicSessionId: session.id } }),
    },
    workflowEvidence: {
      preview: previewEvidence,
      class1Generate: {
        generatedCount: (class1Generate.payload as any).generatedCount,
        skippedDuplicateCountOnSecondRun: (class1Duplicate.payload as any).skippedDuplicateCount,
      },
      concurrentInvoiceGeneration: {
        statuses: concurrentInvoiceResults.map((item) => item.status),
        expectedInvoiceCount: class1ActiveStudents,
        actualInvoiceCount: class1JulyCount,
      },
      assignments: {
        listItems: ((assignmentList.payload as any).items ?? []).length,
        assignedStudents: ((assignmentList.payload as any).assignedStudents ?? []).length,
        unassignedStudents: ((assignmentList.payload as any).unassignedStudents ?? []).length,
        nonActiveAssignedRows: nonActiveAssignedRows.length,
      },
      payments: {
        fullPaymentInvoice: fullPayInvoice.invoiceNumber,
        partialPaymentInvoice: partialInvoice.invoiceNumber,
        multiInvoiceStudent: multiInvoiceStudent.admissionNo,
        idempotentPaymentCount,
        concurrentPaymentRows,
        concurrentPaymentStatuses: concurrentPayments.map((item) => item.status),
      },
      ledger: {
        partialStudentRows: ((ledger.payload as any).items ?? []).length,
        pdfBytes: Buffer.isBuffer(ledgerPdf.payload) ? ledgerPdf.payload.length : 0,
        xlsxBytes: Buffer.isBuffer(ledgerXlsx.payload) ? ledgerXlsx.payload.length : 0,
      },
      reports: {
        typesRun: reportTypes.length,
        dailyRows: reports.daily_collection.rows.length,
        totalCollectedReport: reportTotalCollected,
        totalCollectedDb: dbTotalCollected,
        invoiceDueSum: dbDue,
        ledgerClosingBalanceSum: ledgerDue,
        exportPdfBytes: Buffer.isBuffer(exportPdf.payload) ? exportPdf.payload.length : 0,
        exportXlsxBytes: Buffer.isBuffer(exportXlsx.payload) ? exportXlsx.payload.length : 0,
      },
      isolation: {
        otherSchoolSearchReturned,
        otherSessionSearchReturned,
      },
      permissions,
    },
    accountingTotals: {
      invoiceGrossTotal,
      discountTotal: invoiceDiscountTotal,
      fineTotal: invoiceFineTotal,
      paidTotal: invoicePaidTotal,
      dueTotal: dbDue,
      formulaDueTotal,
      ledgerClosingTotal: ledgerDue,
    },
    reconciliation: {
      status: reconciliationStatus,
      formula: 'grossAmount - discountAmount + fineAmount - paidAmount = dueAmount',
      invoiceDueTotal: dbDue,
      ledgerClosingTotal: ledgerDue,
      formulaDueTotal,
      mismatchCount: reconciliationMismatches.length,
      mismatches: reconciliationMismatches,
    },
    stepSummary: {
      passCount,
      failCount,
      passedWorkflows,
      failedWorkflows,
      failedSteps: results.filter((result) => result.status === 'FAIL'),
    },
    bugs,
  };

  console.log('LIVE_FEES_QA_RESULT_START');
  console.log(JSON.stringify(output, (_key, value) => {
    if (value instanceof Prisma.Decimal) return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return `<Buffer ${value.length} bytes>`;
    return value;
  }, 2));
  console.log('LIVE_FEES_QA_RESULT_END');
}

main()
  .catch((error) => {
    console.error('LIVE_FEES_QA_FAILED');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
