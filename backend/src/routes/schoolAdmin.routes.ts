import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  createSchoolApi,
  listSchoolAdminsApi,
  listSchoolsApi,
  updateSchoolApi,
  activateSchoolApi,
  suspendSchoolApi,
  deleteSchoolApi,
  restoreSchoolApi,
  createSchoolAdminApi,
  setSchoolAdminStatusApi,
} from '../controllers/schoolAdmin.controller';

export const schoolAdminRouter = Router();

schoolAdminRouter.use(authMiddleware);
schoolAdminRouter.use(superAdminGuard);

schoolAdminRouter.post('/', createSchoolApi);
schoolAdminRouter.get('/', listSchoolsApi);
schoolAdminRouter.get('/:id/admins', listSchoolAdminsApi);
schoolAdminRouter.patch('/:id', updateSchoolApi);
schoolAdminRouter.patch('/:id/admins/:adminId/status', setSchoolAdminStatusApi);
schoolAdminRouter.post('/:id/activate', activateSchoolApi);
schoolAdminRouter.post('/:id/suspend', suspendSchoolApi);
schoolAdminRouter.post('/:id/admins', createSchoolAdminApi);
schoolAdminRouter.delete('/:id', deleteSchoolApi);
schoolAdminRouter.post('/:id/restore', restoreSchoolApi);
