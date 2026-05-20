import type { Request, Response } from 'express';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import {
  addTicketComment,
  assignTicket,
  createTicket,
  getTicketById,
  listAssignableSupportUsers,
  listTickets,
  updateTicket,
} from '../services/ticket.service';
import {
  addTicketCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketPrioritySchema,
  updateTicketSchema,
  updateTicketStatusSchema,
} from '../validations/ticket.validation';

const requireAuthContext = (req: Request) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const actorRole = (req: Request) => req.auth?.role ?? 'UNKNOWN';

const resolveTicketSchoolScope = (req: Request, requestedSchoolId?: string) => {
  if (req.auth?.role === 'SUPER_ADMIN') {
    return requestedSchoolId;
  }
  return resolveSchoolId(req, requestedSchoolId ?? req.auth?.schoolId);
};

const parseTicketId = (req: Request) => ticketIdParamSchema.parse(req.params).id;

export const createTicketApi = async (req: Request, res: Response) => {
  const payload = createTicketSchema.parse(req.body);
  const auth = requireAuthContext(req);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));

  const ticket = await createTicket({
    schoolId,
    createdById: auth.userId,
    actorRole: actorRole(req),
    subject: payload.subject,
    description: payload.description,
    priority: payload.priority ?? 'MEDIUM',
  });

  res.status(201).json(ticket);
};

export const listTicketsApi = async (req: Request, res: Response) => {
  requireAuthContext(req);
  const query = listTicketsQuerySchema.parse(req.query);
  const schoolId = resolveTicketSchoolScope(req, query.schoolId);

  const tickets = await listTickets({
    schoolId,
    search: query.search,
    status: query.status,
    priority: query.priority,
    assignedToId: query.assignedToId,
  });
  res.status(200).json(tickets);
};

export const getTicketApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const ticketId = parseTicketId(req);
  const query = listTicketsQuerySchema.pick({ schoolId: true }).parse(req.query);
  const schoolId = resolveTicketSchoolScope(req, query.schoolId);

  const ticket = await getTicketById({
    ticketId,
    schoolId,
    includeInternalComments: req.auth?.role === 'SUPER_ADMIN',
    actorId: auth.userId,
    actorRole: actorRole(req),
  });

  res.status(200).json(ticket);
};

export const addTicketCommentApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const ticketId = parseTicketId(req);
  const payload = addTicketCommentSchema.parse(req.body);
  const schoolId = resolveTicketSchoolScope(req);

  const comment = await addTicketComment({
    ticketId,
    schoolId,
    authorId: auth.userId,
    actorRole: actorRole(req),
    body: payload.body,
    isInternal: req.auth?.role === 'SUPER_ADMIN' ? payload.isInternal : false,
  });

  res.status(201).json(comment);
};

export const updateTicketApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketSchema.parse(req.body);
  const schoolId = resolveTicketSchoolScope(req, payload.schoolId);

  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    status: payload.status,
    priority: payload.priority,
    assignedToId: req.auth?.role === 'SUPER_ADMIN' ? payload.assignedToId : undefined,
    escalation: payload.escalation,
  });

  res.status(200).json(ticket);
};

export const updateTicketStatusApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketStatusSchema.parse(req.body);
  const schoolId = resolveTicketSchoolScope(req);

  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    status: payload.status,
  });

  res.status(200).json(ticket);
};

export const updateTicketPriorityApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketPrioritySchema.parse(req.body);
  const schoolId = resolveTicketSchoolScope(req);

  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    schoolId,
    actorId: auth.userId,
    actorRole: actorRole(req),
    priority: payload.priority,
  });

  res.status(200).json(ticket);
};

export const listAdminTicketsApi = async (req: Request, res: Response) => {
  const query = listTicketsQuerySchema.parse(req.query);
  const tickets = await listTickets({
    schoolId: query.schoolId,
    search: query.search,
    status: query.status,
    priority: query.priority,
    assignedToId: query.assignedToId,
  });
  res.status(200).json(tickets);
};

export const getAdminTicketApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const ticket = await getTicketById({
    ticketId: parseTicketId(req),
    includeInternalComments: true,
    actorId: auth.userId,
    actorRole: actorRole(req),
  });

  res.status(200).json(ticket);
};

export const addAdminTicketCommentApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = addTicketCommentSchema.parse(req.body);
  const comment = await addTicketComment({
    ticketId: parseTicketId(req),
    authorId: auth.userId,
    actorRole: actorRole(req),
    body: payload.body,
    isInternal: payload.isInternal,
  });

  res.status(201).json(comment);
};

export const updateAdminTicketApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketSchema.omit({ schoolId: true }).parse(req.body);
  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    actorId: auth.userId,
    actorRole: actorRole(req),
    status: payload.status,
    priority: payload.priority,
    assignedToId: payload.assignedToId,
    escalation: payload.escalation,
  });

  res.status(200).json(ticket);
};

export const assignAdminTicketApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = assignTicketSchema.parse(req.body);
  const ticket = await assignTicket({
    ticketId: parseTicketId(req),
    actorId: auth.userId,
    actorRole: actorRole(req),
    assignedToId: payload.assignedToId,
  });

  res.status(200).json(ticket);
};

export const updateAdminTicketStatusApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketStatusSchema.parse(req.body);
  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    actorId: auth.userId,
    actorRole: actorRole(req),
    status: payload.status,
  });

  res.status(200).json(ticket);
};

export const updateAdminTicketPriorityApi = async (req: Request, res: Response) => {
  const auth = requireAuthContext(req);
  const payload = updateTicketPrioritySchema.parse(req.body);
  const ticket = await updateTicket({
    ticketId: parseTicketId(req),
    actorId: auth.userId,
    actorRole: actorRole(req),
    priority: payload.priority,
  });

  res.status(200).json(ticket);
};

export const listAssignableSupportUsersApi = async (_req: Request, res: Response) => {
  const users = await listAssignableSupportUsers();
  res.status(200).json(users);
};
