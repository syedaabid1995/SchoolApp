import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createDocumentApi,
  grantConsentApi,
  withdrawConsentApi,
  listConsentApi,
} from '../controllers/consent.controller';

export const consentRouter = Router();

consentRouter.use(authMiddleware);

consentRouter.post('/documents', createDocumentApi);
consentRouter.post('/records', grantConsentApi);
consentRouter.get('/records', listConsentApi);
consentRouter.post('/records/:id/withdraw', withdrawConsentApi);
