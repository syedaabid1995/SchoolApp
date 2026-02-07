import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import {
  getSchoolMessagingConfigApi,
  listMessagingServicesForSchoolApi,
  toggleSchoolMessagingConfigApi,
  upsertSchoolMessagingConfigApi,
} from '../controllers/messagingSettings.controller';

export const messagingSettingsRouter = Router();

messagingSettingsRouter.use(authMiddleware);
messagingSettingsRouter.use(requireRole('SCHOOL_ADMIN'));

messagingSettingsRouter.get('/services', listMessagingServicesForSchoolApi);
messagingSettingsRouter.get('/config', getSchoolMessagingConfigApi);
messagingSettingsRouter.put('/config', upsertSchoolMessagingConfigApi);
messagingSettingsRouter.patch('/config/status', toggleSchoolMessagingConfigApi);
