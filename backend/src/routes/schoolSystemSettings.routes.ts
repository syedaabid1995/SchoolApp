import { Router } from 'express';
import {
  addSchoolDocument,
  deleteSchoolDocument,
  getSchoolSystemSettings,
  listSchoolDocuments,
  updateSchoolSystemSettings,
  uploadSchoolDocumentMiddleware,
} from '../controllers/schoolSystemSettings.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';

export const schoolSystemSettingsRouter = Router();

schoolSystemSettingsRouter.use(authMiddleware);
schoolSystemSettingsRouter.use(requireSchoolAdminOrSuperAdmin);

schoolSystemSettingsRouter.get('/school', getSchoolSystemSettings);
schoolSystemSettingsRouter.put('/school', updateSchoolSystemSettings);
schoolSystemSettingsRouter.get('/school/documents', listSchoolDocuments);
schoolSystemSettingsRouter.post('/school/documents', uploadSchoolDocumentMiddleware, addSchoolDocument);
schoolSystemSettingsRouter.delete('/school/documents/:documentId', deleteSchoolDocument);
