import { Worker } from 'bullmq';
import { Prisma, type FeeCollectionSchedule } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { createLedgerEntry } from '../services/feeLedger.service';
import { getNextNumber } from '../services/numberSequence.service';

type FeeGenerationJobData = {
  jobId: string;
};

type AdmissionFeeGenerationPayload = {
  feeGroupIds?: string[];
  discountIds?: string[];
};

let worker: Worker<FeeGenerationJobData> | undefined;

const toDecimal = (value: number | string | Prisma.Decimal | null | undefined) => new Prisma.Decimal(value ?? 0);

const getStringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const feeScheduleMultiplier = (schedule?: FeeCollectionSchedule | null) => {
  switch (schedule) {
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'HALF_YEARLY':
      return 2;
    case 'YEARLY':
    case 'ONE_TIME':
    default:
      return 1;
  }
};

type AdmissionFeeMaster = Prisma.FeeMasterGetPayload<{ include: { feeType: { select: { schedule: true } } } }>;

const annualizedFeeMasterAmount = (master: AdmissionFeeMaster) =>
  toDecimal(master.amount).mul(feeScheduleMultiplier(master.feeType.schedule));

const isDiscountApplicable = (
  discount: Prisma.FeeDiscountGetPayload<{ include: { installments: true } }>,
  master: AdmissionFeeMaster,
  studentId: string,
) => {
  if (discount.installments.some((item) => item.feeMasterId === master.id && !item.deletedAt)) return true;
  if (discount.targetType === 'ALL') return true;
  if (discount.targetType === 'STUDENT') return discount.studentId === studentId;
  if (discount.targetType === 'FEE_TYPE') return discount.feeTypeId === master.feeTypeId;
  if (discount.targetType === 'FEE_GROUP') return discount.feeGroupId === master.feeGroupId;
  if (discount.targetType === 'FEE_MASTER') return discount.feeMasterId === master.id;
  return false;
};

const calculateDiscountAmount = (
  discounts: Array<Prisma.FeeDiscountGetPayload<{ include: { installments: true } }>>,
  master: AdmissionFeeMaster,
  studentId: string,
) => {
  const amount = annualizedFeeMasterAmount(master);
  return discounts.reduce((sum, discount) => {
    if (!isDiscountApplicable(discount, master, studentId)) return sum;
    const value = toDecimal(discount.amount ?? discount.value);
    const discountAmount = discount.valueType === 'PERCENTAGE' ? amount.mul(value).div(100) : value;
    return sum.plus(discountAmount);
  }, toDecimal(0));
};

export const startFeeGenerationWorker = () => {
  if (worker) return worker;

  worker = new Worker<FeeGenerationJobData>(
    'fee-generation',
    async (job) => {
      const jobId = job.data.jobId;
      const generationJob = await prisma.feeInvoiceGenerationJob.findUnique({
        where: { id: jobId },
      });

      if (!generationJob) {
        logger.warn({ queueJobId: job.id, feeGenerationJobId: jobId }, 'fee generation job record not found');
        return;
      }

      await prisma.$transaction(async (tx) => {
        await tx.feeInvoiceGenerationJob.update({
          where: { id: generationJob.id },
          data: { status: 'PROCESSING', error: null },
        });

        if (generationJob.source !== 'ADMISSION' || !generationJob.studentId) {
          await tx.feeInvoiceGenerationJob.update({
            where: { id: generationJob.id },
            data: { status: 'COMPLETED', result: { generatedInvoiceIds: [], skipped: [{ reason: 'Unsupported fee generation source' }] } },
          });
          return;
        }

        const payload = generationJob.payload as AdmissionFeeGenerationPayload;
        const feeGroupIds = getStringArray(payload.feeGroupIds);
        const discountIds = getStringArray(payload.discountIds);
        if (!feeGroupIds.length) {
          await tx.feeInvoiceGenerationJob.update({
            where: { id: generationJob.id },
            data: { status: 'COMPLETED', result: { generatedInvoiceIds: [], skipped: [{ reason: 'No fee groups selected' }] } },
          });
          return;
        }

        const student = await tx.student.findFirst({
          where: { id: generationJob.studentId, schoolId: generationJob.schoolId },
          select: { id: true, classId: true, sectionId: true },
        });
        if (!student) throw new Error('Student not found for fee generation');

        const now = new Date();
        const masters = await tx.feeMaster.findMany({
          where: {
            schoolId: generationJob.schoolId,
            academicSessionId: generationJob.academicSessionId,
            feeGroupId: { in: feeGroupIds },
            status: 'ACTIVE',
            deletedAt: null,
            OR: [
              { effectiveFrom: null },
              { effectiveFrom: { lte: now } },
            ],
            AND: [
              {
                OR: [
                  { effectiveTo: null },
                  { effectiveTo: { gte: now } },
                ],
              },
            ],
          },
          include: { feeType: { select: { schedule: true } } },
          orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        });

        const discounts = discountIds.length
          ? await tx.feeDiscount.findMany({
              where: {
                schoolId: generationJob.schoolId,
                academicSessionId: generationJob.academicSessionId,
                id: { in: discountIds },
                deletedAt: null,
                approvalStatus: { in: ['APPROVED', 'ACTIVE'] },
                OR: [
                  { validFrom: null },
                  { validFrom: { lte: now } },
                ],
                AND: [
                  {
                    OR: [
                      { validTo: null },
                      { validTo: { gte: now } },
                    ],
                  },
                ],
              },
              include: { installments: true },
            })
          : [];

        const generatedInvoiceIds: string[] = [];
        const skipped: Array<{ feeMasterId?: string; reason: string }> = [];

        for (const master of masters) {
          const existing = await tx.feeInvoice.findFirst({
            where: {
              schoolId: generationJob.schoolId,
              academicSessionId: generationJob.academicSessionId,
              studentId: generationJob.studentId,
              feeGroupId: master.feeGroupId,
              deletedAt: null,
              status: { not: 'CANCELLED' },
              items: { some: { feeMasterId: master.id } },
            },
            select: { id: true },
          });
          if (existing) {
            skipped.push({ feeMasterId: master.id, reason: 'Invoice already exists for this fee master' });
            continue;
          }

          const amount = annualizedFeeMasterAmount(master);
          const discountAmount = Prisma.Decimal.min(calculateDiscountAmount(discounts, master, generationJob.studentId), amount);
          const dueAmount = Prisma.Decimal.max(amount.minus(discountAmount), 0);
          const invoiceNumber = await getNextNumber({
            schoolId: generationJob.schoolId,
            academicSessionId: generationJob.academicSessionId,
            type: 'INVOICE',
            year: new Date().getFullYear(),
          }, tx);

          const invoice = await tx.feeInvoice.create({
            data: {
              schoolId: generationJob.schoolId,
              academicSessionId: generationJob.academicSessionId,
              studentId: generationJob.studentId,
              classId: student.classId,
              sectionId: student.sectionId,
              feeTypeId: master.feeTypeId,
              feeGroupId: master.feeGroupId,
              invoiceNumber,
              feeMonth: master.code,
              issueDate: now,
              dueDate: master.dueDate,
              totalAmount: amount,
              discountAmount,
              paidAmount: toDecimal(0),
              dueAmount,
              status: dueAmount.eq(0) ? 'PAID' : 'ISSUED',
              createdById: generationJob.createdById,
              items: {
                create: [{
                  feeMasterId: master.id,
                  name: master.name,
                  amount,
                  discountAmount,
                  netAmount: dueAmount,
                  sortOrder: 1,
                }],
              },
            },
          });

          await createLedgerEntry(tx, {
            schoolId: generationJob.schoolId,
            academicSessionId: generationJob.academicSessionId,
            studentId: generationJob.studentId,
            invoiceId: invoice.id,
            type: 'INVOICE_DEBIT',
            description: `Admission fee invoice ${invoice.invoiceNumber}`,
            debitAmount: amount,
            createdById: generationJob.createdById,
          });
          if (discountAmount.gt(0)) {
            await createLedgerEntry(tx, {
              schoolId: generationJob.schoolId,
              academicSessionId: generationJob.academicSessionId,
              studentId: generationJob.studentId,
              invoiceId: invoice.id,
              type: 'DISCOUNT_CREDIT',
              description: `Admission discount on invoice ${invoice.invoiceNumber}`,
              creditAmount: discountAmount,
              createdById: generationJob.createdById,
            });
          }
          generatedInvoiceIds.push(invoice.id);
        }

        await tx.feeInvoiceGenerationJob.update({
          where: { id: generationJob.id },
          data: { status: 'COMPLETED', result: { generatedInvoiceIds, skipped } },
        });
      });
    },
    { connection: redis },
  );

  worker.on('failed', async (job, err) => {
    logger.error({ jobId: job?.id, feeGenerationJobId: job?.data.jobId, err }, 'fee generation job failed');

    if (!job?.data.jobId) return;
    await prisma.feeInvoiceGenerationJob
      .update({
        where: { id: job.data.jobId },
        data: { status: 'FAILED', error: err.message },
      })
      .catch((updateErr) => logger.error({ err: updateErr, feeGenerationJobId: job.data.jobId }, 'failed to mark fee generation job failed'));
  });

  return worker;
};

export const stopFeeGenerationWorker = async () => {
  if (!worker) return;
  await worker.close();
  worker = undefined;
};
