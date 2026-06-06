import { Prisma, type Student } from '@prisma/client';
import { prisma } from '../config/db';

export type FeeCalculationScope = {
  schoolId: string;
  academicSessionId: string;
};

export type FeeCalculationStructure = {
  id: string;
  feeTypeId: string;
  name: string;
  items: Array<{
    particularId: string;
    amount: Prisma.Decimal | number | string;
    sortOrder: number;
    particular: { name: string };
  }>;
};

export type FeeCalculationAssignment = {
  overrideAmount?: Prisma.Decimal | number | string | null;
} | null;

export type FeeCalculationDiscount = {
  valueType: 'PERCENTAGE' | 'FIXED';
  value: Prisma.Decimal | number | string;
  amount?: Prisma.Decimal | number | string | null;
};

export type FeeInvoiceCalculation = {
  baseAmount: Prisma.Decimal;
  previousBalance: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  fineAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  invoiceItems: Array<{
    particularId: string | null;
    name: string;
    amount: Prisma.Decimal | number | string;
    discountAmount: Prisma.Decimal;
    fineAmount: Prisma.Decimal;
    netAmount: Prisma.Decimal | number | string;
    sortOrder: number;
  }>;
};

const approvedDiscountStatuses = ['APPROVED', 'ACTIVE'] as const;
const toDecimal = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);

export const calculateFeeInvoiceAmountsFromPreloaded = ({
  structure,
  assignment,
  previousBalance,
  discounts,
  fineAmount: inputFineAmount,
}: {
  structure: FeeCalculationStructure;
  assignment?: FeeCalculationAssignment;
  previousBalance?: Prisma.Decimal | number | string;
  discounts?: FeeCalculationDiscount[];
  fineAmount?: Prisma.Decimal | number | string;
}): FeeInvoiceCalculation => {
  const defaultItemTotal = structure.items.reduce((sum, item) => sum.plus(item.amount), toDecimal(0));
  const overrideAmount = assignment?.overrideAmount ? toDecimal(assignment.overrideAmount) : null;
  const baseAmount = overrideAmount?.gt(0) ? overrideAmount : defaultItemTotal;
  const invoiceItems = overrideAmount?.gt(0)
    ? [{
        particularId: structure.items[0]?.particularId ?? null,
        name: `${structure.name} (Override amount)`,
        amount: overrideAmount,
        discountAmount: toDecimal(0),
        fineAmount: toDecimal(0),
        netAmount: overrideAmount,
        sortOrder: 1,
      }]
    : structure.items.map((item) => ({
        particularId: item.particularId,
        name: item.particular.name,
        amount: item.amount,
        discountAmount: toDecimal(0),
        fineAmount: toDecimal(0),
        netAmount: item.amount,
        sortOrder: item.sortOrder,
      }));

  const previousBalanceAmount = toDecimal(previousBalance ?? 0);
  const rawDiscountAmount = (discounts ?? []).reduce((sum, discount) => {
    const value = toDecimal(discount.amount ?? discount.value);
    if (discount.valueType === 'PERCENTAGE') return sum.plus(baseAmount.mul(value).div(100));
    return sum.plus(value);
  }, toDecimal(0));
  const discountAmount = Prisma.Decimal.min(rawDiscountAmount, baseAmount);
  const fineAmount = toDecimal(inputFineAmount ?? 0);
  const grossAmount = baseAmount.plus(previousBalanceAmount);
  const totalAmount = grossAmount;
  const netAmount = Prisma.Decimal.max(grossAmount.minus(discountAmount).plus(fineAmount), 0);

  return {
    baseAmount,
    previousBalance: previousBalanceAmount,
    discountAmount,
    fineAmount,
    grossAmount,
    totalAmount,
    netAmount,
    invoiceItems,
  };
};

export const calculateFeeInvoiceAmounts = async ({
  scope,
  student,
  structure,
  assignment,
  dueDate,
}: {
  scope: FeeCalculationScope;
  student: Student;
  structure: FeeCalculationStructure;
  assignment?: FeeCalculationAssignment;
  feeMonth: string;
  dueDate: Date;
}): Promise<FeeInvoiceCalculation> => {
  const previousBalance = toDecimal(0);

  const discountTargets: Prisma.FeeDiscountWhereInput[] = [
    { targetType: 'ALL' },
    { targetType: 'FEE_TYPE', feeTypeId: structure.feeTypeId },
    { targetType: 'STUDENT', studentId: student.id },
  ];
  if (student.classId) discountTargets.push({ targetType: 'CLASS', classId: student.classId });
  if (student.sectionId) discountTargets.push({ targetType: 'SECTION', sectionId: student.sectionId });
  if (student.studentCategoryId) discountTargets.push({ targetType: 'CATEGORY', categoryId: student.studentCategoryId });

  const approvedDiscounts = await prisma.feeDiscount.findMany({
    where: {
      ...scope,
      deletedAt: null,
      approvalStatus: { in: [...approvedDiscountStatuses] },
      OR: discountTargets,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: dueDate } }] },
        { OR: [{ validTo: null }, { validTo: { gte: dueDate } }] },
        { OR: [{ feeTypeId: null }, { feeTypeId: structure.feeTypeId }] },
      ],
    },
  });

  return calculateFeeInvoiceAmountsFromPreloaded({
    structure,
    assignment,
    previousBalance,
    discounts: approvedDiscounts,
  });
};
