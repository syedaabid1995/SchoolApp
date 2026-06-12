import type { Request } from 'express';
import { logAudit } from '../../../utils/audit';

type FeeAuditEntry = Parameters<typeof logAudit>[1];

export const FeeAuditService = {
  record(req: Request, entry: FeeAuditEntry) {
    return logAudit(req, entry);
  },
};
