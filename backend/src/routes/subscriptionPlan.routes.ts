import { Router } from 'express';
import {
  listSubscriptionPlansApi,
  createSubscriptionPlanApi,
  updateSubscriptionPlanApi,
  deleteSubscriptionPlanApi,
  listPlanSchoolsApi,
} from '../controllers/subscriptionPlan.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';

export const subscriptionPlanRouter = Router();

subscriptionPlanRouter.use(authMiddleware);
subscriptionPlanRouter.use(superAdminGuard);

subscriptionPlanRouter.get('/', listSubscriptionPlansApi);
subscriptionPlanRouter.get('/:id/schools', listPlanSchoolsApi);
subscriptionPlanRouter.post('/', createSubscriptionPlanApi);
subscriptionPlanRouter.patch('/:id', updateSubscriptionPlanApi);
subscriptionPlanRouter.delete('/:id', deleteSubscriptionPlanApi);
