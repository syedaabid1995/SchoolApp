import { Router } from 'express';
import { getSchoolSystemSettings, updateSchoolSystemSettings } from '../controllers/schoolSystemSettings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';

export const schoolSystemSettingsRouter = Router();

schoolSystemSettingsRouter.use(authMiddleware);
schoolSystemSettingsRouter.use(requireSchoolAdminOrSuperAdmin);

schoolSystemSettingsRouter.get('/school', getSchoolSystemSettings);
schoolSystemSettingsRouter.put('/school', updateSchoolSystemSettings);
