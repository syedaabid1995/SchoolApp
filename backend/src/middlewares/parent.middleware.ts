import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from './error.middleware';
import { requireAuth } from './rbac.middleware';

export const requireParentProfile = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = requireAuth(req);
    const profile = await prisma.parentProfile.findFirst({
      where: { userId: auth.userId },
      select: { id: true },
    });
    if (!profile) {
      return next(new HttpError(403, 'Forbidden'));
    }
    return next();
  } catch (err) {
    return next(err);
  }
};
