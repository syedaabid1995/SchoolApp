import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  requestBackup,
  requestRestore,
  approveRestore,
  listBackups,
  listRestores,
} from '../controllers/backup.controller';

export const backupRouter = Router();

backupRouter.use(authMiddleware);

backupRouter.post('/backups', requestBackup);
backupRouter.get('/backups', listBackups);
backupRouter.post('/restores', requestRestore);
backupRouter.get('/restores', listRestores);
backupRouter.post('/restores/:id/approve', approveRestore);
