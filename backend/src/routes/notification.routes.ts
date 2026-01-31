import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createTemplate,
  listTemplates,
  sendNotificationApi,
  listNotificationLogs,
} from '../controllers/notification.controller';

export const notificationRouter = Router();

notificationRouter.use(authMiddleware);

notificationRouter.post('/templates', createTemplate);
notificationRouter.get('/templates', listTemplates);
notificationRouter.post('/send', sendNotificationApi);
notificationRouter.get('/logs', listNotificationLogs);
