import type { NextFunction, Request, Response } from 'express';
import {
  assertModuleFeatureEnabled,
  type ModuleFeatureKey,
} from '../services/feature-flag.service';

export const requireModuleFeatureEnabled = (
  key: ModuleFeatureKey,
  message?: string,
) => async (req: Request, _res: Response, next: NextFunction) => {
  try {
    await assertModuleFeatureEnabled({
      key,
      schoolId: req.auth?.schoolId ?? null,
      userId: req.auth?.userId ?? null,
      message,
    });
    next();
  } catch (error) {
    next(error);
  }
};
