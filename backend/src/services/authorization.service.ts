import type { RoleName } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import {
  resolveEffectivePermissionCodesForRole,
  resolveEffectivePermissionCodesForUser,
  resolvePlanPermissionCodesForSchool,
} from '../utils/employeePermissions';
import { PermissionCacheService } from './permissionCache.service';

const SUPER_ADMIN_ROLE: RoleName = 'SUPER_ADMIN';

export type AuthorizationContext = {
  userId: string;
  schoolId: string | null;
  role?: string | null;
};

export type PermissionRequirement = string | string[];

const normalizeRequirement = (requirement: PermissionRequirement) =>
  Array.isArray(requirement) ? requirement : [requirement];

const hasAnyPermission = (permissionCodes: Iterable<string>, requirement: PermissionRequirement) => {
  const permissionSet = new Set(permissionCodes);
  return normalizeRequirement(requirement).some((permission) => permissionSet.has(permission));
};

const hasAllPermissions = (permissionCodes: Iterable<string>, requirement: PermissionRequirement) => {
  const permissionSet = new Set(permissionCodes);
  return normalizeRequirement(requirement).every((permission) => permissionSet.has(permission));
};

export const AuthorizationService = {
  async getUserRoleNames(userId: string) {
    const roles = await prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { name: true } } },
    });
    return roles.map((entry) => entry.role.name);
  },

  async isSuperAdmin(auth: AuthorizationContext) {
    if (auth.role === SUPER_ADMIN_ROLE) return true;
    const roleNames = await this.getUserRoleNames(auth.userId);
    return roleNames.includes(SUPER_ADMIN_ROLE);
  },

  async getPlanPermissionCodesForSchool(schoolId: string) {
    const cached = await PermissionCacheService.getPlanPermissions(schoolId);
    if (cached) {
      return cached.permissions;
    }

    const resolved = await resolvePlanPermissionCodesForSchool(schoolId);
    await PermissionCacheService.setPlanPermissions(schoolId, resolved.planId, resolved.permissionCodes);
    return resolved.permissionCodes;
  },

  async getEffectivePermissionCodesForRole(schoolId: string, roleName: string | null | undefined) {
    const cached = await PermissionCacheService.getRolePermissions(schoolId, roleName);
    if (cached) {
      return cached.permissions;
    }

    const resolved = await resolveEffectivePermissionCodesForRole(schoolId, roleName);
    await PermissionCacheService.setRolePermissions(schoolId, roleName, resolved.planId, resolved.permissionCodes);
    return resolved.permissionCodes;
  },

  async getEffectivePermissionCodesForUser(
    schoolId: string,
    userId: string,
    roleName: string | null | undefined,
  ) {
    const cached = await PermissionCacheService.getUserPermissions(schoolId, userId, roleName);
    if (cached) {
      return cached.permissions;
    }

    const resolved = await resolveEffectivePermissionCodesForUser(schoolId, userId, roleName);
    await PermissionCacheService.setUserPermissions(schoolId, userId, roleName, resolved.planId, resolved.permissionCodes);
    return resolved.permissionCodes;
  },

  hasAnyPermission,

  hasAllPermissions,

  async hasAnyEffectivePermission(auth: AuthorizationContext, requirement: PermissionRequirement) {
    if (!auth.schoolId) return false;
    const permissionCodes = await this.getEffectivePermissionCodesForUser(auth.schoolId, auth.userId, auth.role);
    return hasAnyPermission(permissionCodes, requirement);
  },

  async hasAllEffectivePermissions(auth: AuthorizationContext, requirement: PermissionRequirement) {
    if (!auth.schoolId) return false;
    const permissionCodes = await this.getEffectivePermissionCodesForUser(auth.schoolId, auth.userId, auth.role);
    return hasAllPermissions(permissionCodes, requirement);
  },

  async canAccessPermission(
    auth: AuthorizationContext,
    requirement: PermissionRequirement,
    options: { allowSuperAdmin?: boolean } = {},
  ) {
    if (options.allowSuperAdmin !== false && await this.isSuperAdmin(auth)) {
      return true;
    }
    return this.hasAnyEffectivePermission(auth, requirement);
  },

  async assertPermission(
    auth: AuthorizationContext,
    requirement: PermissionRequirement,
    options: { allowSuperAdmin?: boolean; message?: string } = {},
  ) {
    const isAllowed = await this.canAccessPermission(auth, requirement, options);
    if (!isAllowed) {
      throw new HttpError(403, options.message ?? 'Forbidden');
    }
  },
};
