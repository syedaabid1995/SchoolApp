import type { Prisma, RoleName, UserStatus } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { createAuditLog } from './auditLog.service';

type SortBy = 'name' | 'email' | 'role' | 'schoolName' | 'status' | 'lastLoginAt' | 'createdAt';
type SortOrder = 'asc' | 'desc';

export type AdminUserListParams = {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: UserStatus;
  schoolId?: string;
  mfaEnabled?: boolean;
  locked?: boolean;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
};

export type AdminUserActor = {
  userId: string;
  role?: string | null;
};

export type AdminUserActionPayload = {
  id: string;
  reason?: string | null;
  actor: AdminUserActor;
};

const safeUserSelect = {
  id: true,
  schoolId: true,
  email: true,
  mustChangePassword: true,
  mfaEnabled: true,
  mfaMethod: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  school: { select: { id: true, name: true, code: true } },
  roles: { select: { role: { select: { name: true } } } },
  teacherProfile: { select: { firstName: true, lastName: true, phone: true } },
  parentProfiles: { select: { firstName: true, lastName: true, phone: true, email: true }, take: 1 },
} satisfies Prisma.UserSelect;

type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

const pickRole = (user: Pick<SafeUserRecord, 'roles'>) => user.roles[0]?.role.name ?? null;

const displayNameForUser = (user: SafeUserRecord) => {
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : '';
  const parent = user.parentProfiles[0];
  const parentName = parent ? `${parent.firstName} ${parent.lastName}`.trim() : '';
  return teacherName || parentName || user.email;
};

const phoneForUser = (user: SafeUserRecord) =>
  user.teacherProfile?.phone ?? user.parentProfiles[0]?.phone ?? null;

const profileForUser = (user: SafeUserRecord) => {
  const role = pickRole(user);
  if (user.teacherProfile) {
    return { type: 'teacher', displayName: displayNameForUser(user) };
  }
  if (user.parentProfiles.length > 0) {
    return { type: 'parent', displayName: displayNameForUser(user) };
  }
  if (role === 'SUPER_ADMIN' || role === 'SCHOOL_ADMIN') {
    return { type: 'admin', displayName: displayNameForUser(user) };
  }
  return { type: 'user', displayName: displayNameForUser(user) };
};

const mapAdminUser = (user: SafeUserRecord) => {
  const role = pickRole(user);
  return {
    id: user.id,
    name: displayNameForUser(user),
    email: user.email,
    phone: phoneForUser(user),
    role,
    status: user.status,
    schoolId: user.schoolId,
    schoolName: user.school?.name ?? null,
    school: user.school,
    isActive: user.status === 'ACTIVE',
    isLocked: user.status === 'SUSPENDED',
    mustChangePassword: user.mustChangePassword,
    mfaEnabled: user.mfaEnabled,
    mfaMethod: user.mfaMethod,
    lastLoginAt: null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: profileForUser(user),
  };
};

const toRoleName = (value?: string): RoleName | undefined => {
  const roles: RoleName[] = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF', 'PARENT'];
  return roles.includes(value as RoleName) ? (value as RoleName) : undefined;
};

const buildUserWhere = (params: AdminUserListParams): Prisma.UserWhereInput => {
  const where: Prisma.UserWhereInput = {};
  const search = params.search?.trim();

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { school: { is: { name: { contains: search, mode: 'insensitive' } } } },
      { school: { is: { code: { contains: search, mode: 'insensitive' } } } },
      { teacherProfile: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
      { teacherProfile: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
      { teacherProfile: { is: { phone: { contains: search, mode: 'insensitive' } } } },
      { parentProfiles: { some: { firstName: { contains: search, mode: 'insensitive' } } } },
      { parentProfiles: { some: { lastName: { contains: search, mode: 'insensitive' } } } },
      { parentProfiles: { some: { phone: { contains: search, mode: 'insensitive' } } } },
      { parentProfiles: { some: { email: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const roleName = toRoleName(params.role);
  if (roleName) {
    where.roles = { some: { role: { name: roleName } } };
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.schoolId) {
    where.schoolId = params.schoolId;
  }

  if (typeof params.mfaEnabled === 'boolean') {
    where.mfaEnabled = params.mfaEnabled;
  }

  if (typeof params.locked === 'boolean') {
    where.status = params.locked ? 'SUSPENDED' : { not: 'SUSPENDED' };
  }

  return where;
};

const orderByFor = (sortBy?: SortBy, sortOrder: SortOrder = 'desc'): Prisma.UserOrderByWithRelationInput => {
  if (sortBy === 'email') return { email: sortOrder };
  if (sortBy === 'status') return { status: sortOrder };
  return { createdAt: sortOrder };
};

export const getAdminUsersSummary = async () => {
  const [
    total,
    superAdmins,
    schoolAdmins,
    teachers,
    parents,
    lockedUsers,
    mfaEnabledAdmins,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { roles: { some: { role: { name: 'SUPER_ADMIN' } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { name: 'SCHOOL_ADMIN' } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { name: 'TEACHER' } } } } }),
    prisma.user.count({ where: { roles: { some: { role: { name: 'PARENT' } } } } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({
      where: {
        mfaEnabled: true,
        roles: { some: { role: { name: { in: ['SUPER_ADMIN', 'SCHOOL_ADMIN'] } } } },
      },
    }),
  ]);

  return {
    total,
    superAdmins,
    schoolAdmins,
    teachers,
    parents,
    students: 0,
    lockedUsers,
    mfaEnabledAdmins,
  };
};

export const listAdminUsers = async (params: AdminUserListParams) => {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100);
  const skip = (page - 1) * limit;
  const where = buildUserWhere(params);

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: orderByFor(params.sortBy, params.sortOrder ?? 'desc'),
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items: items.map(mapAdminUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getAdminUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  return mapAdminUser(user);
};

const activeSuperAdminCount = () =>
  prisma.user.count({
    where: {
      status: 'ACTIVE',
      roles: { some: { role: { name: 'SUPER_ADMIN' } } },
    },
  });

const assertCanChangeCriticalSuperAdmin = async (target: SafeUserRecord, nextStatus?: UserStatus) => {
  const isTargetSuperAdmin = target.roles.some((entry) => entry.role.name === 'SUPER_ADMIN');
  if (!isTargetSuperAdmin || nextStatus === 'ACTIVE') return;
  if (target.status !== 'ACTIVE') return;

  const count = await activeSuperAdminCount();
  if (count <= 1) {
    throw new HttpError(409, 'Cannot deactivate the last active Super Admin');
  }
};

const auditAdminUserAction = async (params: {
  actor: AdminUserActor;
  target: SafeUserRecord;
  action: string;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
}) => {
  await createAuditLog({
    schoolId: params.target.schoolId,
    actorId: params.actor.userId,
    actorRole: params.actor.role ?? 'SUPER_ADMIN',
    entityType: 'USER',
    entityId: params.target.id,
    action: params.action,
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
  });
};

const getSafeTarget = async (id: string) => {
  const target = await prisma.user.findUnique({
    where: { id },
    select: safeUserSelect,
  });
  if (!target) {
    throw new HttpError(404, 'User not found');
  }
  return target;
};

export const revokeAdminUserSessions = async ({ id, reason, actor }: AdminUserActionPayload) => {
  const target = await getSafeTarget(id);
  const result = await prisma.refreshSession.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditAdminUserAction({
    actor,
    target,
    action: 'ADMIN_USER_SESSIONS_REVOKED',
    afterState: {
      targetUserId: id,
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      revokedSessions: result.count,
      reason: reason ?? null,
    },
  });

  return { revokedSessions: result.count };
};

export const updateAdminUserStatus = async (params: AdminUserActionPayload & { status: UserStatus }) => {
  const target = await getSafeTarget(params.id);
  await assertCanChangeCriticalSuperAdmin(target, params.status);

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { status: params.status },
    select: safeUserSelect,
  });

  let revokedSessions = 0;
  if (params.status !== 'ACTIVE') {
    const result = await prisma.refreshSession.updateMany({
      where: { userId: params.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    revokedSessions = result.count;
  }

  await auditAdminUserAction({
    actor: params.actor,
    target,
    action: 'ADMIN_USER_STATUS_CHANGED',
    beforeState: { oldStatus: target.status, targetUserRole: pickRole(target) },
    afterState: {
      newStatus: params.status,
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      revokedSessions,
      reason: params.reason ?? null,
    },
  });

  return mapAdminUser(updated);
};

export const lockAdminUser = async (params: AdminUserActionPayload) => {
  const target = await getSafeTarget(params.id);
  await assertCanChangeCriticalSuperAdmin(target, 'SUSPENDED');

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { status: 'SUSPENDED' },
    select: safeUserSelect,
  });

  const result = await prisma.refreshSession.updateMany({
    where: { userId: params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditAdminUserAction({
    actor: params.actor,
    target,
    action: 'ADMIN_USER_LOCKED',
    beforeState: { oldStatus: target.status, targetUserRole: pickRole(target) },
    afterState: {
      newStatus: 'SUSPENDED',
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      revokedSessions: result.count,
      reason: params.reason ?? null,
    },
  });

  return mapAdminUser(updated);
};

export const unlockAdminUser = async (params: AdminUserActionPayload) => {
  const target = await getSafeTarget(params.id);
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { status: 'ACTIVE' },
    select: safeUserSelect,
  });

  await auditAdminUserAction({
    actor: params.actor,
    target,
    action: 'ADMIN_USER_UNLOCKED',
    beforeState: { oldStatus: target.status, targetUserRole: pickRole(target) },
    afterState: {
      newStatus: 'ACTIVE',
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      reason: params.reason ?? null,
    },
  });

  return mapAdminUser(updated);
};

export const forceAdminPasswordReset = async (params: AdminUserActionPayload) => {
  const target = await getSafeTarget(params.id);
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { mustChangePassword: true },
    select: safeUserSelect,
  });
  const result = await prisma.refreshSession.updateMany({
    where: { userId: params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditAdminUserAction({
    actor: params.actor,
    target,
    action: 'ADMIN_USER_FORCE_PASSWORD_RESET',
    afterState: {
      targetUserId: params.id,
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      revokedSessions: result.count,
      reason: params.reason ?? null,
    },
  });

  return mapAdminUser(updated);
};

export const disableAdminUserMfa = async (params: AdminUserActionPayload) => {
  const target = await getSafeTarget(params.id);
  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { mfaEnabled: false, mfaMethod: null },
    select: safeUserSelect,
  });
  const result = await prisma.refreshSession.updateMany({
    where: { userId: params.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await auditAdminUserAction({
    actor: params.actor,
    target,
    action: 'ADMIN_USER_MFA_DISABLED',
    beforeState: { mfaEnabled: target.mfaEnabled, mfaMethod: target.mfaMethod, targetUserRole: pickRole(target) },
    afterState: {
      mfaEnabled: false,
      mfaMethod: null,
      targetUserRole: pickRole(target),
      targetSchoolId: target.schoolId,
      revokedSessions: result.count,
      reason: params.reason ?? null,
    },
  });

  return mapAdminUser(updated);
};

const maskIpAddress = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
  if (value.includes(':')) return `${value.split(':').slice(0, 3).join(':')}::`;
  return 'masked';
};

export const getAdminUserSessions = async (id: string) => {
  await getSafeTarget(id);
  const sessions = await prisma.refreshSession.findMany({
    where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      deviceName: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
  });

  return {
    items: sessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: maskIpAddress(session.ipAddress),
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt,
    })),
  };
};

export const getAdminUserActivity = async (id: string) => {
  await getSafeTarget(id);
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { actorId: id },
        { entityType: 'USER', entityId: id },
        { afterState: { path: ['targetUserId'], equals: id } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      schoolId: true,
      createdAt: true,
    },
  });

  return {
    items: logs.map((log) => ({
      id: log.id,
      event: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      schoolId: log.schoolId,
      schoolName: null,
      createdAt: log.createdAt,
      metadata: {
        entityType: log.entityType,
        entityId: log.entityId,
      },
    })),
  };
};
