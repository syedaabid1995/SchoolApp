import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { createTicket, updateTicket, listTickets } from '../services/ticket.service';

const createSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  escalation: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

export const createTicketApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const ticket = await createTicket({
    schoolId,
    createdById: auth.userId,
    actorRole: 'SCHOOL_ADMIN',
    subject: payload.subject,
    description: payload.description,
    priority: payload.priority ?? 'MEDIUM',
  });

  res.status(201).json(ticket);
};

export const updateTicketApi = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const ticket = await updateTicket({
    ticketId: req.params.id,
    schoolId,
    actorId: auth.userId,
    actorRole: 'SCHOOL_ADMIN',
    status: payload.status,
    priority: payload.priority,
    escalation: payload.escalation,
  });

  res.status(200).json(ticket);
};

export const listTicketsApi = async (req: Request, res: Response) => {
  const requestedSchoolId = req.query.schoolId as string | undefined;
  let schoolId: string | undefined;
  if (requestedSchoolId) {
    schoolId = resolveSchoolId(req, requestedSchoolId);
  } else if (req.auth?.role !== 'SUPER_ADMIN') {
    schoolId = resolveSchoolId(req, req.auth?.schoolId);
  }
  const tickets = await listTickets(schoolId);
  res.status(200).json(tickets);
};
