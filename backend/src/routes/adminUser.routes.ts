import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  disableAdminUserMfaApi,
  forceAdminPasswordResetApi,
  getAdminUserActivityApi,
  getAdminUserByIdApi,
  getAdminUserSessionsApi,
  getAdminUsersSummaryApi,
  listAdminUsersApi,
  lockAdminUserApi,
  revokeAdminUserSessionsApi,
  unlockAdminUserApi,
  updateAdminUserStatusApi,
} from '../controllers/adminUser.controller';

export const adminUserRouter = Router();

adminUserRouter.use(authMiddleware);
adminUserRouter.use(superAdminGuard);

adminUserRouter.get('/', listAdminUsersApi);
adminUserRouter.get('/summary', getAdminUsersSummaryApi);
adminUserRouter.get('/:id', getAdminUserByIdApi);
adminUserRouter.patch('/:id/status', updateAdminUserStatusApi);
adminUserRouter.patch('/:id/lock', lockAdminUserApi);
adminUserRouter.patch('/:id/unlock', unlockAdminUserApi);
adminUserRouter.post('/:id/force-password-reset', forceAdminPasswordResetApi);
adminUserRouter.post('/:id/revoke-sessions', revokeAdminUserSessionsApi);
adminUserRouter.post('/:id/disable-mfa', disableAdminUserMfaApi);
adminUserRouter.get('/:id/activity', getAdminUserActivityApi);
adminUserRouter.get('/:id/sessions', getAdminUserSessionsApi);
