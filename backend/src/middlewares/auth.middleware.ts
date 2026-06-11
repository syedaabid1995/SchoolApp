import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './error.middleware';
import { prisma } from '../config/db';
import { getEffectivePermissionCodesForUser } from '../utils/employeePermissions';

type PermissionRequirement = string | string[];

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

  if (schoolId && role && ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF', 'PARENT', 'STUDENT'].includes(role)) {
    const permissionRequirement = resolvePermissionForPath(req.originalUrl, req.method);
    if (permissionRequirement) {
      const permissionCodes = await getEffectivePermissionCodesForUser(schoolId, decoded.sub, role);
      if (!hasPermissionRequirement(permissionCodes, permissionRequirement)) {
        next(new HttpError(403, 'Access blocked by plan permissions'));
        return;
      }
    }
  }

  next();
};

const hasPermissionRequirement = (permissionCodes: string[], requirement: PermissionRequirement) => {
  if (Array.isArray(requirement)) return requirement.some((code) => permissionCodes.includes(code));
  return permissionCodes.includes(requirement);
};

const studentLookupPermissions = [
  'students.list',
  'student.view',
  'attendance.view',
  'attendance.create',
  'attendance.report',
  'dormitory.view',
  'transport.view',
  'library.view',
  'homework.view',
  'fees.assignments.view',
  'fees.collection.view',
  'fees.invoice-generate.view',
  'fees.invoices.view',
  'exam.seating.view',
  'exam.hallticket.view',
  'academics.marks',
  'reports.view',
  'reports.students.view',
  'reports.attendance.view',
  'reports.transport.view',
  'reports.dormitory.view',
  'reports.fees.view',
];

const academicLookupPermissions = [
  'academics.setup',
  'student.view',
  'students.list',
  'students.add',
  'attendance.view',
  'attendance.create',
  'attendance.report',
  'staff.attendance.view',
  'staff.attendance.create',
  'dormitory.view',
  'transport.view',
  'library.view',
  'homework.view',
  'fees.assignments.view',
  'fees.invoice-generate.view',
  'fees.collection.view',
  'exam.center.view',
  'exam.room.view',
  'exam.seating.view',
  'exam.invigilator.view',
  'exam.hallticket.view',
  'academics.exams',
  'academics.marks',
  'reports.view',
  'reports.students.view',
  'reports.attendance.view',
  'reports.academics.view',
  'reports.exams.view',
  'reports.transport.view',
  'reports.dormitory.view',
  'reports.fees.view',
];

const teacherLookupPermissions = [
  'teachers.list',
  'staff.view',
  'staff.attendance.view',
  'staff.attendance.create',
  'academic.assign_subject.view',
  'academic.assign_subject.create',
  'academic.class_teacher.view',
  'academic.class_teacher.create',
  'academic.routine.view',
  'academic.routine.create',
  'exam.invigilator.view',
  'exam.invigilator.manage',
  'idcards.view',
  'reports.view',
  'reports.staff.view',
  'reports.academics.view',
  'reports.exams.view',
];

const staffLookupPermissions = [
  'staff.view',
  'teachers.list',
  'staff.attendance.view',
  'staff.attendance.create',
  'transport.view',
  'academic.assign_subject.view',
  'academic.assign_subject.create',
  'academic.class_teacher.view',
  'academic.class_teacher.create',
  'academic.routine.view',
  'academic.routine.create',
  'exam.invigilator.view',
  'exam.invigilator.manage',
  'idcards.view',
  'payroll.view',
  'payroll.generate',
  'reports.view',
  'reports.staff.view',
  'reports.payroll.view',
  'reports.transport.view',
];

export const resolvePermissionForPath = (path: string, method = 'GET') => {
  const pathOnly = path.split('?')[0] ?? path;
  const verb = method.toUpperCase();

  if (pathOnly.startsWith('/api/v1/students/attendance/report')) return 'attendance.report';
  if (pathOnly.startsWith('/api/v1/students/attendance')) return verb === 'POST' ? 'attendance.create' : 'attendance.view';

  if (pathOnly.startsWith('/api/v1/students/groups')) {
    if (verb === 'POST') return 'student.group.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'student.group.edit';
    if (verb === 'DELETE') return 'student.group.delete';
    return 'student.group.view';
  }

  if (pathOnly.startsWith('/api/v1/students/categories')) {
    if (verb === 'POST') return 'student.category.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'student.category.edit';
    if (verb === 'DELETE') return 'student.category.delete';
    return 'student.category.view';
  }

  if (pathOnly.startsWith('/api/v1/students/promotions')) {
    return verb === 'POST' ? 'student.promote.create' : 'student.promote.view';
  }

  if (/^\/api\/v1\/students\/students\/[^/]+\/disable$/.test(pathOnly)) return 'student.disabled.edit';
  if (/^\/api\/v1\/students\/disabled\/[^/]+\/restore$/.test(pathOnly)) return 'student.disabled.restore';
  if (pathOnly.startsWith('/api/v1/students/disabled')) return verb === 'DELETE' ? 'student.disabled.delete' : 'student.disabled.view';

  if (pathOnly.startsWith('/api/v1/students/students/import')) return 'student.import';
  if (/^\/api\/v1\/students\/students\/[^/]+\/documents/.test(pathOnly)) {
    if (verb === 'POST') return 'student.document.create';
    if (verb === 'DELETE') return 'student.document.delete';
    return 'student.document.view';
  }
  if (/^\/api\/v1\/students\/students\/[^/]+\/timeline/.test(pathOnly)) {
    if (verb === 'POST') return 'student.timeline.create';
    if (verb === 'DELETE') return 'student.timeline.delete';
    return 'student.timeline.view';
  }
  if (pathOnly.startsWith('/api/v1/students/students')) {
    if (verb === 'POST') return 'student.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'student.edit';
    if (verb === 'DELETE') return 'student.delete';
    return studentLookupPermissions;
  }
  if (pathOnly.startsWith('/api/v1/imports')) return 'student.import';

  if (pathOnly.startsWith('/api/v1/staff/attendance/report')) return 'staff.attendance.report';
  if (pathOnly.startsWith('/api/v1/staff/attendance')) return verb === 'POST' ? 'staff.attendance.create' : 'staff.attendance.view';
  if (pathOnly.startsWith('/api/v1/staff/payroll/report')) return 'payroll.report';
  if (/^\/api\/v1\/staff\/payroll\/[^/]+\/pay$/.test(pathOnly)) return 'payroll.pay';
  if (pathOnly.startsWith('/api/v1/staff/payroll/generate')) return 'payroll.generate';
  if (pathOnly.startsWith('/api/v1/staff/payroll')) return 'payroll.view';
  if (/^\/api\/v1\/staff\/[^/]+\/documents/.test(pathOnly)) {
    if (verb === 'POST') return 'staff.document.create';
    if (verb === 'DELETE') return 'staff.document.delete';
    return 'staff.document.view';
  }
  if (/^\/api\/v1\/staff\/[^/]+\/timeline/.test(pathOnly)) {
    if (verb === 'POST') return 'staff.timeline.create';
    if (verb === 'DELETE') return 'staff.timeline.delete';
    return 'staff.timeline.view';
  }
  if (pathOnly.startsWith('/api/v1/staff')) {
    if (verb === 'POST') return 'staff.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'staff.edit';
    if (verb === 'DELETE') return 'staff.delete';
    return staffLookupPermissions;
  }

  if (pathOnly.startsWith('/api/v1/fees')) {
    if (pathOnly.startsWith('/api/v1/fees/metadata')) return 'fees.overview.view';
    if (pathOnly.startsWith('/api/v1/fees/particulars')) {
      if (verb === 'POST') return 'fees.particulars.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.particulars.update';
      if (verb === 'DELETE') return 'fees.particulars.delete';
      return 'fees.particulars.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/types')) {
      if (verb === 'POST') return 'fees.types.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.types.update';
      if (verb === 'DELETE') return 'fees.types.delete';
      return 'fees.types.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/structures')) {
      if (verb === 'POST') return 'fees.structures.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.structures.update';
      if (verb === 'DELETE') return 'fees.structures.delete';
      return 'fees.structures.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/assignments')) {
      if (verb === 'POST') return 'fees.assignments.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.assignments.update';
      if (verb === 'DELETE') return 'fees.assignments.delete';
      return 'fees.assignments.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/invoices/preview')) return 'fees.invoice-generate.view';
    if (pathOnly.startsWith('/api/v1/fees/invoices/generate')) return verb === 'POST' ? 'fees.invoice-generate.create' : 'fees.invoice-generate.view';
    if (pathOnly.startsWith('/api/v1/fees/invoices')) {
      if (verb === 'DELETE' || verb === 'PATCH' || verb === 'PUT') return 'fees.invoices.cancel';
      return 'fees.invoices.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/payments')) return verb === 'POST' ? 'fees.collection.create' : 'fees.collection.view';
    if (pathOnly.startsWith('/api/v1/fees/collection')) {
      if (pathOnly.includes('/receipt') || pathOnly.includes('/print')) return 'fees.receipts.print';
      return verb === 'POST' ? 'fees.collection.create' : 'fees.collection.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/ledger')) {
      if (pathOnly.includes('/export') || pathOnly.endsWith('.pdf') || pathOnly.endsWith('.xlsx')) return 'fees.ledger.export';
      return 'fees.ledger.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/discounts')) {
      if (/\/(approve|reject|activate|deactivate)$/.test(pathOnly) && ['POST', 'PATCH', 'PUT'].includes(verb)) return 'fees.discounts.approve';
      if (verb === 'POST') return 'fees.discounts.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.discounts.update';
      if (verb === 'DELETE') return 'fees.discounts.delete';
      return 'fees.discounts.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/fines')) {
      if (verb === 'POST') return 'fees.fines.create';
      if (verb === 'PATCH' || verb === 'PUT') return 'fees.fines.update';
      if (verb === 'DELETE') return 'fees.fines.delete';
      return 'fees.fines.view';
    }
    if (pathOnly.startsWith('/api/v1/fees/reports')) {
      if (pathOnly.includes('/export') || pathOnly.endsWith('.csv') || pathOnly.endsWith('.pdf') || pathOnly.endsWith('.xlsx')) return 'fees.reports.export';
      return 'fees.reports.view';
    }
    return 'fees.overview.view';
  }
  if (pathOnly.startsWith('/api/v1/leave/types')) {
    if (verb === 'POST') return 'leave.type.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'leave.type.edit';
    if (verb === 'DELETE') return 'leave.type.delete';
    return 'leave.type.view';
  }
  if (pathOnly.startsWith('/api/v1/leave/defines')) {
    if (verb === 'POST') return 'leave.define.create';
    if (verb === 'PATCH' || verb === 'PUT') return 'leave.define.edit';
    if (verb === 'DELETE') return 'leave.define.delete';
    return 'leave.define.view';
  }
  if (pathOnly.startsWith('/api/v1/leave/balances')) return 'leave.balance.view';
  if (/^\/api\/v1\/leave\/(applications|requests)\/[^/]+\/(status|approve|reject)$/.test(pathOnly)) return 'leave.approve.edit';
  if (/^\/api\/v1\/leave\/(applications|requests)/.test(pathOnly)) {
    const isMineRequest = /[?&]mine=true(?:&|$)/.test(path);
    if (verb === 'POST') return 'leave.apply.create';
    if (verb === 'GET') return isMineRequest ? 'leave.apply.view' : 'leave.approve.view';
    if (verb === 'PATCH' || verb === 'PUT') return isMineRequest ? 'leave.apply.edit' : 'leave.approve.edit';
    if (verb === 'DELETE') return isMineRequest ? 'leave.apply.delete' : 'leave.approve.delete';
    return isMineRequest ? 'leave.apply.view' : 'leave.approve.view';
  }

  if (pathOnly.startsWith('/api/v1/exams/centers')) {
    return verb === 'GET' ? 'exam.center.view' : 'exam.center.manage';
  }
  if (pathOnly.startsWith('/api/v1/exams/rooms')) {
    return verb === 'GET' ? 'exam.room.view' : 'exam.room.manage';
  }
  if (/^\/api\/v1\/exams\/[^/]+\/seating/.test(pathOnly)) {
    return verb === 'GET' ? 'exam.seating.view' : 'exam.seating.manage';
  }
  if (/^\/api\/v1\/exams\/[^/]+\/invigilators/.test(pathOnly)) {
    return verb === 'GET' ? 'exam.invigilator.view' : 'exam.invigilator.manage';
  }
  if (/^\/api\/v1\/exams\/[^/]+\/hall-tickets/.test(pathOnly)) {
    return pathOnly.endsWith('/pdf') ? 'exam.hallticket.export' : 'exam.hallticket.view';
  }
  if (pathOnly.startsWith('/api/v1/reports')) {
    if (pathOnly.endsWith('/export.csv') || pathOnly.endsWith('/export.pdf') || ['/api/v1/reports/term', '/api/v1/reports/annual', '/api/v1/reports/rank'].includes(pathOnly)) {
      return 'reports.export';
    }
    return 'reports.view';
  }
  if (pathOnly.startsWith('/api/v1/admin/compliance') || pathOnly.startsWith('/api/v1/compliance')) {
    if (/\/(approve|reject|execute)$/.test(pathOnly)) return 'compliance.review';
    return 'compliance.view';
  }

  const targets: Array<{ prefix: string; code: PermissionRequirement }> = [
    { prefix: '/api/v1/ai-assistant', code: 'ai.assistant.use' },
    { prefix: '/api/v1/schools', code: verb === 'GET' ? 'school.onboarding.view' : 'school.onboarding.manage' },
    { prefix: '/api/v1/teachers/onboarding', code: verb === 'GET' ? 'teacher.onboarding.view' : 'teacher.onboarding.manage' },
    { prefix: '/api/v1/teachers/', code: pathOnly.includes('/credentials/') ? 'teacher.credentials.manage' : pathOnly.includes('/onboarding') ? (verb === 'GET' ? 'teacher.onboarding.view' : 'teacher.onboarding.manage') : verb === 'POST' ? 'teachers.add' : teacherLookupPermissions },
    { prefix: '/api/v1/academics/timetable/teacher', code: 'attendance.view' },
    { prefix: '/api/v1/teachers', code: verb === 'POST' ? 'teachers.add' : teacherLookupPermissions },
    { prefix: '/api/v1/teacher-assignments', code: teacherLookupPermissions },
    { prefix: '/api/v1/academic-setup', code: verb === 'GET' ? academicLookupPermissions : 'academics.setup' },
    { prefix: '/api/v1/dormitories', code: 'dormitory.view' },
    { prefix: '/api/v1/transport', code: 'transport.view' },
    { prefix: '/api/v1/homework', code: 'homework.view' },
    { prefix: '/api/v1/library', code: 'library.view' },
    { prefix: '/api/v1/students', code: 'students.list' },
    { prefix: '/api/v1/attendance', code: 'attendance.view' },
    { prefix: '/api/v1/attendance-summary', code: 'attendance.view' },
    { prefix: '/api/v1/attendance-approval', code: 'attendance.view' },
    { prefix: '/api/v1/leave', code: 'leave.apply.view' },
    { prefix: '/api/v1/academics', code: verb === 'GET' ? academicLookupPermissions : 'academics.setup' },
    { prefix: '/api/v1/exams', code: 'academics.exams' },
    { prefix: '/api/v1/users/school-users', code: 'settings.access' },
    { prefix: '/api/v1/users/employee-permissions', code: 'settings.access' },
    { prefix: '/api/v1/audit-logs', code: 'audit.view' },
    { prefix: '/api/v1/tickets', code: 'support.view' },
    { prefix: '/api/v1/subscriptions', code: 'plans.view' },
  ];

  const match = targets.find((entry) => path.startsWith(entry.prefix));
  return match?.code ?? null;
};
