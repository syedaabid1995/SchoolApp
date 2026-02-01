import type { NextFunction, Request, Response } from 'express';
import { enforceLimits, checkSubscriptionStatus } from '../services/subscription.service';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from './error.middleware';

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

export const writeOperationGuard = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    // Auth runs inside route handlers; if not set yet, defer enforcement until after auth.
    if (!req.auth) {
      return next();
    }
    if (req.auth?.role === 'SUPER_ADMIN' && !req.auth.schoolId && !req.body?.schoolId && !req.query.schoolId) {
      return next();
    }
    const schoolId = resolveSchoolId(req, req.body?.schoolId ?? (req.query.schoolId as string | undefined));
    const status = await checkSubscriptionStatus(schoolId);
    
    if (status === 'SUSPENDED') {
      throw new HttpError(403, 'School suspended - payment required to restore access');
    }
    
    if (status === 'GRACE_PERIOD' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Allow only payment-related operations during grace period
      const allowedPaths = ['/subscriptions', '/payments'];
      if (!allowedPaths.some((path) => req.path.startsWith(path))) {
        throw new HttpError(403, 'Limited access - payment overdue. Please update your subscription.');
      }
    }
    
    next();
  } catch (err) {
    next(err);
  }
};
