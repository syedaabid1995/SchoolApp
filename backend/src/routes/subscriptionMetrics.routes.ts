import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import { getSubscriptionMetricsApi } from '../controllers/subscriptionMetrics.controller';

export const subscriptionMetricsRouter = Router();

subscriptionMetricsRouter.use(authMiddleware);
subscriptionMetricsRouter.use(superAdminGuard);

subscriptionMetricsRouter.get('/:schoolId', getSubscriptionMetricsApi);
