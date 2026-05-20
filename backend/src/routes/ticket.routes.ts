import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  addAdminTicketCommentApi,
  addTicketCommentApi,
  assignAdminTicketApi,
  createTicketApi,
  getAdminTicketApi,
  getTicketApi,
  listAdminTicketsApi,
  listAssignableSupportUsersApi,
  listTicketsApi,
  updateAdminTicketApi,
  updateAdminTicketPriorityApi,
  updateAdminTicketStatusApi,
  updateTicketApi,
  updateTicketPriorityApi,
  updateTicketStatusApi,
} from '../controllers/ticket.controller';

export const ticketRouter = Router();
export const adminSupportRouter = Router();

ticketRouter.use(authMiddleware);

ticketRouter.post('/', createTicketApi);
ticketRouter.get('/', listTicketsApi);
ticketRouter.get('/:id', getTicketApi);
ticketRouter.post('/:id/comments', addTicketCommentApi);
ticketRouter.patch('/:id', updateTicketApi);
ticketRouter.patch('/:id/status', updateTicketStatusApi);
ticketRouter.patch('/:id/priority', updateTicketPriorityApi);

adminSupportRouter.use(authMiddleware);
adminSupportRouter.use(requireSuperAdmin);

adminSupportRouter.get('/', listAdminTicketsApi);
adminSupportRouter.get('/assignable-users', listAssignableSupportUsersApi);
adminSupportRouter.get('/:id', getAdminTicketApi);
adminSupportRouter.post('/:id/comments', addAdminTicketCommentApi);
adminSupportRouter.patch('/:id', updateAdminTicketApi);
adminSupportRouter.patch('/:id/assign', assignAdminTicketApi);
adminSupportRouter.patch('/:id/status', updateAdminTicketStatusApi);
adminSupportRouter.patch('/:id/priority', updateAdminTicketPriorityApi);
