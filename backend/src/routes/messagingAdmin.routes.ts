import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  listMessagingServicesAdminApi,
  updateMessagingServiceStatusApi,
} from '../controllers/messagingAdmin.controller';

export const messagingAdminRouter = Router();

messagingAdminRouter.use(authMiddleware);
messagingAdminRouter.use(superAdminGuard);

messagingAdminRouter.get('/', listMessagingServicesAdminApi);
messagingAdminRouter.patch('/:id/status', updateMessagingServiceStatusApi);

