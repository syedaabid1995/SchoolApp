import { HttpError } from '../middlewares/error.middleware';

export type BackupRequest = {
  schoolId: string;
  requestedBy: string;
  reason?: string | null;
};

export type RestoreRequest = {
  schoolId: string;
  backupId: string;
  requestedBy: string;
  reason?: string | null;
};

export const createBackup = async (_payload: BackupRequest) => {
  throw new HttpError(501, 'Backup service not configured');
};

export const restoreBackup = async (_payload: RestoreRequest) => {
  throw new HttpError(501, 'Restore service not configured');
};
