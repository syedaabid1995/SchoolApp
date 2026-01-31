import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from './error.middleware';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const superAdminGuard = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new HttpError(401, 'Unauthorized');
    }

    const roles = await prisma.userRole.findMany({
      where: { userId: req.auth.userId },
      select: { role: { select: { name: true } } },
    });

    const isSuperAdmin = roles.some((entry) => entry.role.name === SUPER_ADMIN_ROLE);
    if (!isSuperAdmin) {
      throw new HttpError(403, 'Forbidden');
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
