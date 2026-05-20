import type { TicketPriority, TicketStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

const SLA_HOURS: Record<TicketPriority, number> = {
  LOW: 72,
  MEDIUM: 48,
  HIGH: 24,
  URGENT: 8,
};

const supportUserSelect = {
  id: true,
  email: true,
  roles: { select: { role: { select: { name: true } } } },
  teacherProfile: { select: { firstName: true, lastName: true } },
  parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
};

const ticketInclude = (includeInternalComments: boolean) => ({
  school: { select: { id: true, name: true, code: true } },
  createdBy: { select: supportUserSelect },
  assignedTo: { select: supportUserSelect },
  comments: {
    ...(includeInternalComments ? {} : { where: { isInternal: false } }),
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: supportUserSelect } },
  },
});

const mapTicketNumber = (id: string) => `TCK-${id.slice(0, 8).toUpperCase()}`;

const mapUser = (user: any) => {
  if (!user) return null;

  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : null;
  const parent = user.parentProfiles?.[0];
  const parentName = parent ? `${parent.firstName} ${parent.lastName}`.trim() : null;

  return {
    id: user.id,
    name: teacherName || parentName || user.email,
    email: user.email,
    role: user.roles?.[0]?.role?.name ?? null,
  };
};

const mapComment = (comment: any) => ({
  id: comment.id,
  body: comment.body,
  isInternal: comment.isInternal,
  author: mapUser(comment.author),
  createdAt: comment.createdAt.toISOString(),
  updatedAt: comment.updatedAt.toISOString(),
});

const mapTicket = (ticket: any) => ({
  id: ticket.id,
  ticketNumber: mapTicketNumber(ticket.id),
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  category: null,
  schoolId: ticket.schoolId,
  school: ticket.school
    ? {
        id: ticket.school.id,
        name: ticket.school.name,
        code: ticket.school.code,
      }
    : null,
  createdBy: mapUser(ticket.createdBy),
  assignedTo: mapUser(ticket.assignedTo),
  escalation: ticket.escalation,
  slaDueAt: ticket.slaDueAt?.toISOString() ?? null,
  comments: ticket.comments?.map(mapComment) ?? [],
  createdAt: ticket.createdAt.toISOString(),
  updatedAt: ticket.updatedAt.toISOString(),
});

const findTicketForAccess = async (ticketId: string, schoolId?: string) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      ...(schoolId ? { schoolId } : {}),
    },
  });

  if (!ticket) {
    throw new HttpError(404, 'Ticket not found');
  }

  return ticket;
};

const assertAssignableSupportUser = async (assignedToId: string | null | undefined) => {
  if (!assignedToId) return;

  const user = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      status: 'ACTIVE',
      roles: {
        some: {
          role: { name: 'SUPER_ADMIN' },
        },
      },
    },
    select: { id: true },
  });

  if (!user) {
    throw new HttpError(400, 'Assigned user is not allowed to handle support tickets');
  }
};

const statusAuditAction = (oldStatus: TicketStatus, newStatus: TicketStatus) => {
  if (newStatus === 'CLOSED') return 'SUPPORT_TICKET_CLOSED';
  if (oldStatus === 'CLOSED') return 'SUPPORT_TICKET_REOPENED';
  return 'SUPPORT_TICKET_STATUS_CHANGED';
};

export const createTicket = async (params: {
  schoolId: string;
  createdById: string;
  actorRole: string;
  subject: string;
  description: string;
  priority: TicketPriority;
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
    include: ticketInclude(true),
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

  return mapTicket(ticket);
};

export const listTickets = async (params: {
  schoolId?: string;
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string;
}) => {
  const search = params.search?.trim();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { school: { name: { contains: search, mode: 'insensitive' } } },
              { school: { code: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      school: { select: { id: true, name: true, code: true } },
      createdBy: { select: supportUserSelect },
      assignedTo: { select: supportUserSelect },
    },
  });

  return tickets.map((ticket) => mapTicket({ ...ticket, comments: [] }));
};

export const getTicketById = async (params: {
  ticketId: string;
  schoolId?: string;
  includeInternalComments: boolean;
  actorId: string;
  actorRole: string;
}) => {
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: params.ticketId,
      ...(params.schoolId ? { schoolId: params.schoolId } : {}),
    },
    include: ticketInclude(params.includeInternalComments),
  });

  if (!ticket) {
    throw new HttpError(404, 'Ticket not found');
  }

  await createAuditLog({
    schoolId: ticket.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    action: 'SUPPORT_TICKET_VIEWED',
    afterState: { ticketId: ticket.id },
  });

  return mapTicket(ticket);
};

export const addTicketComment = async (params: {
  ticketId: string;
  schoolId?: string;
  authorId: string;
  actorRole: string;
  body: string;
  isInternal: boolean;
}) => {
  const ticket = await findTicketForAccess(params.ticketId, params.schoolId);
  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: params.authorId,
      schoolId: ticket.schoolId,
      body: params.body,
      isInternal: params.isInternal,
    },
    include: { author: { select: supportUserSelect } },
  });

  await createAuditLog({
    schoolId: ticket.schoolId,
    actorId: params.authorId,
    actorRole: params.actorRole,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    action: params.isInternal ? 'SUPPORT_TICKET_INTERNAL_NOTE_ADDED' : 'SUPPORT_TICKET_COMMENT_ADDED',
    afterState: {
      ticketId: ticket.id,
      commentId: comment.id,
      isInternal: comment.isInternal,
    },
  });

  return mapComment(comment);
};

export const updateTicket = async (params: {
  ticketId: string;
  schoolId?: string;
  actorId: string;
  actorRole: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
  escalation?: boolean;
}) => {
  const ticket = await findTicketForAccess(params.ticketId, params.schoolId);
  await assertAssignableSupportUser(params.assignedToId);

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: params.status ?? undefined,
      priority: params.priority ?? undefined,
      assignedToId: params.assignedToId === undefined ? undefined : params.assignedToId,
      escalation: params.escalation ?? undefined,
    },
    include: ticketInclude(true),
  });

  const auditLogs = [];

  if (params.status && params.status !== ticket.status) {
    auditLogs.push(
      createAuditLog({
        schoolId: ticket.schoolId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: statusAuditAction(ticket.status, params.status),
        beforeState: { status: ticket.status },
        afterState: { status: params.status },
      }),
    );
  }

  if (params.priority && params.priority !== ticket.priority) {
    auditLogs.push(
      createAuditLog({
        schoolId: ticket.schoolId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'SUPPORT_TICKET_PRIORITY_CHANGED',
        beforeState: { priority: ticket.priority },
        afterState: { priority: params.priority },
      }),
    );
  }

  if (params.assignedToId !== undefined && params.assignedToId !== ticket.assignedToId) {
    auditLogs.push(
      createAuditLog({
        schoolId: ticket.schoolId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'SUPPORT_TICKET_ASSIGNED',
        beforeState: { assignedToId: ticket.assignedToId },
        afterState: { assignedToId: params.assignedToId },
      }),
    );
  }

  if (!auditLogs.length && params.escalation !== undefined && params.escalation !== ticket.escalation) {
    auditLogs.push(
      createAuditLog({
        schoolId: ticket.schoolId,
        actorId: params.actorId,
        actorRole: params.actorRole,
        entityType: 'SupportTicket',
        entityId: ticket.id,
        action: 'SUPPORT_TICKET_UPDATED',
        beforeState: { escalation: ticket.escalation },
        afterState: { escalation: params.escalation },
      }),
    );
  }

  await Promise.all(auditLogs);

  return mapTicket(updated);
};

export const assignTicket = async (params: {
  ticketId: string;
  actorId: string;
  actorRole: string;
  assignedToId: string | null;
}) => {
  return updateTicket({
    ticketId: params.ticketId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    assignedToId: params.assignedToId,
  });
};

export const listAssignableSupportUsers = async () => {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      roles: {
        some: {
          role: { name: 'SUPER_ADMIN' },
        },
      },
    },
    orderBy: { email: 'asc' },
    select: supportUserSelect,
  });

  return users.map(mapUser).filter(Boolean);
};
