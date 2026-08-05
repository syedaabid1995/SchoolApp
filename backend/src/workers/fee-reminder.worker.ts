import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { runWithDistributedLock, type DistributedLockClient } from '../services/distributedLock.service';
import { sendNotification } from '../services/notification.service';

const feeReminderJobName = 'fees.monthly-parent-reminders';
const feeReminderLockKey = 'academify:scheduler:fees:monthly-parent-reminders';
const feeReminderLockTtlMs = 55 * 60 * 1000;
const feeReminderIntervalMs = 60 * 60 * 1000;
const feeReminderBatchSize = 200;
const reminderStartDay = 1;
const reminderEndDay = 7;

let feeReminderInterval: NodeJS.Timeout | undefined;
let activeFeeReminderRun: Promise<unknown> | undefined;

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfMonth = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

const formatMoney = (value: unknown) => {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
};

const formatDate = (value: Date | null | undefined) => {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
};

const studentName = (student: { fullName?: string | null; firstName: string; lastName: string }) =>
  student.fullName?.trim() || `${student.firstName} ${student.lastName}`.trim() || 'Student';

const parentName = (parent: { firstName: string; lastName: string }) =>
  `${parent.firstName} ${parent.lastName}`.trim() || 'Parent';

const reminderSubject = (student: string) => `Fee payment reminder for ${student}`;

const reminderBody = (params: {
  studentName: string;
  invoiceNumber: string;
  dueAmount: string;
  schoolName: string;
  dueDate: string;
}) =>
  `Dear Parent, ${params.studentName} has a pending fee balance of ${params.dueAmount} for invoice ${params.invoiceNumber} at ${params.schoolName}. Due date: ${params.dueDate}. Please ignore this reminder if payment has already been made.`;

const reminderHtml = (params: {
  studentName: string;
  invoiceNumber: string;
  dueAmount: string;
  schoolName: string;
  dueDate: string;
}) => `
  <p>Dear Parent,</p>
  <p>${params.studentName} has a pending fee balance of <strong>${params.dueAmount}</strong> for invoice <strong>${params.invoiceNumber}</strong> at ${params.schoolName}.</p>
  <p>Due date: ${params.dueDate}</p>
  <p>Please ignore this reminder if payment has already been made.</p>
`;

const hasSuccessfulPaymentInReminderWindow = async (params: {
  schoolId: string;
  studentId: string;
  windowStart: Date;
  now: Date;
}) => {
  const payment = await prisma.feePayment.findFirst({
    where: {
      schoolId: params.schoolId,
      studentId: params.studentId,
      status: 'SUCCESS',
      paidAt: {
        gte: params.windowStart,
        lte: params.now,
      },
    },
    select: { id: true },
  });
  return Boolean(payment);
};

const alreadySentToday = async (params: {
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  invoiceId: string;
  recipient: string;
  channel: 'EMAIL' | 'IN_APP';
  todayStart: Date;
  tomorrowStart: Date;
}) => {
  const existing = await prisma.feeNotification.findFirst({
    where: {
      schoolId: params.schoolId,
      academicSessionId: params.academicSessionId,
      studentId: params.studentId,
      invoiceId: params.invoiceId,
      type: 'FEE_DUE_REMINDER',
      channel: params.channel,
      recipient: params.recipient,
      createdAt: {
        gte: params.todayStart,
        lt: params.tomorrowStart,
      },
    },
    select: { id: true },
  });
  return Boolean(existing);
};

const recordFeeReminder = async (params: {
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  invoiceId: string;
  recipient: string;
  channel: 'EMAIL' | 'IN_APP';
  subject: string;
  message: string;
  sent: boolean;
}) =>
  prisma.feeNotification.create({
    data: {
      schoolId: params.schoolId,
      academicSessionId: params.academicSessionId,
      studentId: params.studentId,
      invoiceId: params.invoiceId,
      type: 'FEE_DUE_REMINDER',
      channel: params.channel,
      recipient: params.recipient,
      subject: params.subject,
      message: params.message,
      status: params.sent ? 'SENT' : 'FAILED',
      sentAt: params.sent ? new Date() : null,
    },
  });

export const processMonthlyFeeReminders = async (params?: { now?: Date; batchSize?: number }) => {
  const now = params?.now ?? new Date();
  const dayOfMonth = now.getDate();
  if (dayOfMonth < reminderStartDay || dayOfMonth > reminderEndDay) {
    return { processed: 0, sent: 0, skipped: 0, failed: 0, outsideWindow: true };
  }

  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const reminderWindowStart = startOfMonth(now);
  const batchSize = Math.max(1, params?.batchSize ?? feeReminderBatchSize);
  let cursor: string | undefined;
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const paymentSkipCache = new Map<string, boolean>();

  do {
    const invoices = await prisma.feeInvoice.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['PAID', 'CANCELLED'] },
        dueAmount: { gt: 0 },
      },
      include: {
        school: { select: { name: true } },
        student: {
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
        },
      },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      take: batchSize,
    });

    processed += invoices.length;

    for (const invoice of invoices) {
    const paymentCacheKey = `${invoice.schoolId}:${invoice.studentId}`;
    let hasPayment = paymentSkipCache.get(paymentCacheKey);
    if (hasPayment === undefined) {
      hasPayment = await hasSuccessfulPaymentInReminderWindow({
        schoolId: invoice.schoolId,
        studentId: invoice.studentId,
        windowStart: reminderWindowStart,
        now,
      });
      paymentSkipCache.set(paymentCacheKey, hasPayment);
    }

    if (hasPayment) {
      skipped += 1;
      continue;
    }

    const childName = studentName(invoice.student);
    const dueAmount = formatMoney(invoice.dueAmount);
    const subject = reminderSubject(childName);
    const body = reminderBody({
      studentName: childName,
      invoiceNumber: invoice.invoiceNumber,
      dueAmount,
      schoolName: invoice.school.name,
      dueDate: formatDate(invoice.dueDate),
    });
    const html = reminderHtml({
      studentName: childName,
      invoiceNumber: invoice.invoiceNumber,
      dueAmount,
      schoolName: invoice.school.name,
      dueDate: formatDate(invoice.dueDate),
    });

    const parents = invoice.student.parentLinks.map((link) => link.parent);
    const emailRecipients = Array.from(
      new Set([
        ...parents.map((parent) => parent.email || parent.user?.email || ''),
        invoice.student.parentEmail || '',
      ]),
    )
      .map((email) => email.trim())
      .filter(Boolean);
    const pushRecipients = Array.from(new Set(parents.map((parent) => parent.userId).filter(Boolean)));

    for (const email of emailRecipients) {
      const recipient = String(email);
      if (
        await alreadySentToday({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'EMAIL',
          todayStart,
          tomorrowStart,
        })
      ) {
        skipped += 1;
        continue;
      }

      try {
        await sendNotification({
          schoolId: invoice.schoolId,
          userId: null,
          channel: 'EMAIL',
          data: {
            to: recipient,
            subject,
            body,
            html,
            emailIntent: 'GENERAL_COMMUNICATION',
            module: 'fees',
            category: 'fee_reminder',
            alertType: 'FEE_REMINDER',
            action: 'PAY_FEES',
            tab: 'fees',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            childId: invoice.studentId,
            childName,
            dueAmount,
          },
        });
        await recordFeeReminder({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'EMAIL',
          subject,
          message: body,
          sent: true,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        logger.warn({ err: error, invoiceId: invoice.id, recipient }, 'fee reminder email failed');
        await recordFeeReminder({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'EMAIL',
          subject,
          message: body,
          sent: false,
        });
      }
    }

    for (const userId of pushRecipients) {
      const recipient = String(userId);
      if (
        await alreadySentToday({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'IN_APP',
          todayStart,
          tomorrowStart,
        })
      ) {
        skipped += 1;
        continue;
      }

      const parent = parents.find((item) => item.userId === recipient);
      try {
        await sendNotification({
          schoolId: invoice.schoolId,
          userId: null,
          channel: 'PUSH',
          data: {
            to: recipient,
            subject,
            body,
            recipientName: parent ? parentName(parent) : 'Parent',
            recipientType: 'PARENT',
            targetMode: 'STUDENT',
            recipientGroups: ['GUARDIANS'],
            route: `/profile?childId=${invoice.studentId}&tab=fees`,
            module: 'fees',
            category: 'fee_reminder',
            alertType: 'FEE_REMINDER',
            action: 'PAY_FEES',
            tab: 'fees',
            priority: 'high',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            childId: invoice.studentId,
            childName,
            dueAmount,
          },
        });
        await recordFeeReminder({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'IN_APP',
          subject,
          message: body,
          sent: true,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        logger.warn({ err: error, invoiceId: invoice.id, recipient }, 'fee reminder push failed');
        await recordFeeReminder({
          schoolId: invoice.schoolId,
          academicSessionId: invoice.academicSessionId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          recipient,
          channel: 'IN_APP',
          subject,
          message: body,
          sent: false,
        });
      }
    }
    }

    if (invoices.length < batchSize) break;
    cursor = invoices[invoices.length - 1]?.id;
  } while (cursor);

  if (processed > 0 || sent > 0 || failed > 0) {
    logger.info({ processed, sent, skipped, failed, dueAt: now }, 'processed monthly fee reminders');
  }

  return { processed, sent, skipped, failed, outsideWindow: false };
};

export const runMonthlyFeeReminderOnce = async (params?: {
  lockClient?: DistributedLockClient;
  now?: Date;
  batchSize?: number;
}) =>
  runWithDistributedLock({
    key: feeReminderLockKey,
    ttlMs: feeReminderLockTtlMs,
    jobName: feeReminderJobName,
    client: params?.lockClient,
    run: () => processMonthlyFeeReminders({ now: params?.now, batchSize: params?.batchSize }),
  });

const triggerFeeReminderRun = () => {
  if (activeFeeReminderRun) return activeFeeReminderRun;
  activeFeeReminderRun = runMonthlyFeeReminderOnce().finally(() => {
    activeFeeReminderRun = undefined;
  });
  return activeFeeReminderRun;
};

export const startMonthlyFeeReminderScheduler = () => {
  if (feeReminderInterval) return;
  feeReminderInterval = setInterval(() => {
    void triggerFeeReminderRun();
  }, feeReminderIntervalMs);
  void triggerFeeReminderRun();
};

export const stopMonthlyFeeReminderScheduler = async () => {
  const activeRun = activeFeeReminderRun;
  clearInterval(feeReminderInterval);
  feeReminderInterval = undefined;
  if (activeRun) await activeRun;
};
