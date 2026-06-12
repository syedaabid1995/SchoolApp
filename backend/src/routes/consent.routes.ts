import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission, requireRole } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  createDocumentApi,
  grantConsentApi,
  withdrawConsentApi,
  listConsentApi,
} from '../controllers/consent.controller';

export const consentRouter = Router();

consentRouter.use(authMiddleware);

consentRouter.post('/documents', requirePermission(P.complianceReview, P.settingsAccess), createDocumentApi);
consentRouter.post('/records', requireRole('PARENT', 'SCHOOL_ADMIN'), grantConsentApi);
consentRouter.get('/records', requirePermission(P.complianceView), listConsentApi);
consentRouter.post('/records/:id/withdraw', requireRole('PARENT', 'SCHOOL_ADMIN'), withdrawConsentApi);
