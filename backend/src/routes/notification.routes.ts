import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  createTemplate,
  listTemplates,
  sendNotificationApi,
  listNotificationLogs,
  listNotificationSummary,
  registerPushDevice,
  unregisterPushDevice,
  getPushPreference,
  updatePushPreference,
  listPushNotificationLogs,
} from '../controllers/notification.controller';

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);

notificationRouter.post('/templates', requirePermission(P.settingsAccess), createTemplate);
notificationRouter.get('/templates', requirePermission(P.settingsAccess), listTemplates);
notificationRouter.post('/send', requirePermission(P.settingsAccess), sendNotificationApi);
notificationRouter.get('/logs', requirePermission(P.settingsAccess), listNotificationLogs);
notificationRouter.get('/summary', requirePermission(P.dashboardOverview, P.supportView, P.plansView), listNotificationSummary);
notificationRouter.post('/push/devices', registerPushDevice);
notificationRouter.post('/push/devices/unregister', unregisterPushDevice);
notificationRouter.get('/push/preferences/me', getPushPreference);
notificationRouter.patch('/push/preferences/me', updatePushPreference);
notificationRouter.get('/push/logs', requirePermission(P.communicationPushLogView, P.settingsAccess), listPushNotificationLogs);
