import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin, requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  requestExport,
  requestDeletionApi,
  executeDeletionApi,
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
  getComplianceJobHistoryApi,
} from '../controllers/dataCompliance.controller';

export const dataComplianceRouter = Router();
export const adminDataComplianceRouter = Router();

dataComplianceRouter.use(authMiddleware);

dataComplianceRouter.post('/exports', requireSchoolAdminOrSuperAdmin, requestExport);
dataComplianceRouter.get('/exports', requireSchoolAdminOrSuperAdmin, listExportRequestsApi);
dataComplianceRouter.post('/exports/:id/approve', requireSchoolAdminOrSuperAdmin, approveExportRequestApi);
dataComplianceRouter.post('/exports/:id/reject', requireSchoolAdminOrSuperAdmin, rejectExportRequestApi);
dataComplianceRouter.get('/exports/:id', requireSchoolAdminOrSuperAdmin, getExportRequestByIdApi);

dataComplianceRouter.post('/deletions', requireSchoolAdminOrSuperAdmin, requestDeletionApi);
dataComplianceRouter.get('/deletions', requireSchoolAdminOrSuperAdmin, listDeletionRequestsApi);
dataComplianceRouter.post('/deletions/:id/approve', requireSchoolAdminOrSuperAdmin, approveDeletionRequestApi);
dataComplianceRouter.post('/deletions/:id/reject', requireSchoolAdminOrSuperAdmin, rejectDeletionRequestApi);
dataComplianceRouter.get('/deletions/:id', requireSchoolAdminOrSuperAdmin, getDeletionRequestByIdApi);
dataComplianceRouter.post('/deletions/:id/execute', requireSuperAdmin, executeDeletionApi);
dataComplianceRouter.get('/jobs/:id/history', requireSchoolAdminOrSuperAdmin, getComplianceJobHistoryApi);

adminDataComplianceRouter.use(authMiddleware);
adminDataComplianceRouter.use(requireSchoolAdminOrSuperAdmin);

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
adminDataComplianceRouter.get('/jobs/:id/history', getComplianceJobHistoryApi);
