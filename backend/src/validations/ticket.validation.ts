import { z } from 'zod';

export const ticketStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const ticketIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  description: z.string().trim().min(1, 'Description is required').max(5000),
  priority: ticketPrioritySchema.optional(),
  schoolId: z.string().uuid().optional(),
});

export const updateTicketSchema = z.object({
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  escalation: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});

export const updateTicketPrioritySchema = z.object({
  priority: ticketPrioritySchema,
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid().nullable(),
});

export const addTicketCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment is required').max(5000),
  isInternal: z.boolean().optional().default(false),
});

export const listTicketsQuerySchema = z.object({
  schoolId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedToId: z.string().uuid().optional(),
});
