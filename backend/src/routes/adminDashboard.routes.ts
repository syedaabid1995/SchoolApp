import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getAdminDashboardApi } from '../controllers/adminDashboard.controller';

export const adminDashboardRouter = Router();

adminDashboardRouter.use(authMiddleware);

adminDashboardRouter.get('/', getAdminDashboardApi);
