import type { Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword, verifyPassword } from '../utils/password';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  schoolId: z.string().uuid().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8),
});

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

export type AuthTokenPayload = {
  sub: string;
  schoolId: string | null;
  role: string | null;
  email?: string | null;
  subscriptionRestricted?: boolean;
  typ: 'access' | 'refresh';
};

const signToken = (payload: AuthTokenPayload, expiresIn: string) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn });

const getSchoolAccessState = async (schoolId: string): Promise<'ACTIVE' | 'PAYMENT_RESTRICTED' | 'SUSPENDED'> => {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, status: true, statusReason: true },
  });
  if (!school) {
    throw new HttpError(403, 'School is suspended');
  }
  if (school.status === 'ACTIVE') return 'ACTIVE';

  const reason = (school.statusReason ?? '').toLowerCase();
  if (reason.includes('payment') || reason.includes('subscription') || reason.includes('overdue')) {
    return 'PAYMENT_RESTRICTED';
  }

  return 'SUSPENDED';
};

const ensureTeacherActive = async (userId: string, schoolId: string | null) => {
  const profile = await prisma.teacherProfile.findFirst({
    where: { userId, ...(schoolId ? { schoolId } : {}) },
    select: { isActive: true },
  });
  if (!profile || !profile.isActive) {
    throw new HttpError(403, 'Teacher is inactive');
  }
};

const ensureParentActive = async (userId: string) => {
  const parents = await prisma.parentProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  if (!parents.length) {
    throw new HttpError(403, 'Parent is inactive');
  }
  const parentIds = parents.map((p) => p.id);
  const links = await prisma.studentParent.findMany({
    where: { parentId: { in: parentIds } },
    select: { student: { select: { school: { select: { id: true, status: true } } } } },
  });
  const hasActiveSchool = links.some((link) => link.student.school?.status === 'ACTIVE');
  if (!hasActiveSchool) {
    throw new HttpError(403, 'Parent is inactive');
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password, schoolId } = loginSchema.parse(req.body);
  const invalidCredentialsError = new HttpError(401, 'Invalid credentials');

  const user = await prisma.user.findFirst({
    where: {
      email,
      schoolId: schoolId ?? null,
    },
  });

  if (!user) {
    throw invalidCredentialsError;
  }

  if (user.status !== 'ACTIVE') {
    throw invalidCredentialsError;
  }

  const schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  if (schoolAccessState === 'SUSPENDED') throw invalidCredentialsError;

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw invalidCredentialsError;
  }

  const roleRow = await prisma.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });

  const payloadBase = {
    sub: user.id,
    schoolId: user.schoolId ?? null,
    role: roleRow?.role.name ?? null,
    email: user.email,
    subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
  };

  if (payloadBase.role === 'TEACHER') {
    await ensureTeacherActive(user.id, user.schoolId ?? null);
  }
  if (payloadBase.role === 'PARENT') {
    await ensureParentActive(user.id);
  }

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshToken = signToken({ ...payloadBase, typ: 'refresh' }, REFRESH_TOKEN_TTL);

  res.status(200).json({
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
    mustChangePassword: user.mustChangePassword,
    subscriptionRestricted: payloadBase.subscriptionRestricted,
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: token } = refreshSchema.parse(req.body ?? {});
  if (!token) {
    throw new HttpError(401, 'Missing refresh token');
  }

  let decoded: JwtPayload | AuthTokenPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload | AuthTokenPayload;
  } catch {
    throw new HttpError(401, 'Invalid refresh token');
  }

  if (typeof decoded === 'string' || decoded.typ !== 'refresh' || !decoded.sub) {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { id: true, schoolId: true, status: true, email: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Invalid refresh token');
  }

  const schoolAccessState = user.schoolId ? await getSchoolAccessState(user.schoolId) : 'ACTIVE';
  if (schoolAccessState === 'SUSPENDED') throw new HttpError(403, 'School is suspended');

  const roleRow = await prisma.userRole.findFirst({
    where: { userId: user.id },
    select: { role: { select: { name: true } } },
  });

  const roleName = roleRow?.role.name ?? null;
  if (roleName === 'TEACHER') {
    await ensureTeacherActive(user.id, user.schoolId ?? null);
  }
  if (roleName === 'PARENT') {
    await ensureParentActive(user.id);
  }

  const accessToken = signToken(
    {
      sub: user.id,
      schoolId: user.schoolId ?? null,
      role: roleName,
      email: user.email,
      subscriptionRestricted: schoolAccessState === 'PAYMENT_RESTRICTED',
      typ: 'access',
    },
    ACCESS_TOKEN_TTL,
  );

  res.status(200).json({
    accessToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

export const logout = async (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
};

export const changePassword = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, passwordHash: true, status: true, mustChangePassword: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new HttpError(401, 'Unauthorized');
  }

  if (!user.mustChangePassword) {
    if (!currentPassword) {
      throw new HttpError(400, 'Current password is required');
    }
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new HttpError(401, 'Invalid credentials');
    }
  }

  const nextHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: nextHash, mustChangePassword: false },
  });

  res.status(200).json({ success: true });
};
