import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin, requireSuperAdmin } from '../middlewares/rbac.middleware';
import { upsertSubscriptionApi, getSubscriptionApi } from '../controllers/subscription.controller';
import { listActivePlansApi } from '../controllers/subscriptionPlan.controller';

export const subscriptionRouter = Router();

subscriptionRouter.use(authMiddleware);

subscriptionRouter.get('/plans', requireSchoolAdminOrSuperAdmin, listActivePlansApi);
subscriptionRouter.get('/', requireSchoolAdminOrSuperAdmin, getSubscriptionApi);
subscriptionRouter.post('/', requireSuperAdmin, upsertSubscriptionApi);
