import { Prisma } from '@prisma/client';

export const schoolSelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  subscriptionPlan: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SchoolSelect;

export type SchoolRecord = Prisma.SchoolGetPayload<{ select: typeof schoolSelect }>;
