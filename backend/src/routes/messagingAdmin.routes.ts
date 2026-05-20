import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  getPlatformEmailConfigApi,
  listMessagingServicesAdminApi,
  togglePlatformEmailConfigApi,
  updateMessagingServiceStatusApi,
  upsertPlatformEmailConfigApi,
} from '../controllers/messagingAdmin.controller';

export const messagingAdminRouter = Router();

messagingAdminRouter.use(authMiddleware);
messagingAdminRouter.use(superAdminGuard);

messagingAdminRouter.get('/', listMessagingServicesAdminApi);
messagingAdminRouter.get('/platform-email-config', getPlatformEmailConfigApi);
messagingAdminRouter.put('/platform-email-config', upsertPlatformEmailConfigApi);
messagingAdminRouter.patch('/platform-email-config/status', togglePlatformEmailConfigApi);
messagingAdminRouter.patch('/:id/status', updateMessagingServiceStatusApi);

