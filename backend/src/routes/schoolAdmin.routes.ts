import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  createSchoolApi,
  listSchoolsApi,
  updateSchoolApi,
  activateSchoolApi,
  suspendSchoolApi,
  deleteSchoolApi,
} from '../controllers/schoolAdmin.controller';

export const schoolAdminRouter = Router();

schoolAdminRouter.use(authMiddleware);
schoolAdminRouter.use(superAdminGuard);

schoolAdminRouter.post('/', createSchoolApi);
schoolAdminRouter.get('/', listSchoolsApi);
schoolAdminRouter.patch('/:id', updateSchoolApi);
schoolAdminRouter.post('/:id/activate', activateSchoolApi);
schoolAdminRouter.post('/:id/suspend', suspendSchoolApi);
schoolAdminRouter.delete('/:id', deleteSchoolApi);
