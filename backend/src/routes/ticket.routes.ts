import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createTicketApi, updateTicketApi, listTicketsApi } from '../controllers/ticket.controller';

export const ticketRouter = Router();

ticketRouter.use(authMiddleware);

ticketRouter.post('/', createTicketApi);

ticketRouter.get('/', listTicketsApi);

ticketRouter.patch('/:id', updateTicketApi);
