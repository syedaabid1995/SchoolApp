import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './error.middleware';
import { prisma } from '../config/db';
import { getEffectivePermissionCodesForUser } from '../utils/employeePermissions';

export type AuthContext = {
  userId: string;
  schoolId: string | null;
  role?: string | null;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

const extractBearer = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

export const authMiddleware = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearer(req);
  if (!token) {
    next(new HttpError(401, 'Missing authorization token'));
    return;
  }

  let decoded:
    | JwtPayload
    | {
        sub?: string;
        schoolId?: string | null;
        typ?: string;
        role?: string | null;
        subscriptionRestricted?: boolean;
      };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload | {
      sub?: string;
      schoolId?: string | null;
      typ?: string;
      role?: string | null;
    };
  } catch {
    next(new HttpError(401, 'Invalid token'));
    return;
  }

  if (typeof decoded === 'string' || decoded.typ !== 'access' || !decoded.sub) {
    next(new HttpError(401, 'Invalid token'));
    return;
  }

  const schoolId = decoded.schoolId ?? null;

  if (schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { status: true, statusReason: true },
    });
    if (!school) {
      next(new HttpError(403, 'Account suspended'));
      return;
    }
    if (school.status !== 'ACTIVE') {
      const reason = (school.statusReason ?? '').toLowerCase();
      const isPaymentRestricted =
        reason.includes('payment') || reason.includes('subscription') || reason.includes('overdue');
      const isSubscriptionPath = req.originalUrl.startsWith('/api/v1/subscriptions');
      if (isPaymentRestricted && !isSubscriptionPath) {
        next(new HttpError(403, 'Payment overdue - access limited to plans page'));
        return;
      }
      if (!isPaymentRestricted) {
        next(new HttpError(403, 'Account suspended'));
        return;
      }
    }
  }

  const role = decoded.role ?? null;
  if (role === 'TEACHER') {
    const teacher = await prisma.teacherProfile.findFirst({
      where: { userId: decoded.sub, ...(schoolId ? { schoolId } : {}) },
      select: { isActive: true },
    });
    if (!teacher || !teacher.isActive) {
      next(new HttpError(403, 'Account suspended'));
      return;
    }
  }

  if (role === 'PARENT') {
    const parents = await prisma.parentProfile.findMany({
      where: { userId: decoded.sub },
      select: { id: true },
    });
    if (!parents.length) {
      next(new HttpError(403, 'Account suspended'));
      return;
    }
    const parentIds = parents.map((p) => p.id);
    const links = await prisma.studentParent.findMany({
      where: { parentId: { in: parentIds } },
      select: { student: { select: { school: { select: { status: true } } } } },
    });
    const hasActive = links.some((link) => link.student.school?.status === 'ACTIVE');
    if (!hasActive) {
      next(new HttpError(403, 'Account suspended'));
      return;
    }
  }

  req.auth = {
    userId: decoded.sub,
    schoolId,
    role,
  };

  if (schoolId && role && ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'].includes(role)) {
    const permissionCode = resolvePermissionForPath(req.originalUrl);
    if (permissionCode) {
      const permissionCodes = await getEffectivePermissionCodesForUser(schoolId, decoded.sub, role);
      if (!permissionCodes.includes(permissionCode)) {
        next(new HttpError(403, 'Access blocked by plan permissions'));
        return;
      }
    }
  }

  next();
};

const resolvePermissionForPath = (path: string) => {
  const targets: Array<{ prefix: string; code: string }> = [
    { prefix: '/api/v1/academics/timetable/teacher', code: 'attendance.view' },
    { prefix: '/api/v1/teachers', code: 'teachers.list' },
    { prefix: '/api/v1/teacher-assignments', code: 'teachers.list' },
    { prefix: '/api/v1/students', code: 'students.list' },
    { prefix: '/api/v1/attendance', code: 'attendance.view' },
    { prefix: '/api/v1/attendance-summary', code: 'attendance.view' },
    { prefix: '/api/v1/attendance-approval', code: 'attendance.view' },
    { prefix: '/api/v1/leave', code: 'attendance.view' },
    { prefix: '/api/v1/academics', code: 'academics.setup' },
    { prefix: '/api/v1/exams', code: 'academics.exams' },
    { prefix: '/api/v1/reports', code: 'academics.marks' },
    { prefix: '/api/v1/users/employee-permissions', code: 'settings.access' },
    { prefix: '/api/v1/audit-logs', code: 'audit.view' },
    { prefix: '/api/v1/tickets', code: 'support.view' },
    { prefix: '/api/v1/subscriptions', code: 'plans.view' },
  ];

  const match = targets.find((entry) => path.startsWith(entry.prefix));
  return match?.code ?? null;
};
