import { Router } from 'express';
import {
  approveDemoRequestApi,
  createPublicDemoRequestApi,
  listDemoRequestsApi,
  listPublicPlansApi,
} from '../controllers/demoRequest.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';

export const publicWebsiteRouter = Router();
export const adminDemoRequestRouter = Router();

publicWebsiteRouter.get('/plans', listPublicPlansApi);
publicWebsiteRouter.post('/demo-requests', createPublicDemoRequestApi);

adminDemoRequestRouter.use(authMiddleware);
adminDemoRequestRouter.use(superAdminGuard);
adminDemoRequestRouter.get('/', listDemoRequestsApi);
adminDemoRequestRouter.post('/:id/approve', approveDemoRequestApi);
