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
type AdmissionStudent = {
  id: string;
  classId: string | null;
  sectionId: string | null;
  studentCategoryId: string | null;
};

const annualizedFeeMasterAmount = (master: AdmissionFeeMaster) =>
  toDecimal(master.amount).mul(feeScheduleMultiplier(master.feeType.schedule));

const isDiscountApplicable = (
  discount: Prisma.FeeDiscountGetPayload<{ include: { installments: true } }>,
  master: AdmissionFeeMaster,
) => {
  if (discount.installments.some((item) => item.feeMasterId === master.id && !item.deletedAt)) return true;
  if (discount.feeMasterId && discount.feeMasterId !== master.id) return false;
  if (discount.feeGroupId && discount.feeGroupId !== master.feeGroupId) return false;
  if (discount.feeTypeId && discount.feeTypeId !== master.feeTypeId) return false;
  return true;
};

const calculateDiscountAmountsByMaster = (
  discounts: Array<Prisma.FeeDiscountGetPayload<{ include: { installments: true } }>>,
  masters: AdmissionFeeMaster[],
) => {
  const totals = new Map<string, Prisma.Decimal>();
  masters.forEach((master) => totals.set(master.id, toDecimal(0)));

  for (const discount of discounts) {
    const applicableMasters = masters.filter((master) => isDiscountApplicable(discount, master));
    if (!applicableMasters.length) continue;

    const value = toDecimal(discount.amount ?? discount.value);
    if (discount.valueType === 'PERCENTAGE') {
      for (const master of applicableMasters) {
        const amount = annualizedFeeMasterAmount(master);
        totals.set(master.id, (totals.get(master.id) ?? toDecimal(0)).plus(amount.mul(value).div(100)));
      }
      continue;
    }

    const applicableTotal = applicableMasters.reduce(
      (sum, master) => sum.plus(annualizedFeeMasterAmount(master)),
      toDecimal(0),
    );
    if (applicableTotal.lte(0)) continue;

    let allocated = toDecimal(0);
    applicableMasters.forEach((master, index) => {
      const amount = annualizedFeeMasterAmount(master);
      const share =
        index === applicableMasters.length - 1
          ? Prisma.Decimal.max(value.minus(allocated), 0)
          : value.mul(amount).div(applicableTotal);
      allocated = allocated.plus(share);
      totals.set(master.id, (totals.get(master.id) ?? toDecimal(0)).plus(share));
    });
  }

  return totals;
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

        if (!['ADMISSION', 'MANUAL'].includes(generationJob.source) || !generationJob.studentId) {
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
          select: { id: true, classId: true, sectionId: true, studentCategoryId: true },
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
                  {
                    OR: [
                      { expiryDate: null },
                      { expiryDate: { gte: now } },
                    ],
                  },
                ],
              },
              include: { installments: true },
            })
          : [];

        const generatedInvoiceIds: string[] = [];
        const skipped: Array<{ feeMasterId?: string; reason: string }> = [];
        const discountAmountsByMaster = calculateDiscountAmountsByMaster(discounts, masters);

        for (const master of masters) {
          const amount = annualizedFeeMasterAmount(master);
          const discountAmount = Prisma.Decimal.min(discountAmountsByMaster.get(master.id) ?? toDecimal(0), amount);

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
            select: {
              id: true,
              invoiceNumber: true,
              totalAmount: true,
              discountAmount: true,
              fineAmount: true,
              paidAmount: true,
            },
          });
          if (existing) {
            const currentDiscount = toDecimal(existing.discountAmount);
            const additionalDiscount = Prisma.Decimal.max(discountAmount.minus(currentDiscount), 0);
            if (additionalDiscount.gt(0)) {
              const nextDiscountAmount = currentDiscount.plus(additionalDiscount);
              const nextDueAmount = Prisma.Decimal.max(
                toDecimal(existing.totalAmount)
                  .minus(nextDiscountAmount)
                  .plus(toDecimal(existing.fineAmount))
                  .minus(toDecimal(existing.paidAmount)),
                0,
              );
              await tx.feeInvoice.update({
                where: { id: existing.id },
                data: {
                  discountAmount: nextDiscountAmount,
                  dueAmount: nextDueAmount,
                  status: nextDueAmount.eq(0)
                    ? 'PAID'
                    : toDecimal(existing.paidAmount).gt(0)
                      ? 'PARTIALLY_PAID'
                      : 'ISSUED',
                  items: {
                    updateMany: {
                      where: { feeMasterId: master.id },
                      data: {
                        discountAmount: nextDiscountAmount,
                        netAmount: nextDueAmount,
                      },
                    },
                  },
                },
              });
              await createLedgerEntry(tx, {
                schoolId: generationJob.schoolId,
                academicSessionId: generationJob.academicSessionId,
                studentId: generationJob.studentId,
                invoiceId: existing.id,
                type: 'DISCOUNT_CREDIT',
                description: `Admission discount on invoice ${existing.invoiceNumber}`,
                creditAmount: additionalDiscount,
                createdById: generationJob.createdById,
              });
            }
            skipped.push({ feeMasterId: master.id, reason: 'Invoice already exists for this fee master' });
            continue;
          }

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
