import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

const SLA_HOURS: Record<string, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 8,
};

export const createTicket = async (params: {
  schoolId: string;
  createdById: string;
  actorRole: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}) => {
  const slaDueAt = new Date(Date.now() + SLA_HOURS[params.priority] * 60 * 60 * 1000);

  const ticket = await prisma.supportTicket.create({
    data: {
      schoolId: params.schoolId,
      createdById: params.createdById,
      subject: params.subject,
      description: params.description,
      priority: params.priority,
      slaDueAt,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.createdById,
    actorRole: params.actorRole,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    action: 'CREATE',
    afterState: { status: ticket.status, priority: ticket.priority },
  });

  return ticket;
};

export const updateTicket = async (params: {
  ticketId: string;
  schoolId: string;
  actorId: string;
  actorRole: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  escalation?: boolean;
}) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.ticketId, schoolId: params.schoolId },
  });
  if (!ticket) throw new HttpError(404, 'Ticket not found');

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: params.status ?? undefined,
      priority: params.priority ?? undefined,
      escalation: params.escalation ?? undefined,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    action: 'UPDATE',
    beforeState: { status: ticket.status, priority: ticket.priority, escalation: ticket.escalation },
    afterState: { status: updated.status, priority: updated.priority, escalation: updated.escalation },
  });

  return updated;
};

export const listTickets = async (schoolId?: string) => {
  return prisma.supportTicket.findMany({
    where: schoolId ? { schoolId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
};
