import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../config/db';
import {
  enforceLimits,
  generateSchoolSubscriptionInvoice,
  markOverdueSubscriptionInvoices,
  recordSchoolSubscriptionManualPayment,
} from '../services/subscription.service';
import { createSchool } from '../services/schoolAdmin.service';
import {
  SCHOOL_A_ID,
  SUPER_ADMIN_ID,
  closeBackgroundHandles,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
} from './test-utils';

const PLAN_ID = '99999999-9999-4999-8999-999999999991';
const SUBSCRIPTION_ID = '99999999-9999-4999-8999-999999999992';
const INVOICE_ID = '99999999-9999-4999-8999-999999999993';

let restoreFns: Array<() => void> = [];

const patch = (target: any, key: string, value: any) => {
  const original = target[key];
  target[key] = value;
  restoreFns.push(() => {
    target[key] = original;
  });
};

const restoreLocalPatches = () => {
  for (const restore of restoreFns.reverse()) restore();
  restoreFns = [];
};

const actor = { userId: SUPER_ADMIN_ID, role: 'SUPER_ADMIN' };

const plan = {
  id: PLAN_ID,
  name: 'STANDARD',
  status: 'ACTIVE',
  priceCents: 100000,
  features: [],
  studentLimit: 2000,
  teacherLimit: 200,
  trialDays: 14,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const subscription = {
  id: SUBSCRIPTION_ID,
  schoolId: SCHOOL_A_ID,
  planId: PLAN_ID,
  planName: 'STANDARD',
  status: 'ACTIVE',
  startsAt: new Date('2026-06-01T00:00:00.000Z'),
  endsAt: new Date('2026-07-01T00:00:00.000Z'),
  billingCycle: 'MONTHLY',
  discountPercent: 0,
  graceDays: 15,
  paidAt: null,
  nextDueAt: new Date('2026-07-01T00:00:00.000Z'),
  studentLimit: 2000,
  teacherLimit: 200,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  plan,
  school: { id: SCHOOL_A_ID, name: 'School A', code: 'SCHA', status: 'ACTIVE', statusReason: null, deletedAt: null },
};

test.beforeEach(() => {
  seedSecurityUsers();
  patchSecurityTestDependencies();
});

test.afterEach(() => {
  restoreLocalPatches();
  restoreSecurityTestDependencies();
});

test.after(async () => {
  await closeBackgroundHandles();
});

test('generates subscription invoice from backend plan price with tax and discount', async () => {
  let subscriptionUpdate: any = null;
  patch(prisma.school as any, 'findFirst', async () => ({ id: SCHOOL_A_ID, name: 'School A', code: 'SCHA', status: 'ACTIVE' }));
  patch(prisma.subscription as any, 'findUnique', async () => subscription);
  patch(prisma.subscription as any, 'update', async ({ data }: any) => {
    subscriptionUpdate = data;
    return { ...subscription, ...data };
  });
  patch(prisma.subscriptionInvoice as any, 'findFirst', async () => null);
  patch(prisma.numberSequence as any, 'upsert', async () => ({ prefix: 'SUB-INV', year: 2026, lastNumber: 1 }));
  patch(prisma.subscriptionInvoice as any, 'create', async ({ data }: any) => ({
    id: INVOICE_ID,
    ...data,
    plan,
    payments: [],
    createdAt: new Date('2026-06-06T00:00:00.000Z'),
    updatedAt: new Date('2026-06-06T00:00:00.000Z'),
  }));

  const invoice = await generateSchoolSubscriptionInvoice({
    schoolId: SCHOOL_A_ID,
    taxPercent: 18,
    discountPercent: 10,
    actor,
  });

  assert.equal(invoice.invoiceNumber, 'SUB-INV-2026-000001');
  assert.equal(invoice.subtotal, 1000);
  assert.equal(invoice.taxAmount, 180);
  assert.equal(invoice.discountAmount, 100);
  assert.equal(invoice.totalAmount, 1080);
  assert.equal(invoice.balanceAmount, 1080);
  assert.equal(invoice.status, 'UNPAID');
  assert.equal(subscriptionUpdate.status, 'ACTIVE');
  assert.equal(subscriptionUpdate.nextDueAt.getTime(), new Date('2026-07-16T00:00:00.000Z').getTime());
});

test('manual payment records a partial subscription payment and updates invoice balance', async () => {
  let invoiceUpdate: any = null;
  let paymentCreate: any = null;
  patch(prisma.subscriptionInvoice as any, 'findFirst', async () => ({
    id: INVOICE_ID,
    schoolId: SCHOOL_A_ID,
    subscriptionId: SUBSCRIPTION_ID,
    invoiceNumber: 'SUB-INV-2026-000001',
    billingPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    paidAmount: 0,
    balanceAmount: 1000,
    status: 'UNPAID',
    subscription,
    plan,
  }));
  patch(prisma.subscriptionPayment as any, 'create', async ({ data }: any) => {
    paymentCreate = data;
    return { id: 'payment-1', ...data, createdAt: new Date('2026-06-06T00:00:00.000Z') };
  });
  patch(prisma.subscriptionInvoice as any, 'update', async ({ data }: any) => {
    invoiceUpdate = data;
    return data;
  });

  const result = await recordSchoolSubscriptionManualPayment({
    schoolId: SCHOOL_A_ID,
    invoiceId: INVOICE_ID,
    amount: 400,
    paymentMode: 'UPI',
    referenceNumber: 'UPI-1',
    paymentDate: new Date('2026-06-06T00:00:00.000Z'),
    actor,
  });

  assert.equal(paymentCreate.invoiceId, INVOICE_ID);
  assert.equal(Number(paymentCreate.amount), 400);
  assert.equal(invoiceUpdate.status, 'PARTIAL');
  assert.equal(Number(invoiceUpdate.balanceAmount), 600);
  assert.match(result.message, /partial/i);
});

test('manual full payment marks invoice paid and restores payment-suspended school', async () => {
  let invoiceUpdate: any = null;
  let subscriptionUpdate: any = null;
  let schoolUpdate: any = null;
  patch(prisma.subscriptionInvoice as any, 'findFirst', async () => ({
    id: INVOICE_ID,
    schoolId: SCHOOL_A_ID,
    subscriptionId: SUBSCRIPTION_ID,
    invoiceNumber: 'SUB-INV-2026-000001',
    billingPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    paidAmount: 400,
    balanceAmount: 600,
    status: 'PARTIAL',
    subscription: {
      ...subscription,
      status: 'OVERDUE',
      school: { ...subscription.school, status: 'SUSPENDED', statusReason: 'Payment overdue - subscription invoice overdue' },
    },
    plan,
  }));
  patch(prisma.subscriptionPayment as any, 'create', async ({ data }: any) => ({ id: 'payment-2', ...data, createdAt: new Date('2026-06-06T00:00:00.000Z') }));
  patch(prisma.subscriptionInvoice as any, 'update', async ({ data }: any) => {
    invoiceUpdate = data;
    return data;
  });
  patch(prisma.subscriptionInvoice as any, 'count', async () => 0);
  patch(prisma.subscription as any, 'update', async ({ data }: any) => {
    subscriptionUpdate = data;
    return { ...subscription, ...data };
  });
  patch(prisma.school as any, 'update', async ({ data }: any) => {
    schoolUpdate = data;
    return data;
  });

  const result = await recordSchoolSubscriptionManualPayment({
    schoolId: SCHOOL_A_ID,
    invoiceId: INVOICE_ID,
    amount: 600,
    paymentMode: 'BANK_TRANSFER',
    paymentDate: new Date('2026-06-06T00:00:00.000Z'),
    actor,
  });

  assert.equal(invoiceUpdate.status, 'PAID');
  assert.equal(Number(invoiceUpdate.balanceAmount), 0);
  assert.equal(subscriptionUpdate.status, 'ACTIVE');
  assert.equal(schoolUpdate.status, 'ACTIVE');
  assert.equal(schoolUpdate.statusReason, null);
  assert.match(result.message, /fully paid/i);
});

test('overdue subscription invoice suspends the school and marks subscription overdue', async () => {
  const updates: Array<{ target: string; data: any }> = [];
  patch(prisma.subscriptionInvoice as any, 'findMany', async () => [
    {
      id: INVOICE_ID,
      schoolId: SCHOOL_A_ID,
      subscriptionId: SUBSCRIPTION_ID,
      dueDate: new Date('2026-06-01T00:00:00.000Z'),
      subscription,
    },
  ]);
  patch(prisma.subscriptionInvoice as any, 'update', async ({ data }: any) => {
    updates.push({ target: 'invoice', data });
    return data;
  });
  patch(prisma.subscription as any, 'update', async ({ data }: any) => {
    updates.push({ target: 'subscription', data });
    return data;
  });
  patch(prisma.school as any, 'update', async ({ data }: any) => {
    updates.push({ target: 'school', data });
    return data;
  });

  const result = await markOverdueSubscriptionInvoices(new Date('2026-06-06T00:00:00.000Z'));

  assert.equal(result.count, 1);
  assert.deepEqual(updates.find((item) => item.target === 'invoice')?.data, { status: 'OVERDUE' });
  assert.equal(updates.find((item) => item.target === 'subscription')?.data.status, 'OVERDUE');
  assert.equal(updates.find((item) => item.target === 'school')?.data.status, 'SUSPENDED');
});

test('new school creation starts a proper trial subscription', async () => {
  let createdSubscription: any = null;
  patch(prisma.school as any, 'create', async ({ data }: any) => ({ id: SCHOOL_A_ID, ...data, createdAt: new Date(), updatedAt: new Date() }));
  patch(prisma.subscriptionPlanDef as any, 'findUnique', async () => ({ ...plan, trialDays: 10 }));
  patch(prisma.subscription as any, 'create', async ({ data }: any) => {
    createdSubscription = data;
    return { id: SUBSCRIPTION_ID, ...data };
  });
  patch(prisma.usageCounter as any, 'create', async ({ data }: any) => data);

  await createSchool({ name: 'School A', code: 'SCHA', subscriptionPlan: 'STANDARD' });

  assert.equal(createdSubscription.status, 'TRIAL');
  assert.equal(createdSubscription.endsAt.getTime(), createdSubscription.startsAt.getTime() + 10 * 24 * 60 * 60 * 1000);
  assert.equal(createdSubscription.nextDueAt.getTime(), createdSubscription.endsAt.getTime() + 15 * 24 * 60 * 60 * 1000);
});

test('bulk student import limit enforcement checks current count plus incoming row count', async () => {
  patch(prisma.subscription as any, 'findUnique', async ({ include }: any = {}) => ({
    ...subscription,
    studentLimit: 5,
    ...(include?.school ? { school: subscription.school } : {}),
  }));
  patch(prisma.subscriptionInvoice as any, 'findFirst', async () => null);
  patch(prisma.student as any, 'count', async () => 4);

  await assert.rejects(
    () => enforceLimits(SCHOOL_A_ID, 'students', 2),
    /students limit exceeded/,
  );
});
