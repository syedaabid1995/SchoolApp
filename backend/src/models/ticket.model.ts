import { Prisma } from '@prisma/client';

export const ticketSelect = {
  id: true,
  schoolId: true,
  createdById: true,
  subject: true,
  description: true,
  status: true,
  priority: true,
  slaDueAt: true,
  escalation: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportTicketSelect;

export type TicketRecord = Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>;
