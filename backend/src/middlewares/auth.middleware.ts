import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './error.middleware';
import { prisma } from '../config/db';
import { PermissionCodes as P, type PermissionCode } from '../permissions/permission-manifest';
import { AuthorizationService } from '../services/authorization.service';

type PermissionRequirement = PermissionCode | PermissionCode[];

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
      if (!await AuthorizationService.hasAnyEffectivePermission(req.auth, permissionRequirement)) {
        next(new HttpError(403, 'Access blocked by plan permissions'));
        return;
      }
    }
  }

  next();
};

const studentLookupPermissions = [
  P.studentsList,
  P.studentView,
  P.attendanceView,
  P.attendanceCreate,
  P.attendanceReport,
  P.dormitoryView,
  P.transportView,
  P.libraryView,
  P.homeworkView,
  P.feesAssignmentsView,
  P.feesCollectionView,
  P.feesInvoiceGenerateView,
  P.feesInvoicesView,
  P.examSeatingView,
  P.examHallticketView,
  P.academicsMarks,
  P.reportsView,
  P.reportsStudentsView,
  P.reportsAttendanceView,
  P.reportsTransportView,
  P.reportsDormitoryView,
  P.reportsFeesView,
];

const academicLookupPermissions = [
  P.academicsSetup,
  P.studentView,
  P.studentsList,
  P.studentsAdd,
  P.attendanceView,
  P.attendanceCreate,
  P.attendanceReport,
  P.staffAttendanceView,
  P.staffAttendanceCreate,
  P.dormitoryView,
  P.transportView,
  P.libraryView,
  P.homeworkView,
  P.feesAssignmentsView,
  P.feesInvoiceGenerateView,
  P.feesCollectionView,
  P.examCenterView,
  P.examRoomView,
  P.examSeatingView,
  P.examInvigilatorView,
  P.examHallticketView,
  P.academicsExams,
  P.academicsMarks,
  P.reportsView,
  P.reportsStudentsView,
  P.reportsAttendanceView,
  P.reportsAcademicsView,
  P.reportsExamsView,
  P.reportsTransportView,
  P.reportsDormitoryView,
  P.reportsFeesView,
];

const teacherLookupPermissions = [
  P.teachersList,
  P.staffView,
  P.staffAttendanceView,
  P.staffAttendanceCreate,
  P.academicAssignSubjectView,
  P.academicAssignSubjectCreate,
  P.academicClassTeacherView,
  P.academicClassTeacherCreate,
  P.academicRoutineView,
  P.academicRoutineCreate,
  P.examInvigilatorView,
  P.examInvigilatorManage,
  P.idcardsView,
  P.reportsView,
  P.reportsStaffView,
  P.reportsAcademicsView,
  P.reportsExamsView,
];

const staffLookupPermissions = [
  P.staffView,
  P.teachersList,
  P.staffAttendanceView,
  P.staffAttendanceCreate,
  P.transportView,
  P.academicAssignSubjectView,
  P.academicAssignSubjectCreate,
  P.academicClassTeacherView,
  P.academicClassTeacherCreate,
  P.academicRoutineView,
  P.academicRoutineCreate,
  P.examInvigilatorView,
  P.examInvigilatorManage,
  P.idcardsView,
  P.payrollView,
  P.payrollGenerate,
  P.reportsView,
  P.reportsStaffView,
  P.reportsPayrollView,
  P.reportsTransportView,
];

export const resolvePermissionForPath = (path: string, method = 'GET') => {
  const pathOnly = path.split('?')[0] ?? path;
  const verb = method.toUpperCase();

  if (pathOnly.startsWith('/api/v1/students/attendance/report')) return P.attendanceReport;
  if (pathOnly.startsWith('/api/v1/students/attendance')) return verb === 'POST' ? P.attendanceCreate : P.attendanceView;

  if (pathOnly.startsWith('/api/v1/students/groups')) {
    if (verb === 'POST') return P.studentGroupCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.studentGroupEdit;
    if (verb === 'DELETE') return P.studentGroupDelete;
    return P.studentGroupView;
  }

  if (pathOnly.startsWith('/api/v1/students/categories')) {
    if (verb === 'POST') return P.studentCategoryCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.studentCategoryEdit;
    if (verb === 'DELETE') return P.studentCategoryDelete;
    return P.studentCategoryView;
  }

  if (pathOnly.startsWith('/api/v1/students/promotions')) {
    return verb === 'POST' ? P.studentPromoteCreate : P.studentPromoteView;
  }

  if (/^\/api\/v1\/students\/students\/[^/]+\/disable$/.test(pathOnly)) return P.studentDisabledEdit;
  if (/^\/api\/v1\/students\/disabled\/[^/]+\/restore$/.test(pathOnly)) return P.studentDisabledRestore;
  if (pathOnly.startsWith('/api/v1/students/disabled')) return verb === 'DELETE' ? P.studentDisabledDelete : P.studentDisabledView;

  if (pathOnly.startsWith('/api/v1/students/students/import')) return P.studentImport;
  if (/^\/api\/v1\/students\/students\/[^/]+\/documents/.test(pathOnly)) {
    if (verb === 'POST') return P.studentDocumentCreate;
    if (verb === 'DELETE') return P.studentDocumentDelete;
    return P.studentDocumentView;
  }
  if (/^\/api\/v1\/students\/students\/[^/]+\/timeline/.test(pathOnly)) {
    if (verb === 'POST') return P.studentTimelineCreate;
    if (verb === 'DELETE') return P.studentTimelineDelete;
    return P.studentTimelineView;
  }
  if (pathOnly.startsWith('/api/v1/students/students')) {
    if (verb === 'POST') return P.studentCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.studentEdit;
    if (verb === 'DELETE') return P.studentDelete;
    return studentLookupPermissions;
  }
  if (pathOnly.startsWith('/api/v1/imports')) return P.studentImport;

  if (pathOnly.startsWith('/api/v1/staff/attendance/report')) return P.staffAttendanceReport;
  if (pathOnly.startsWith('/api/v1/staff/attendance')) return verb === 'POST' ? P.staffAttendanceCreate : P.staffAttendanceView;
  if (pathOnly.startsWith('/api/v1/staff/payroll/report')) return P.payrollReport;
  if (/^\/api\/v1\/staff\/payroll\/[^/]+\/pay$/.test(pathOnly)) return P.payrollPay;
  if (pathOnly.startsWith('/api/v1/staff/payroll/generate')) return P.payrollGenerate;
  if (pathOnly.startsWith('/api/v1/staff/payroll')) return P.payrollView;
  if (/^\/api\/v1\/staff\/[^/]+\/documents/.test(pathOnly)) {
    if (verb === 'POST') return P.staffDocumentCreate;
    if (verb === 'DELETE') return P.staffDocumentDelete;
    return P.staffDocumentView;
  }
  if (/^\/api\/v1\/staff\/[^/]+\/timeline/.test(pathOnly)) {
    if (verb === 'POST') return P.staffTimelineCreate;
    if (verb === 'DELETE') return P.staffTimelineDelete;
    return P.staffTimelineView;
  }
  if (pathOnly.startsWith('/api/v1/staff')) {
    if (verb === 'POST') return P.staffCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.staffEdit;
    if (verb === 'DELETE') return P.staffDelete;
    return staffLookupPermissions;
  }

  if (pathOnly.startsWith('/api/v1/fees')) {
    if (pathOnly.startsWith('/api/v1/fees/metadata')) return P.feesOverviewView;
    if (pathOnly.startsWith('/api/v1/fees/particulars')) {
      if (verb === 'POST') return P.feesParticularsCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesParticularsUpdate;
      if (verb === 'DELETE') return P.feesParticularsDelete;
      return P.feesParticularsView;
    }
    if (pathOnly.startsWith('/api/v1/fees/types')) {
      if (verb === 'POST') return P.feesTypesCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesTypesUpdate;
      if (verb === 'DELETE') return P.feesTypesDelete;
      return P.feesTypesView;
    }
    if (pathOnly.startsWith('/api/v1/fees/structures')) {
      if (verb === 'POST') return P.feesStructuresCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesStructuresUpdate;
      if (verb === 'DELETE') return P.feesStructuresDelete;
      return P.feesStructuresView;
    }
    if (pathOnly.startsWith('/api/v1/fees/assignments')) {
      if (verb === 'POST') return P.feesAssignmentsCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesAssignmentsUpdate;
      if (verb === 'DELETE') return P.feesAssignmentsDelete;
      return P.feesAssignmentsView;
    }
    if (pathOnly.startsWith('/api/v1/fees/invoices/preview')) return P.feesInvoiceGenerateView;
    if (pathOnly.startsWith('/api/v1/fees/invoices/generate')) return verb === 'POST' ? P.feesInvoiceGenerateCreate : P.feesInvoiceGenerateView;
    if (pathOnly.startsWith('/api/v1/fees/invoices')) {
      if (verb === 'DELETE' || verb === 'PATCH' || verb === 'PUT') return P.feesInvoicesCancel;
      return P.feesInvoicesView;
    }
    if (pathOnly.startsWith('/api/v1/fees/payments')) return verb === 'POST' ? P.feesCollectionCreate : P.feesCollectionView;
    if (pathOnly.startsWith('/api/v1/fees/collection')) {
      if (pathOnly.includes('/receipt') || pathOnly.includes('/print')) return P.feesReceiptsPrint;
      return verb === 'POST' ? P.feesCollectionCreate : P.feesCollectionView;
    }
    if (pathOnly.startsWith('/api/v1/fees/ledger')) {
      if (pathOnly.includes('/export') || pathOnly.endsWith('.pdf') || pathOnly.endsWith('.xlsx')) return P.feesLedgerExport;
      return P.feesLedgerView;
    }
    if (pathOnly.startsWith('/api/v1/fees/discounts')) {
      if (/\/(approve|reject|activate|deactivate)$/.test(pathOnly) && ['POST', 'PATCH', 'PUT'].includes(verb)) return P.feesDiscountsApprove;
      if (verb === 'POST') return P.feesDiscountsCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesDiscountsUpdate;
      if (verb === 'DELETE') return P.feesDiscountsDelete;
      return P.feesDiscountsView;
    }
    if (pathOnly.startsWith('/api/v1/fees/fines')) {
      if (verb === 'POST') return P.feesFinesCreate;
      if (verb === 'PATCH' || verb === 'PUT') return P.feesFinesUpdate;
      if (verb === 'DELETE') return P.feesFinesDelete;
      return P.feesFinesView;
    }
    if (pathOnly.startsWith('/api/v1/fees/reports')) {
      if (pathOnly.includes('/export') || pathOnly.endsWith('.csv') || pathOnly.endsWith('.pdf') || pathOnly.endsWith('.xlsx')) return P.feesReportsExport;
      return P.feesReportsView;
    }
    return P.feesOverviewView;
  }
  if (pathOnly.startsWith('/api/v1/leave/types')) {
    if (verb === 'POST') return P.leaveTypeCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.leaveTypeEdit;
    if (verb === 'DELETE') return P.leaveTypeDelete;
    return P.leaveTypeView;
  }
  if (pathOnly.startsWith('/api/v1/leave/defines')) {
    if (verb === 'POST') return P.leaveDefineCreate;
    if (verb === 'PATCH' || verb === 'PUT') return P.leaveDefineEdit;
    if (verb === 'DELETE') return P.leaveDefineDelete;
    return P.leaveDefineView;
  }
  if (pathOnly.startsWith('/api/v1/leave/balances')) return P.leaveBalanceView;
  if (/^\/api\/v1\/leave\/(applications|requests)\/[^/]+\/(status|approve|reject)$/.test(pathOnly)) return P.leaveApproveEdit;
  if (/^\/api\/v1\/leave\/(applications|requests)/.test(pathOnly)) {
    const isMineRequest = /[?&]mine=true(?:&|$)/.test(path);
    if (verb === 'POST') return P.leaveApplyCreate;
    if (verb === 'GET') return isMineRequest ? P.leaveApplyView : P.leaveApproveView;
    if (verb === 'PATCH' || verb === 'PUT') return isMineRequest ? P.leaveApplyEdit : P.leaveApproveEdit;
    if (verb === 'DELETE') return isMineRequest ? P.leaveApplyDelete : P.leaveApproveDelete;
    return isMineRequest ? P.leaveApplyView : P.leaveApproveView;
  }

  if (pathOnly.startsWith('/api/v1/exams/centers')) {
    return verb === 'GET' ? P.examCenterView : P.examCenterManage;
  }
  if (pathOnly.startsWith('/api/v1/exams/rooms')) {
    return verb === 'GET' ? P.examRoomView : P.examRoomManage;
  }
  if (/^\/api\/v1\/exams\/[^/]+\/seating/.test(pathOnly)) {
    return verb === 'GET' ? P.examSeatingView : P.examSeatingManage;
  }
  if (/^\/api\/v1\/exams\/[^/]+\/invigilators/.test(pathOnly)) {
    return verb === 'GET' ? P.examInvigilatorView : P.examInvigilatorManage;
  }
  if (/^\/api\/v1\/exams\/[^/]+\/hall-tickets/.test(pathOnly)) {
    return pathOnly.endsWith('/pdf') ? P.examHallticketExport : P.examHallticketView;
  }
  if (pathOnly.startsWith('/api/v1/reports')) {
    if (pathOnly.endsWith('/export.csv') || pathOnly.endsWith('/export.pdf') || ['/api/v1/reports/term', '/api/v1/reports/annual', '/api/v1/reports/rank'].includes(pathOnly)) {
      return P.reportsExport;
    }
    return P.reportsView;
  }
  if (pathOnly.startsWith('/api/v1/admin/compliance') || pathOnly.startsWith('/api/v1/compliance')) {
    if (/\/(approve|reject|execute)$/.test(pathOnly)) return P.complianceReview;
    return P.complianceView;
  }

  if (pathOnly.startsWith('/api/v1/faces')) {
    if (pathOnly.endsWith('/approve') || pathOnly.endsWith('/reject')) return P.studentEdit;
    if (verb === 'POST') return [P.studentDocumentCreate, P.studentEdit];
    return [P.studentDocumentView, P.studentView];
  }
  if (pathOnly.startsWith('/api/v1/recognition')) return [P.attendanceCreate, P.attendanceEdit];
  if (pathOnly.startsWith('/api/v1/analytics')) return [P.dashboardOverview, P.reportsView];
  if (pathOnly.startsWith('/api/v1/uploads/branding')) return P.settingsAccess;
  if (pathOnly.startsWith('/api/v1/uploads/photos')) return [P.studentDocumentCreate, P.staffDocumentCreate];
  if (pathOnly.startsWith('/api/v1/uploads/documents')) return P.studentDocumentCreate;
  if (pathOnly.startsWith('/api/v1/uploads/signed')) {
    return [
      P.studentView,
      P.studentsList,
      P.studentDocumentView,
      P.staffView,
      P.staffDocumentView,
      P.settingsAccess,
      P.reportsView,
      P.dashboardOverview,
    ];
  }
  if (pathOnly.startsWith('/api/v1/notifications/templates')) return P.settingsAccess;
  if (pathOnly.startsWith('/api/v1/notifications/send')) return P.settingsAccess;
  if (pathOnly.startsWith('/api/v1/notifications/logs')) return P.settingsAccess;
  if (pathOnly.startsWith('/api/v1/notifications/summary')) return [P.dashboardOverview, P.supportView, P.plansView];
  if (pathOnly.startsWith('/api/v1/attendance/substitutions')) return P.attendanceSubstituteManage;
  if (pathOnly.startsWith('/api/v1/attendance/summary')) {
    return [P.attendanceView, P.attendanceReport, P.staffAttendanceView, P.staffAttendanceReport];
  }
  if (pathOnly.startsWith('/api/v1/attendance/teacher/self')) {
    return verb === 'POST'
      ? [P.attendanceCreate, P.staffAttendanceCreate]
      : [P.attendanceView, P.staffAttendanceView];
  }
  if (pathOnly.startsWith('/api/v1/attendance/sessions')) {
    if (pathOnly.endsWith('/lock')) return P.attendanceEdit;
    if (verb === 'POST') return [P.attendanceCreate, P.attendanceEdit];
    if (verb === 'PATCH' || verb === 'PUT') return P.attendanceEdit;
    return P.attendanceView;
  }
  if (pathOnly.startsWith('/api/v1/attendance/periods')) {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(verb)) return P.attendanceEdit;
    return P.attendanceView;
  }
  if (pathOnly.startsWith('/api/v1/attendance/legacy/sessions')) {
    if (pathOnly.endsWith('/close')) return P.attendanceEdit;
    if (verb === 'POST') return [P.attendanceCreate, P.attendanceEdit];
    return P.attendanceView;
  }
  if (pathOnly.startsWith('/api/v1/attendance/legacy/records')) {
    if (pathOnly.endsWith('/override')) return P.attendanceEdit;
    if (verb === 'POST') return [P.attendanceCreate, P.attendanceEdit];
    return P.attendanceView;
  }
  if (pathOnly.startsWith('/api/v1/attendance-approval')) return P.attendanceEdit;

  const targets: Array<{ prefix: string; code: PermissionRequirement }> = [
    { prefix: '/api/v1/ai-assistant', code: P.aiAssistantUse },
    { prefix: '/api/v1/schools', code: verb === 'GET' ? P.schoolOnboardingView : P.schoolOnboardingManage },
    { prefix: '/api/v1/teachers/onboarding', code: verb === 'GET' ? P.teacherOnboardingView : P.teacherOnboardingManage },
    { prefix: '/api/v1/teachers/', code: pathOnly.includes('/credentials/') ? P.teacherCredentialsManage : pathOnly.includes('/onboarding') ? (verb === 'GET' ? P.teacherOnboardingView : P.teacherOnboardingManage) : verb === 'POST' ? P.teachersAdd : teacherLookupPermissions },
    { prefix: '/api/v1/academics/timetable/teacher', code: P.academicRoutineView },
    { prefix: '/api/v1/teachers', code: verb === 'POST' ? P.teachersAdd : teacherLookupPermissions },
    { prefix: '/api/v1/teacher-assignments', code: teacherLookupPermissions },
    { prefix: '/api/v1/academic-setup', code: verb === 'GET' ? academicLookupPermissions : P.academicsSetup },
    { prefix: '/api/v1/dormitories', code: P.dormitoryView },
    { prefix: '/api/v1/transport', code: P.transportView },
    { prefix: '/api/v1/homework', code: P.homeworkView },
    { prefix: '/api/v1/library', code: P.libraryView },
    { prefix: '/api/v1/students', code: P.studentsList },
    { prefix: '/api/v1/attendance', code: P.attendanceView },
    { prefix: '/api/v1/attendance-summary', code: P.attendanceView },
    { prefix: '/api/v1/attendance-approval', code: P.attendanceView },
    { prefix: '/api/v1/leave', code: P.leaveApplyView },
    { prefix: '/api/v1/academics', code: verb === 'GET' ? academicLookupPermissions : P.academicsSetup },
    { prefix: '/api/v1/exams', code: P.academicsExams },
    { prefix: '/api/v1/users/school-users', code: P.settingsAccess },
    { prefix: '/api/v1/users/employee-permissions', code: P.settingsAccess },
    { prefix: '/api/v1/audit-logs', code: P.auditView },
    { prefix: '/api/v1/tickets', code: P.supportView },
    { prefix: '/api/v1/subscriptions', code: P.plansView },
  ];

  const match = targets.find((entry) => path.startsWith(entry.prefix));
  return match?.code ?? null;
};
