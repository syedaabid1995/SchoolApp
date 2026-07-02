import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';
import {
  getSchoolMessagingConfigApi,
  listMessagingServicesForSchoolApi,
  testEmailMessagingConfigApi,
  testSmsMessagingConfigApi,
  testWhatsappMessagingConfigApi,
  toggleSchoolMessagingConfigApi,
  upsertSchoolMessagingConfigApi,
} from '../controllers/messagingSettings.controller';

export const messagingSettingsRouter = Router();

messagingSettingsRouter.use(authMiddleware);
messagingSettingsRouter.use(requireSchoolAdminOrSuperAdmin);

messagingSettingsRouter.get('/services', listMessagingServicesForSchoolApi);
messagingSettingsRouter.get('/config', getSchoolMessagingConfigApi);
messagingSettingsRouter.put('/config', upsertSchoolMessagingConfigApi);
messagingSettingsRouter.patch('/config/status', toggleSchoolMessagingConfigApi);
messagingSettingsRouter.post('/test-email', testEmailMessagingConfigApi);
messagingSettingsRouter.post('/test-sms', testSmsMessagingConfigApi);
messagingSettingsRouter.post('/test-whatsapp', testWhatsappMessagingConfigApi);
