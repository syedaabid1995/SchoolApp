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
  getComplianceSummaryApi,
  listExportRequestsApi,
  getExportRequestByIdApi,
  approveExportRequestApi,
  rejectExportRequestApi,
  listDeletionRequestsApi,
  getDeletionRequestByIdApi,
  approveDeletionRequestApi,
  rejectDeletionRequestApi,
  listConsentRecordsApi,
  listComplianceJobsApi,
} from '../controllers/dataCompliance.controller';

export const dataComplianceRouter = Router();
export const adminDataComplianceRouter = Router();

dataComplianceRouter.use(authMiddleware);

dataComplianceRouter.post('/exports', requireSchoolAdminOrSuperAdmin, requestExport);
dataComplianceRouter.get('/exports/:id', requireSchoolAdminOrSuperAdmin, getExportStatus);

dataComplianceRouter.post('/deletions', requireSchoolAdminOrSuperAdmin, requestDeletionApi);
dataComplianceRouter.get('/deletions', requireSchoolAdminOrSuperAdmin, listDeletionJobsApi);
dataComplianceRouter.post('/deletions/:id/approve', requireSuperAdmin, approveDeletionApi);
dataComplianceRouter.post('/deletions/:id/execute', requireSuperAdmin, executeDeletionApi);

adminDataComplianceRouter.use(authMiddleware);
adminDataComplianceRouter.use(requireSuperAdmin);

adminDataComplianceRouter.get('/summary', getComplianceSummaryApi);
adminDataComplianceRouter.get('/export-requests', listExportRequestsApi);
adminDataComplianceRouter.get('/export-requests/:id', getExportRequestByIdApi);
adminDataComplianceRouter.post('/export-requests/:id/approve', approveExportRequestApi);
adminDataComplianceRouter.post('/export-requests/:id/reject', rejectExportRequestApi);

adminDataComplianceRouter.get('/deletion-requests', listDeletionRequestsApi);
adminDataComplianceRouter.get('/deletion-requests/:id', getDeletionRequestByIdApi);
adminDataComplianceRouter.post('/deletion-requests/:id/approve', approveDeletionRequestApi);
adminDataComplianceRouter.post('/deletion-requests/:id/reject', rejectDeletionRequestApi);

adminDataComplianceRouter.get('/consents', listConsentRecordsApi);
adminDataComplianceRouter.get('/jobs', listComplianceJobsApi);
