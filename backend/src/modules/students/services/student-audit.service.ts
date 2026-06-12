import type { Request } from 'express';
import { logAudit } from '../../../utils/audit';

type AuditEntry = Parameters<typeof logAudit>[1];

export const AuditLogService = {
  record(req: Request, entry: AuditEntry) {
    return logAudit(req, entry);
  },
};
