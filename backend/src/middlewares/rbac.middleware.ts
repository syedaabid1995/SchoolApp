import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from './error.middleware';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const requireAuth = (req: Request) => {
  if (!req.auth) {
    throw new HttpError(401, 'Unauthorized');
  }
  return req.auth;
};

export const requireRole = (...roles: string[]) => {
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

export const requirePermission = (...permissions: string[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = requireAuth(req);

      const userRoles = await prisma.userRole.findMany({
        where: { userId: auth.userId },
        select: { roleId: true, role: { select: { name: true } } },
      });

      const hasSuperAdmin = userRoles.some((entry) => entry.role.name === SUPER_ADMIN_ROLE);
      if (hasSuperAdmin) {
        return next();
      }

      const roleIds = userRoles.map((entry) => entry.roleId);
      if (roleIds.length === 0) {
        return next(new HttpError(403, 'Forbidden'));
      }

      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId: { in: roleIds } },
        select: { permission: { select: { code: true } } },
      });

      const permissionCodes = new Set(rolePermissions.map((entry) => entry.permission.code));
      const isAllowed = permissions.some((permission) => permissionCodes.has(permission));

      if (!isAllowed) {
        return next(new HttpError(403, 'Forbidden'));
      }

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
