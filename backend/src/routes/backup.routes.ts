import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSuperAdmin } from '../middlewares/rbac.middleware';
import {
  requestBackup,
  requestRestore,
  approveRestore,
  rejectRestore,
  listBackups,
  listRestores,
  getBackup,
  getRestore,
} from '../controllers/backup.controller';

export const backupRouter = Router();

backupRouter.use(authMiddleware);
backupRouter.use(requireSuperAdmin);

backupRouter.post('/backups', requestBackup);
backupRouter.get('/backups', listBackups);
backupRouter.get('/backups/:id', getBackup);
backupRouter.post('/restores', requestRestore);
backupRouter.get('/restores', listRestores);
backupRouter.get('/restores/:id', getRestore);
backupRouter.post('/restores/:id/approve', approveRestore);
backupRouter.post('/restores/:id/reject', rejectRestore);
