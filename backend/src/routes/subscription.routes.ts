import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { upsertSubscriptionApi, getSubscriptionApi } from '../controllers/subscription.controller';

export const subscriptionRouter = Router();

subscriptionRouter.use(authMiddleware);

subscriptionRouter.get('/', getSubscriptionApi);
subscriptionRouter.post('/', upsertSubscriptionApi);
