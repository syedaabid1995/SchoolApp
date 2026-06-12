import type { NextFunction, Request, Response } from 'express';
import type { RoleName } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from './error.middleware';
import { AuthorizationService } from '../services/authorization.service';

const SUPER_ADMIN_ROLE: RoleName = 'SUPER_ADMIN';
const SCHOOL_ADMIN_ROLE: RoleName = 'SCHOOL_ADMIN';

export const requireAuth = (req: Request) => {
  if (!req.auth) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.auth;
};

export const requireRole = (...roles: RoleName[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      const userRoles = await prisma.userRole.findMany({
        where: { userId: auth.userId },
        select: { role: { select: { name: true } } },
      });

      const roleNames = userRoles.map((entry) => entry.role.name);
      if (roleNames.includes(SUPER_ADMIN_ROLE)) {
        return next();
      }

      const isAllowed = roles.some((role) => roleNames.includes(role));
      if (!isAllowed) {
        return next(new HttpError(403, 'Forbidden'));
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};

export const requireSuperAdmin = requireRole(SUPER_ADMIN_ROLE);

export const requireSchoolAdminOrSuperAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = requireAuth(req);
    const userRoles = await prisma.userRole.findMany({
      where: { userId: auth.userId },
      select: { role: { select: { name: true } } },
    });

    const roleNames = userRoles.map((entry) => entry.role.name);
    if (roleNames.includes(SUPER_ADMIN_ROLE)) {
      return next();
    }

    if (roleNames.includes(SCHOOL_ADMIN_ROLE) && auth.schoolId) {
      return next();
    }

    return next(new HttpError(403, 'Forbidden'));
  } catch (err) {
    return next(err);
  }
};

export const blockSuperAdminSchoolOperations = (
  message = 'Super Admin cannot manage school daily operations',
) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (isMutation && req.auth?.role === SUPER_ADMIN_ROLE) {
      return next(new HttpError(403, message));
    }

    return next();
  };
};

export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);
      await AuthorizationService.assertPermission(auth, permissions);
      return next();
    } catch (err) {
      return next(err);
    }
  };
};

export const enforceTenantScope = (req: Request, schoolId: string | null) => {
  const auth = requireAuth(req);
  if (!auth.schoolId) {
    return;
  }

  if (auth.schoolId !== schoolId) {
    throw new HttpError(403, 'Tenant scope violation');
  }
};
