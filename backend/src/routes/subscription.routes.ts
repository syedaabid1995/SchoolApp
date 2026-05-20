import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin, requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  assignSchoolSubscriptionPlanApi,
  cancelSchoolSubscriptionApi,
  downgradeSchoolSubscriptionApi,
  extendSchoolSubscriptionTrialApi,
  getAdminSchoolSubscriptionDetailApi,
  getAdminSubscriptionHistoryApi,
  getAdminSubscriptionInvoicesApi,
  getAdminSubscriptionSummaryApi,
  getAdminSubscriptionUsageApi,
  getSubscriptionInvoicesApi,
  getSubscriptionUsageApi,
  getSubscriptionApi,
  listAdminSchoolSubscriptionsApi,
  overrideSchoolSubscriptionLimitsApi,
  pauseSchoolSubscriptionApi,
  recordSchoolSubscriptionManualPaymentApi,
  renewSchoolSubscriptionApi,
  resumeSchoolSubscriptionApi,
  startSchoolSubscriptionTrialApi,
  upgradeSchoolSubscriptionApi,
  upsertSubscriptionApi,
} from '../controllers/subscription.controller';
import { listActivePlansApi } from '../controllers/subscriptionPlan.controller';

export const subscriptionRouter = Router();
export const adminSubscriptionRouter = Router();

subscriptionRouter.use(authMiddleware);

subscriptionRouter.get('/plans', requireSchoolAdminOrSuperAdmin, listActivePlansApi);
subscriptionRouter.get('/usage', requireSchoolAdminOrSuperAdmin, getSubscriptionUsageApi);
subscriptionRouter.get('/invoices', requireSchoolAdminOrSuperAdmin, getSubscriptionInvoicesApi);
subscriptionRouter.get('/', requireSchoolAdminOrSuperAdmin, getSubscriptionApi);
subscriptionRouter.post('/', requireSuperAdmin, upsertSubscriptionApi);

adminSubscriptionRouter.use(authMiddleware);
adminSubscriptionRouter.use(requireSuperAdmin);

adminSubscriptionRouter.get('/', listAdminSchoolSubscriptionsApi);
adminSubscriptionRouter.get('/summary', getAdminSubscriptionSummaryApi);
adminSubscriptionRouter.get('/:schoolId', getAdminSchoolSubscriptionDetailApi);
adminSubscriptionRouter.post('/:schoolId/assign-plan', assignSchoolSubscriptionPlanApi);
adminSubscriptionRouter.post('/:schoolId/start-trial', startSchoolSubscriptionTrialApi);
adminSubscriptionRouter.post('/:schoolId/extend-trial', extendSchoolSubscriptionTrialApi);
adminSubscriptionRouter.post('/:schoolId/upgrade', upgradeSchoolSubscriptionApi);
adminSubscriptionRouter.post('/:schoolId/downgrade', downgradeSchoolSubscriptionApi);
adminSubscriptionRouter.post('/:schoolId/pause', pauseSchoolSubscriptionApi);
adminSubscriptionRouter.post('/:schoolId/resume', resumeSchoolSubscriptionApi);
adminSubscriptionRouter.post('/:schoolId/cancel', cancelSchoolSubscriptionApi);
adminSubscriptionRouter.post('/:schoolId/renew', renewSchoolSubscriptionApi);
adminSubscriptionRouter.patch('/:schoolId/limits', overrideSchoolSubscriptionLimitsApi);
adminSubscriptionRouter.get('/:schoolId/history', getAdminSubscriptionHistoryApi);
adminSubscriptionRouter.get('/:schoolId/usage', getAdminSubscriptionUsageApi);
adminSubscriptionRouter.get('/:schoolId/invoices', getAdminSubscriptionInvoicesApi);
adminSubscriptionRouter.post('/:schoolId/manual-payment', recordSchoolSubscriptionManualPaymentApi);
