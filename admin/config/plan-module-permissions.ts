import type { PlanPermissionItem } from '../services/subscription.service';

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
    codes: ['support.view'],
  },
  {
    parent: 'Dashboard',
    module: 'Dashboard',
    path: '/dashboard',
    description: 'Main school workspace dashboard access.',
    codes: ['dashboard.overview'],
  },
  {
    parent: 'Reports',
    module: 'Reports',
    path: '/dashboard/reports',
    description: 'School report page access.',
    codes: [
      'reports.view',
      'reports.export',
      'reports.students.view',
      'reports.parents.view',
      'reports.attendance.view',
      'reports.exams.view',
      'reports.staff.view',
      'reports.academics.view',
      'reports.homework.view',
      'reports.library.view',
      'reports.transport.view',
      'reports.dormitory.view',
      'reports.fees.view',
      'reports.payroll.view',
    ],
  },
  {
    parent: 'Reports',
    module: 'Audit Logs',
    path: '/dashboard/audit',
    description: 'School-scoped audit log visibility.',
    codes: ['audit.view'],
  },
  {
    parent: 'Academic Setup',
    module: 'Academic Setup',
    path: '/dashboard/academics',
    description: 'Academic years, classes, sections, subjects, subject assignments, and class teachers.',
    codes: [
      'academics.setup',
      'academic.class.view',
      'academic.class.create',
      'academic.class.edit',
      'academic.class.delete',
      'academic.section.view',
      'academic.section.create',
      'academic.section.edit',
      'academic.section.delete',
      'academic.subject.view',
      'academic.subject.create',
      'academic.subject.edit',
      'academic.subject.delete',
      'academic.assign_subject.view',
      'academic.assign_subject.create',
      'academic.assign_subject.edit',
      'academic.assign_subject.delete',
      'academic.class_teacher.view',
      'academic.class_teacher.create',
      'academic.class_teacher.edit',
      'academic.class_teacher.delete',
    ],
  },
  {
    parent: 'Academic Setup',
    module: 'Timetable',
    path: '/dashboard/timetable',
    description: 'Weekend setup, class rooms, periods, class routine creation, and teacher timetable generation.',
    codes: [
      'academics.setup',
      'academic.room.view',
      'academic.room.create',
      'academic.room.edit',
      'academic.room.delete',
      'academic.time.view',
      'academic.time.create',
      'academic.time.edit',
      'academic.time.delete',
      'academic.routine.view',
      'academic.routine.create',
      'academic.routine.edit',
      'academic.routine.delete',
    ],
  },
  {
    parent: 'Students',
    module: 'Student List',
    path: '/dashboard/students',
    description: 'Student list, import, profile editing, documents, and timeline.',
    codes: [
      'students.list',
      'student.view',
      'student.edit',
      'student.delete',
      'student.import',
      'student.document.view',
      'student.document.create',
      'student.document.delete',
      'student.timeline.view',
      'student.timeline.create',
      'student.timeline.delete',
    ],
  },
  {
    parent: 'Students',
    module: 'Add Student',
    path: '/dashboard/students/add',
    description: 'Create student admission records.',
    codes: ['students.add', 'student.create'],
  },
  {
    parent: 'Students',
    module: 'Groups & Categories',
    path: '/dashboard/students/groups',
    description: 'Student group and category setup.',
    codes: [
      'student.group.view',
      'student.group.create',
      'student.group.edit',
      'student.group.delete',
      'student.category.view',
      'student.category.create',
      'student.category.edit',
      'student.category.delete',
    ],
  },
  {
    parent: 'Students',
    module: 'Student Promotion',
    path: '/dashboard/students/promotion',
    description: 'Promote students to the next academic session.',
    codes: ['student.promote.view', 'student.promote.create'],
  },
  {
    parent: 'Students',
    module: 'Disabled Students',
    path: '/dashboard/students/disabled',
    description: 'Disabled student list and restore workflow.',
    codes: ['student.disabled.view', 'student.disabled.edit', 'student.disabled.delete', 'student.disabled.restore'],
  },
  {
    parent: 'Students',
    module: 'Transfer Requests',
    path: '/dashboard/students/transfers',
    description: 'Incoming student transfer requests.',
    codes: ['students.transfers'],
  },
  {
    parent: 'Students',
    module: 'ID Cards',
    path: '/dashboard/id-cards',
    description: 'Student and staff ID card access.',
    codes: ['idcards.view'],
  },
  {
    parent: 'Staff',
    module: 'Employee List',
    path: '/dashboard/staff',
    description: 'Staff list, profile editing, documents, and timeline.',
    codes: [
      'staff.view',
      'staff.edit',
      'staff.delete',
      'staff.document.view',
      'staff.document.create',
      'staff.document.delete',
      'staff.timeline.view',
      'staff.timeline.create',
      'staff.timeline.delete',
      'teachers.list',
    ],
  },
  {
    parent: 'Staff',
    module: 'Add Teacher',
    path: '/dashboard/staff/add',
    description: 'Create school staff and teacher records.',
    codes: ['staff.create', 'teachers.add'],
  },
  {
    parent: 'Staff',
    module: 'Teacher Onboarding',
    path: '/dashboard/teachers/onboarding',
    description: 'Teacher onboarding and credential readiness.',
    codes: ['teacher.onboarding.view', 'teacher.onboarding.manage', 'teacher.credentials.manage'],
  },
  {
    parent: 'Staff',
    module: 'Assign Classes',
    path: '/dashboard/teachers/assign',
    description: 'Assign teacher substitutions and class coverage.',
    codes: ['attendance.substitute.manage'],
  },
  {
    parent: 'Attendance',
    module: 'Attendance Dashboard',
    path: '/dashboard/attendance',
    description: 'Attendance dashboard access.',
    codes: ['attendance.view'],
  },
  {
    parent: 'Attendance',
    module: 'Student Attendance',
    path: '/dashboard/students/attendance',
    description: 'Student attendance marking and attendance reports.',
    codes: ['attendance.view', 'attendance.create', 'attendance.edit', 'attendance.report'],
  },
  {
    parent: 'Attendance',
    module: 'Staff Attendance',
    path: '/dashboard/staff/attendance',
    description: 'Staff attendance marking and staff attendance reports.',
    codes: ['staff.attendance.view', 'staff.attendance.create', 'staff.attendance.edit', 'staff.attendance.report'],
  },
  {
    parent: 'Attendance',
    module: 'Apply Leave',
    path: '/dashboard/leave/my',
    description: 'Staff self-service leave application and balance access.',
    codes: ['leave.type.view', 'leave.apply.view', 'leave.apply.create', 'leave.apply.edit', 'leave.apply.delete', 'leave.balance.view'],
  },
  {
    parent: 'Attendance',
    module: 'Leave Management',
    path: '/dashboard/leave/requests',
    description: 'School Admin leave types, leave definitions, and approval workflow.',
    codes: [
      'leave.type.create',
      'leave.type.edit',
      'leave.type.delete',
      'leave.define.view',
      'leave.define.create',
      'leave.define.edit',
      'leave.define.delete',
      'leave.approve.view',
      'leave.approve.edit',
      'leave.approve.delete',
    ],
  },
  {
    parent: 'Examinations',
    module: 'Exams',
    path: '/dashboard/academics/exams',
    description: 'Exam setup and exam management access.',
    codes: ['academics.exams'],
  },
  {
    parent: 'Examinations',
    module: 'Marks',
    path: '/dashboard/academics/marks',
    description: 'Marks upload and grading access.',
    codes: ['academics.marks'],
  },
  {
    parent: 'Examinations',
    module: 'Centers',
    path: '/dashboard/academics/exams/centers',
    description: 'Exam center setup.',
    codes: ['exam.center.view', 'exam.center.manage'],
  },
  {
    parent: 'Examinations',
    module: 'Rooms',
    path: '/dashboard/academics/exams/rooms',
    description: 'Exam room setup.',
    codes: ['exam.room.view', 'exam.room.manage'],
  },
  {
    parent: 'Examinations',
    module: 'Seating',
    path: '/dashboard/academics/exams/seating',
    description: 'Exam seating management.',
    codes: ['exam.seating.view', 'exam.seating.manage'],
  },
  {
    parent: 'Examinations',
    module: 'Invigilators',
    path: '/dashboard/academics/exams/invigilators',
    description: 'Exam invigilator management.',
    codes: ['exam.invigilator.view', 'exam.invigilator.manage'],
  },
  {
    parent: 'Examinations',
    module: 'Hall Tickets',
    path: '/dashboard/academics/exams/hall-tickets',
    description: 'Exam hall ticket management.',
    codes: ['exam.hallticket.view', 'exam.hallticket.export'],
  },
  {
    parent: 'Fees',
    module: 'Fees',
    path: '/dashboard/fees',
    description: 'Fee setup, billing, collections, discounts, ledger, and fee reports.',
    codes: [
      'fees.overview.view',
      'fees.particulars.view',
      'fees.particulars.create',
      'fees.particulars.update',
      'fees.particulars.delete',
      'fees.types.view',
      'fees.types.create',
      'fees.types.update',
      'fees.types.delete',
      'fees.structures.view',
      'fees.structures.create',
      'fees.structures.update',
      'fees.structures.delete',
      'fees.assignments.view',
      'fees.assignments.create',
      'fees.assignments.update',
      'fees.assignments.delete',
      'fees.invoice-generate.view',
      'fees.invoice-generate.create',
      'fees.invoices.view',
      'fees.invoices.cancel',
      'fees.collection.view',
      'fees.collection.create',
      'fees.receipts.print',
      'fees.discounts.view',
      'fees.discounts.create',
      'fees.discounts.update',
      'fees.discounts.delete',
      'fees.discounts.approve',
      'fees.fines.view',
      'fees.fines.create',
      'fees.fines.update',
      'fees.fines.delete',
      'fees.ledger.view',
      'fees.ledger.export',
      'fees.reports.view',
      'fees.reports.export',
    ],
  },
  {
    parent: 'Homework',
    module: 'Homework',
    path: '/dashboard/homework',
    description: 'Homework creation and evaluation access.',
    codes: ['students.list', 'reports.homework.view'],
  },
  {
    parent: 'Communication',
    module: 'Communication',
    path: '/dashboard/support',
    description: 'SMS settings, support tickets, and parent portal links.',
    codes: ['support.view', 'settings.access'],
  },
  {
    parent: 'Transport',
    module: 'Transport',
    path: '/dashboard/transport',
    description: 'Transport route and assignment access.',
    codes: ['students.list', 'reports.transport.view'],
  },
  {
    parent: 'Library',
    module: 'Library',
    path: '/dashboard/library',
    description: 'Library workspace access.',
    codes: ['students.list', 'reports.library.view'],
  },
  {
    parent: 'Inventory',
    module: 'Dormitory',
    path: '/dashboard/dormitory',
    description: 'Dormitory and inventory-style student facility access.',
    codes: ['students.list', 'reports.dormitory.view'],
  },
  {
    parent: 'Accounts',
    module: 'Accounts',
    path: '/dashboard/payroll',
    description: 'Payroll, payment methods, and fee challan setup.',
    codes: ['payroll.view', 'payroll.generate', 'payroll.pay', 'payroll.report', 'settings.access'],
  },
  {
    parent: 'Users & Roles',
    module: 'Users & Roles',
    path: '/dashboard/role-permissions',
    description: 'User access and role permission setup.',
    codes: ['settings.access'],
  },
  {
    parent: 'Subscription',
    module: 'Plans',
    path: '/dashboard/plans',
    description: 'Read-only school subscription plan visibility.',
    codes: ['plans.view'],
  },
  {
    parent: 'Settings',
    module: 'Settings',
    path: '/dashboard/settings',
    description: 'Onboarding, institution setup, branding, base setup, sessions, holidays, and system setting.',
    codes: ['settings.access', 'school.onboarding.view', 'school.onboarding.manage'],
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
  if (permission.code === 'dashboard.overview') return 'Open';
  if (permission.code === 'plans.view') return 'View';
  if (permission.code === 'teachers.list' || permission.code === 'students.list') return 'List';
  if (permission.code === 'teachers.add' || permission.code === 'students.add') return 'Add';
  if (permission.code === 'academics.setup') return 'Open';
  if (permission.code === 'academics.exams') return 'Open';
  if (permission.code === 'academics.marks') return 'Upload';
  if (permission.code === 'idcards.view') return 'View';
  if (permission.code === 'students.transfers') return 'View';
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
