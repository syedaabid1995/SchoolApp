import type { Request } from 'express';
import { HttpError } from '../middlewares/error.middleware';

export const resolveSchoolId = (req: Request, requested?: string | null) => {
  if (req.auth?.schoolId) {
    if (requested && requested !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return req.auth.schoolId;
  }

  if (!requested) {
    throw new HttpError(400, 'schoolId is required');
  }

  return requested;
};
