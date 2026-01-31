import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getAnalytics } from '../controllers/analytics.controller';

export const analyticsRouter = Router();

analyticsRouter.use(authMiddleware);

analyticsRouter.get('/', getAnalytics);
