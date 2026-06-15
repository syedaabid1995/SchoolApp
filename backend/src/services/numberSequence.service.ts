import { Prisma, type NumberSequenceType } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export type NumberSequenceClient = {
  numberSequence: Pick<Prisma.TransactionClient['numberSequence'], 'upsert'>;
};

export type GetNextNumberInput = {
  schoolId: string;
  academicSessionId?: string | null;
  type: NumberSequenceType;
  year?: number;
  prefix?: string;
  width?: number;
};

const DEFAULT_PREFIX: Record<NumberSequenceType, string> = {
  INVOICE: 'INV',
  PAYMENT: 'PAY',
  RECEIPT: 'RCP',
  REVERSAL: 'REV',
};

const MAX_RETRIES = 3;

const isRetryableSequenceError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code);

const formatSequenceNumber = (prefix: string, year: number, lastNumber: number, width: number) =>
  `${prefix}-${year}-${String(lastNumber).padStart(width, '0')}`;

export const getNextNumber = async (
  input: GetNextNumberInput,
  client: NumberSequenceClient = prisma,
) => {
  const year = input.year ?? new Date().getFullYear();
  const prefix = input.prefix ?? DEFAULT_PREFIX[input.type];
  const width = input.width ?? 6;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const sequence = await client.numberSequence.upsert({
        where: {
          schoolId_type_year: {
            schoolId: input.schoolId,
            type: input.type,
            year,
          },
        },
        create: {
          schoolId: input.schoolId,
          academicSessionId: input.academicSessionId ?? null,
          type: input.type,
          year,
          prefix,
          lastNumber: 1,
        },
        update: {
          academicSessionId: input.academicSessionId ?? undefined,
          prefix,
          lastNumber: { increment: 1 },
        },
        select: {
          prefix: true,
          year: true,
          lastNumber: true,
        },
      });

      return formatSequenceNumber(sequence.prefix, sequence.year, sequence.lastNumber, width);
    } catch (error) {
      if (attempt < MAX_RETRIES && isRetryableSequenceError(error)) {
        continue;
      }
      if (isRetryableSequenceError(error)) {
        throw new HttpError(409, `Unable to generate a unique ${input.type.toLowerCase()} number. Please retry.`);
      }
      throw error;
    }
  }

  throw new HttpError(409, `Unable to generate a unique ${input.type.toLowerCase()} number. Please retry.`);
};
