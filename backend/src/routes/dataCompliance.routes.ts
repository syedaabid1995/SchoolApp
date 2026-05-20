import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin, requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  requestExport,
  getExportStatus,
  requestDeletionApi,
  approveDeletionApi,
  executeDeletionApi,
  listDeletionJobsApi,
} from '../controllers/dataCompliance.controller';

export const dataComplianceRouter = Router();

dataComplianceRouter.use(authMiddleware);

dataComplianceRouter.post('/exports', requireSchoolAdminOrSuperAdmin, requestExport);
dataComplianceRouter.get('/exports/:id', requireSchoolAdminOrSuperAdmin, getExportStatus);

dataComplianceRouter.post('/deletions', requireSchoolAdminOrSuperAdmin, requestDeletionApi);
dataComplianceRouter.get('/deletions', requireSchoolAdminOrSuperAdmin, listDeletionJobsApi);
dataComplianceRouter.post('/deletions/:id/approve', requireSuperAdmin, approveDeletionApi);
dataComplianceRouter.post('/deletions/:id/execute', requireSuperAdmin, executeDeletionApi);
