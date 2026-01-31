import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
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

dataComplianceRouter.post('/exports', requestExport);
dataComplianceRouter.get('/exports/:id', getExportStatus);

dataComplianceRouter.post('/deletions', requestDeletionApi);
dataComplianceRouter.get('/deletions', listDeletionJobsApi);
dataComplianceRouter.post('/deletions/:id/approve', approveDeletionApi);
dataComplianceRouter.post('/deletions/:id/execute', executeDeletionApi);
