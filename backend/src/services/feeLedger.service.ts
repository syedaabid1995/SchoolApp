import { FeeLedgerEntryType, Prisma } from '@prisma/client';

export type LedgerClient = Pick<Prisma.TransactionClient, 'feeLedger'>;

export type CreateLedgerEntryInput = {
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  invoiceId?: string | null;
  paymentId?: string | null;
  receiptId?: string | null;
  discountId?: string | null;
  fineId?: string | null;
  paymentReversalId?: string | null;
  carryForwardId?: string | null;
  type: FeeLedgerEntryType;
  debitAmount?: Prisma.Decimal | number | string;
  creditAmount?: Prisma.Decimal | number | string;
  description: string;
  createdById?: string | null;
};

const toDecimal = (value: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(value ?? 0);

export const createLedgerEntry = async (tx: LedgerClient, input: CreateLedgerEntryInput) => {
  const debitAmount = toDecimal(input.debitAmount);
  const creditAmount = toDecimal(input.creditAmount);
  const latest = await tx.feeLedger.findFirst({
    where: {
      schoolId: input.schoolId,
      academicSessionId: input.academicSessionId,
      studentId: input.studentId,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { balanceAfter: true },
  });
  const balanceAfter = toDecimal(latest?.balanceAfter).plus(debitAmount).minus(creditAmount);

  return tx.feeLedger.create({
    data: {
      schoolId: input.schoolId,
      academicSessionId: input.academicSessionId,
      studentId: input.studentId,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      receiptId: input.receiptId ?? null,
      discountId: input.discountId ?? null,
      fineId: input.fineId ?? null,
      paymentReversalId: input.paymentReversalId ?? null,
      carryForwardId: input.carryForwardId ?? null,
      type: input.type,
      description: input.description,
      debitAmount,
      creditAmount,
      balanceAfter,
      createdById: input.createdById ?? null,
    },
  });
};
