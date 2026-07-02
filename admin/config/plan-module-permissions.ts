import type { PlanPermissionItem } from '../services/subscription.service';

import { PermissionCodes as P } from './permission-manifest';
export type PlanPermissionModuleDefinition = {
  parent: string;
  module: string;
  path: string;
  description: string;
  codes: string[];
};

export type PlanPermissionGroup = {
  parent: string;
  modules: Array<{
    module: string;
    path: string;
    description: string;
    permissions: PlanPermissionItem[];
  }>;
};

export const PLAN_PERMISSION_MODULES: PlanPermissionModuleDefinition[] = [
  {
    parent: 'Initiate',
    module: 'Get Support',
    path: '/dashboard/support',
    description: 'Support contact and help access.',
    codes: [P.supportView],
  },
  {
    parent: 'Dashboard',
    module: 'Dashboard',
    path: '/dashboard',
    description: 'Main school workspace dashboard access.',
    codes: [P.dashboardOverview],
  },
  {
    parent: 'Dashboard',
    module: 'AI Assistant',
    path: '/dashboard/assistant',
    description: 'Controlled school ERP AI assistant for help, read-only lookup, and confirmed setup actions.',
    codes: [P.aiAssistantView, P.aiAssistantUse, P.aiAssistantExecute, P.aiAssistantAdmin],
  },
  {
    parent: 'Reports',
    module: 'Reports',
    path: '/dashboard/reports',
    description: 'School report page access.',
    codes: [
      P.reportsView,
      P.reportsExport,
      P.reportsStudentsView,
      P.reportsParentsView,
      P.reportsAttendanceView,
      P.reportsExamsView,
      P.reportsStaffView,
      P.reportsAcademicsView,
      P.reportsHomeworkView,
      P.reportsLibraryView,
      P.reportsTransportView,
      P.reportsDormitoryView,
      P.reportsFeesView,
      P.reportsPayrollView,
    ],
  },
  {
    parent: 'Reports',
    module: 'Audit Logs',
    path: '/dashboard/audit',
    description: 'School-scoped audit log visibility.',
    codes: [P.auditView],
  },
  {
    parent: 'Academic Setup',
    module: 'Academic Setup',
    path: '/dashboard/academics',
    description: 'Academic years, classes, sections, subjects, subject assignments, and class teachers.',
    codes: [
      P.academicsSetup,
      P.academicClassView,
      P.academicClassCreate,
      P.academicClassEdit,
      P.academicClassDelete,
      P.academicSectionView,
      P.academicSectionCreate,
      P.academicSectionEdit,
      P.academicSectionDelete,
      P.academicSubjectView,
      P.academicSubjectCreate,
      P.academicSubjectEdit,
      P.academicSubjectDelete,
      P.academicAssignSubjectView,
      P.academicAssignSubjectCreate,
      P.academicAssignSubjectEdit,
      P.academicAssignSubjectDelete,
      P.academicClassTeacherView,
      P.academicClassTeacherCreate,
      P.academicClassTeacherEdit,
      P.academicClassTeacherDelete,
    ],
  },
  {
    parent: 'Academic Setup',
    module: 'Timetable',
    path: '/dashboard/timetable',
    description: 'Weekend setup, class rooms, periods, class routine creation, and teacher timetable generation.',
    codes: [
      P.academicsSetup,
      P.academicRoomView,
      P.academicRoomCreate,
      P.academicRoomEdit,
      P.academicRoomDelete,
      P.academicTimeView,
      P.academicTimeCreate,
      P.academicTimeEdit,
      P.academicTimeDelete,
      P.academicRoutineView,
      P.academicRoutineCreate,
      P.academicRoutineEdit,
      P.academicRoutineDelete,
    ],
  },
  {
    parent: 'Students',
    module: 'Student List',
    path: '/dashboard/students',
    description: 'Student list, import, profile editing, documents, and timeline.',
    codes: [
      P.studentsList,
      P.studentView,
      P.studentEdit,
      P.studentDelete,
      P.studentImport,
      P.studentDocumentView,
      P.studentDocumentCreate,
      P.studentDocumentDelete,
      P.studentTimelineView,
      P.studentTimelineCreate,
      P.studentTimelineDelete,
    ],
  },
  {
    parent: 'Students',
    module: 'Add Student',
    path: '/dashboard/students/add',
    description: 'Create student admission records.',
    codes: [P.studentsAdd, P.studentCreate],
  },
  {
    parent: 'Students',
    module: 'Groups & Categories',
    path: '/dashboard/students/groups',
    description: 'Student group and category setup.',
    codes: [
      P.studentGroupView,
      P.studentGroupCreate,
      P.studentGroupEdit,
      P.studentGroupDelete,
      P.studentCategoryView,
      P.studentCategoryCreate,
      P.studentCategoryEdit,
      P.studentCategoryDelete,
    ],
  },
  {
    parent: 'Students',
    module: 'Student Promotion',
    path: '/dashboard/students/promotion',
    description: 'Promote students to the next academic session.',
    codes: [P.studentPromoteView, P.studentPromoteCreate],
  },
  {
    parent: 'Students',
    module: 'Disabled Students',
    path: '/dashboard/students/disabled',
    description: 'Disabled student list and restore workflow.',
    codes: [P.studentDisabledView, P.studentDisabledEdit, P.studentDisabledDelete, P.studentDisabledRestore],
  },
  {
    parent: 'Students',
    module: 'Transfer Requests',
    path: '/dashboard/students/transfers',
    description: 'Incoming student transfer requests.',
    codes: [P.studentsTransfers],
  },
  {
    parent: 'Students',
    module: 'ID Cards',
    path: '/dashboard/id-cards',
    description: 'Student and staff ID card access.',
    codes: [P.idcardsView],
  },
  {
    parent: 'Staff',
    module: 'Employee List',
    path: '/dashboard/staff',
    description: 'Staff list, profile editing, documents, and timeline.',
    codes: [
      P.staffView,
      P.staffEdit,
      P.staffDelete,
      P.staffDocumentView,
      P.staffDocumentCreate,
      P.staffDocumentDelete,
      P.staffTimelineView,
      P.staffTimelineCreate,
      P.staffTimelineDelete,
      P.teachersList,
    ],
  },
  {
    parent: 'Staff',
    module: 'Add Teacher',
    path: '/dashboard/staff/add',
    description: 'Create school staff and teacher records.',
    codes: [P.staffCreate, P.teachersAdd],
  },
  {
    parent: 'Staff',
    module: 'Teacher Onboarding',
    path: '/dashboard/teachers/onboarding',
    description: 'Teacher onboarding and credential readiness.',
    codes: [P.teacherOnboardingView, P.teacherOnboardingManage, P.teacherCredentialsManage],
  },
  {
    parent: 'Attendance',
    module: 'Student Attendance',
    path: '/dashboard/attendance/students/mark',
    description: 'Student attendance marking and attendance reports.',
    codes: [P.attendanceView, P.attendanceCreate, P.attendanceEdit, P.attendanceReport],
  },
  {
    parent: 'Attendance',
    module: 'Staff Attendance',
    path: '/dashboard/staff/attendance',
    description: 'Staff attendance marking and staff attendance reports.',
    codes: [P.staffAttendanceView, P.staffAttendanceCreate, P.staffAttendanceEdit, P.staffAttendanceReport],
  },
  {
    parent: 'Attendance',
    module: 'Apply Leave',
    path: '/dashboard/leave/my',
    description: 'Staff self-service leave application and balance access.',
    codes: [P.leaveTypeView, P.leaveApplyView, P.leaveApplyCreate, P.leaveApplyEdit, P.leaveApplyDelete, P.leaveBalanceView],
  },
  {
    parent: 'Attendance',
    module: 'Leave Management',
    path: '/dashboard/leave/requests',
    description: 'School Admin leave types, leave definitions, and approval workflow.',
    codes: [
      P.leaveTypeCreate,
      P.leaveTypeEdit,
      P.leaveTypeDelete,
      P.leaveDefineView,
      P.leaveDefineCreate,
      P.leaveDefineEdit,
      P.leaveDefineDelete,
      P.leaveApproveView,
      P.leaveApproveEdit,
      P.leaveApproveDelete,
    ],
  },
  {
    parent: 'Examinations',
    module: 'Exams',
    path: '/dashboard/academics/exams',
    description: 'Exam setup and exam management access.',
    codes: [P.academicsExams],
  },
  {
    parent: 'Examinations',
    module: 'Marks',
    path: '/dashboard/academics/marks',
    description: 'Marks upload and grading access.',
    codes: [P.academicsMarks],
  },
  {
    parent: 'Examinations',
    module: 'Centers',
    path: '/dashboard/academics/exams/centers',
    description: 'Exam center setup.',
    codes: [P.examCenterView, P.examCenterManage],
  },
  {
    parent: 'Examinations',
    module: 'Rooms',
    path: '/dashboard/academics/exams/rooms',
    description: 'Exam room setup.',
    codes: [P.examRoomView, P.examRoomManage],
  },
  {
    parent: 'Examinations',
    module: 'Seating',
    path: '/dashboard/academics/exams/seating',
    description: 'Exam seating management.',
    codes: [P.examSeatingView, P.examSeatingManage],
  },
  {
    parent: 'Examinations',
    module: 'Invigilators',
    path: '/dashboard/academics/exams/invigilators',
    description: 'Exam invigilator management.',
    codes: [P.examInvigilatorView, P.examInvigilatorManage],
  },
  {
    parent: 'Examinations',
    module: 'Hall Tickets',
    path: '/dashboard/academics/exams/hall-tickets',
    description: 'Exam hall ticket management.',
    codes: [P.examHallticketView, P.examHallticketExport],
  },
  {
    parent: 'Fees',
    module: 'Fees',
    path: '/dashboard/fees',
    description: 'Fee groups, fee types, fee masters, collections, discounts, and fee reports.',
    codes: [
      P.feesOverviewView,
      P.feesTypesView,
      P.feesTypesCreate,
      P.feesTypesUpdate,
      P.feesTypesDelete,
      P.feesGroupsView,
      P.feesGroupsCreate,
      P.feesGroupsUpdate,
      P.feesGroupsDelete,
      P.feesMastersView,
      P.feesMastersCreate,
      P.feesMastersUpdate,
      P.feesMastersDelete,
      P.feesCollectionView,
      P.feesCollectionCreate,
      P.feesCollectionReverse,
      P.feesReceiptsPrint,
      P.feesDiscountsView,
      P.feesDiscountsCreate,
      P.feesDiscountsUpdate,
      P.feesDiscountsDelete,
      P.feesDiscountsApprove,
      P.feesReportsView,
      P.feesReportsExport,
    ],
  },
  {
    parent: 'Homework',
    module: 'Homework',
    path: '/dashboard/homework',
    description: 'Homework creation and evaluation access.',
    codes: [P.homeworkView, P.reportsHomeworkView],
  },
  {
    parent: 'Communication',
    module: 'Notice Board',
    path: '/dashboard/communication/notice-board',
    description: 'Publish school notices and audience-targeted circulars.',
    codes: [
      P.communicationNoticeBoardView,
      P.communicationNoticeBoardCreate,
      P.communicationNoticeBoardEdit,
      P.communicationNoticeBoardDelete,
    ],
  },
  {
    parent: 'Communication',
    module: 'Send Email',
    path: '/dashboard/communication/send-email',
    description: 'Compose email messages, use school templates, and send immediately or schedule.',
    codes: [P.communicationEmailSend],
  },
  {
    parent: 'Communication',
    module: 'Send SMS',
    path: '/dashboard/communication/send-sms',
    description: 'Compose SMS messages, use school templates, and send immediately or schedule.',
    codes: [P.communicationSmsSend],
  },
  {
    parent: 'Communication',
    module: 'Email / SMS Logs',
    path: '/dashboard/communication/logs',
    description: 'Review sent and failed email/SMS delivery records.',
    codes: [P.communicationEmailLogView],
  },
  {
    parent: 'Communication',
    module: 'Scheduled Email / SMS Logs',
    path: '/dashboard/communication/scheduled-logs',
    description: 'Review queued scheduled communication records.',
    codes: [P.communicationScheduledLogView],
  },
  {
    parent: 'Communication',
    module: 'Login Credentials Send',
    path: '/dashboard/communication/login-credentials',
    description: 'Send login onboarding or reset instructions to selected account holders.',
    codes: [P.communicationLoginCredentialsSend],
  },
  {
    parent: 'Communication',
    module: 'Email Templates',
    path: '/dashboard/communication/email-templates',
    description: 'Create and maintain reusable school email templates.',
    codes: [
      P.communicationEmailTemplateView,
      P.communicationEmailTemplateCreate,
      P.communicationEmailTemplateEdit,
      P.communicationEmailTemplateDelete,
    ],
  },
  {
    parent: 'Communication',
    module: 'SMS Templates',
    path: '/dashboard/communication/sms-templates',
    description: 'Create and maintain reusable school SMS templates.',
    codes: [
      P.communicationSmsTemplateView,
      P.communicationSmsTemplateCreate,
      P.communicationSmsTemplateEdit,
      P.communicationSmsTemplateDelete,
    ],
  },
  {
    parent: 'Transport',
    module: 'Transport',
    path: '/dashboard/transport',
    description: 'Transport route and assignment access.',
    codes: [P.transportView, P.reportsTransportView],
  },
  {
    parent: 'Library',
    module: 'Library',
    path: '/dashboard/library',
    description: 'Library workspace access.',
    codes: [P.libraryView, P.reportsLibraryView],
  },
  {
    parent: 'Inventory',
    module: 'Dormitory',
    path: '/dashboard/dormitory',
    description: 'Dormitory and inventory-style student facility access.',
    codes: [P.dormitoryView, P.reportsDormitoryView],
  },
  {
    parent: 'Accounts',
    module: 'Accounts',
    path: '/dashboard/payroll',
    description: 'Payroll, payment methods, and fee challan setup.',
    codes: [P.payrollView, P.payrollGenerate, P.payrollPay, P.payrollReport, P.settingsAccess],
  },
  {
    parent: 'Users & Roles',
    module: 'Users & Roles',
    path: '/dashboard/role-permissions',
    description: 'User access and role permission setup.',
    codes: [P.settingsAccess],
  },
  {
    parent: 'Subscription',
    module: 'Plans',
    path: '/dashboard/plans',
    description: 'Read-only school subscription plan visibility.',
    codes: [P.plansView],
  },
  {
    parent: 'Settings',
    module: 'Settings',
    path: '/dashboard/settings',
    description: 'Onboarding, institution setup, branding, base setup, sessions, and system setting.',
    codes: [P.settingsAccess, P.schoolOnboardingView, P.schoolOnboardingManage],
  },
];

const actionLabelBySuffix: Array<[string, string]> = [
  ['.view', 'View'],
  ['.create', 'Create'],
  ['.edit', 'Edit'],
  ['.delete', 'Delete'],
  ['.import', 'Import'],
  ['.report', 'Report'],
  ['.generate', 'Generate'],
  ['.pay', 'Pay'],
  ['.restore', 'Restore'],
  ['.manage', 'Manage'],
];

export const formatPlanPermissionAction = (permission: PlanPermissionItem) => {
  const suffix = actionLabelBySuffix.find(([ending]) => permission.code.endsWith(ending));
  if (suffix) return suffix[1];
  if (permission.code === P.dashboardOverview) return 'Open';
  if (permission.code === P.plansView) return 'View';
  if (permission.code === P.teachersList || permission.code === P.studentsList) return 'List';
  if (permission.code === P.teachersAdd || permission.code === P.studentsAdd) return 'Add';
  if (permission.code === P.academicsSetup) return 'Open';
  if (permission.code === P.academicsExams) return 'Open';
  if (permission.code === P.academicsMarks) return 'Upload';
  if (permission.code === P.idcardsView) return 'View';
  if (permission.code === P.studentsTransfers) return 'View';
  return permission.label;
};

export const buildPlanPermissionGroups = (permissions: PlanPermissionItem[]): PlanPermissionGroup[] => {
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]));
  const assignedCodes = new Set<string>();
  const groups = new Map<string, PlanPermissionGroup>();

  PLAN_PERMISSION_MODULES.forEach((definition) => {
    const modulePermissions = definition.codes
      .map((code) => permissionByCode.get(code))
      .filter((permission): permission is PlanPermissionItem => Boolean(permission));

    if (!modulePermissions.length) return;

    modulePermissions.forEach((permission) => assignedCodes.add(permission.code));
    const group = groups.get(definition.parent) ?? { parent: definition.parent, modules: [] };
    group.modules.push({
      module: definition.module,
      path: definition.path,
      description: definition.description,
      permissions: modulePermissions,
    });
    groups.set(definition.parent, group);
  });

  const uncategorized = permissions.filter((permission) => !assignedCodes.has(permission.code));
  if (uncategorized.length) {
    groups.set('Other', {
      parent: 'Other',
      modules: [
        {
          module: 'Other Permissions',
          path: '-',
          description: 'Permissions not mapped to the current sidebar structure.',
          permissions: uncategorized,
        },
      ],
    });
  }

  return Array.from(groups.values());
};
