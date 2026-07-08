import { Router } from 'express';
import {
  createCommunicationNoticeApi,
  createCommunicationTemplateApi,
  deleteCommunicationNoticeApi,
  deleteCommunicationTemplateApi,
  listCommunicationLogsApi,
  listCommunicationNoticesApi,
  listCommunicationScheduledLogsApi,
  listCommunicationTemplatesApi,
  sendEmailCommunicationApi,
  sendLoginCredentialInstructionsApi,
  sendPushCommunicationApi,
  sendSmsCommunicationApi,
  updateCommunicationNoticeApi,
  updateCommunicationTemplateApi,
} from '../controllers/communication.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const communicationRouter = Router();

communicationRouter.use(authMiddleware);

communicationRouter.get('/notices', listCommunicationNoticesApi);
communicationRouter.post('/notices', createCommunicationNoticeApi);
communicationRouter.patch('/notices/:id', updateCommunicationNoticeApi);
communicationRouter.delete('/notices/:id', deleteCommunicationNoticeApi);

communicationRouter.get('/templates', listCommunicationTemplatesApi);
communicationRouter.post('/templates', createCommunicationTemplateApi);
communicationRouter.patch('/templates/:id', updateCommunicationTemplateApi);
communicationRouter.delete('/templates/:id', deleteCommunicationTemplateApi);

communicationRouter.post('/send-email', sendEmailCommunicationApi);
communicationRouter.post('/send-sms', sendSmsCommunicationApi);
communicationRouter.post('/send-push', sendPushCommunicationApi);
communicationRouter.post('/login-credentials', sendLoginCredentialInstructionsApi);

communicationRouter.get('/logs', listCommunicationLogsApi);
communicationRouter.get('/scheduled-logs', listCommunicationScheduledLogsApi);
