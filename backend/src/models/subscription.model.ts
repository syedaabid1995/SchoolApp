import { Prisma } from '@prisma/client';

export const subscriptionSelect = {
  id: true,
  schoolId: true,
  planName: true,
  status: true,
  startsAt: true,
  endsAt: true,
  studentLimit: true,
  teacherLimit: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SubscriptionSelect;

export type SubscriptionRecord = Prisma.SubscriptionGetPayload<{ select: typeof subscriptionSelect }>;
