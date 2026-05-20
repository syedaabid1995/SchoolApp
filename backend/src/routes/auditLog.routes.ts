import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { superAdminGuard } from '../middlewares/superAdminGuard.middleware';
import {
  downloadAdminAuditExportApi,
  getAdminAuditExportApi,
  getAdminAuditLogDetailApi,
  getAdminAuditSummaryApi,
  getAdminHighRiskAuditLogsApi,
  listAdminAuditExportsApi,
  listAdminAuditLogsApi,
  listAuditLogs,
  requestAdminAuditExportApi,
} from '../controllers/auditLog.controller';

export const auditLogRouter = Router();
export const adminAuditLogRouter = Router();
export const adminAuditExportRouter = Router();

auditLogRouter.use(authMiddleware);

auditLogRouter.get('/', listAuditLogs);

adminAuditLogRouter.use(authMiddleware);
adminAuditLogRouter.use(superAdminGuard);
adminAuditLogRouter.get('/', listAdminAuditLogsApi);
adminAuditLogRouter.get('/summary', getAdminAuditSummaryApi);
adminAuditLogRouter.get('/high-risk', getAdminHighRiskAuditLogsApi);
adminAuditLogRouter.post('/export', requestAdminAuditExportApi);
adminAuditLogRouter.get('/:id', getAdminAuditLogDetailApi);

adminAuditExportRouter.use(authMiddleware);
adminAuditExportRouter.use(superAdminGuard);
adminAuditExportRouter.get('/', listAdminAuditExportsApi);
adminAuditExportRouter.get('/:id', getAdminAuditExportApi);
adminAuditExportRouter.get('/:id/download', downloadAdminAuditExportApi);
