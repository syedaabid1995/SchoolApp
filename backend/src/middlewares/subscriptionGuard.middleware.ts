import type { NextFunction, Request, Response } from 'express';
import { enforceLimits } from '../services/subscription.service';
import { resolveSchoolId } from '../utils/tenant';

export const subscriptionGuard = (type: 'students' | 'teachers') => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const schoolId = resolveSchoolId(req, req.body?.schoolId ?? (req.query.schoolId as string | undefined));
      await enforceLimits(schoolId, type);
      next();
    } catch (err) {
      next(err);
    }
  };
};
