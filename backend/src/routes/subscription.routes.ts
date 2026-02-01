import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { upsertSubscriptionApi, getSubscriptionApi } from '../controllers/subscription.controller';
import { listActivePlansApi } from '../controllers/subscriptionPlan.controller';

export const subscriptionRouter = Router();

subscriptionRouter.use(authMiddleware);

subscriptionRouter.get('/plans', listActivePlansApi);
subscriptionRouter.get('/', getSubscriptionApi);
subscriptionRouter.post('/', upsertSubscriptionApi);
