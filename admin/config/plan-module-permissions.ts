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
    parent: 'Overview',
    module: 'Dashboard & Reports',
    path: '/dashboard',
    description: 'Main school dashboard, workspace overview, and report page access.',
    codes: ['dashboard.overview'],
  },
  {
    parent: 'Overview',
    module: 'Plans',
    path: '/dashboard/plans',
    description: 'Read-only school subscription plan visibility.',
    codes: ['plans.view'],
  },
  {
    parent: 'People',
    module: 'Staff Directory',
    path: '/dashboard/staff',
    description: 'Staff list, staff creation, profile editing, documents, and timeline.',
    codes: [
      'staff.view',
      'staff.create',
      'staff.edit',
      'staff.delete',
      'staff.document.view',
      'staff.document.create',
      'staff.document.delete',
      'staff.timeline.view',
      'staff.timeline.create',
      'staff.timeline.delete',
      'teachers.list',
      'teachers.add',
    ],
  },
  {
    parent: 'People',
    module: 'Staff Attendance',
    path: '/dashboard/staff/attendance',
    description: 'Staff attendance marking and staff attendance reports.',
    codes: ['staff.attendance.view', 'staff.attendance.create', 'staff.attendance.edit', 'staff.attendance.report'],
  },
  {
    parent: 'People',
    module: 'Payroll',
    path: '/dashboard/payroll',
    description: 'Payroll generation, payment recording, and payroll reports.',
    codes: ['payroll.view', 'payroll.generate', 'payroll.pay', 'payroll.report'],
  },
  {
    parent: 'People',
    module: 'Student Information',
    path: '/dashboard/students',
    description: 'Student admission, import, profile, documents, and timeline.',
    codes: [
      'students.list',
      'students.add',
      'student.view',
      'student.create',
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
    parent: 'People',
    module: 'Student Groups & Categories',
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
    parent: 'People',
    module: 'Student Promotion',
    path: '/dashboard/students/promotion',
    description: 'Promote students to the next academic session.',
    codes: ['student.promote.view', 'student.promote.create'],
  },
  {
    parent: 'People',
    module: 'Disabled Students',
    path: '/dashboard/students/disabled',
    description: 'Disabled student list and restore workflow.',
    codes: ['student.disabled.view', 'student.disabled.edit', 'student.disabled.delete', 'student.disabled.restore'],
  },
  {
    parent: 'People',
    module: 'ID Cards',
    path: '/dashboard/id-cards',
    description: 'Student and staff ID card access.',
    codes: ['idcards.view'],
  },
  {
    parent: 'People',
    module: 'Transfer Requests',
    path: '/dashboard/students/transfers',
    description: 'Incoming student transfer requests.',
    codes: ['students.transfers'],
  },
  {
    parent: 'Academics',
    module: 'Academic Setup',
    path: '/dashboard/academics',
    description: 'Classes, sections, subjects, rooms, periods, assignments, class teachers, and routines.',
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
      'academic.room.view',
      'academic.room.create',
      'academic.room.edit',
      'academic.room.delete',
      'academic.time.view',
      'academic.time.create',
      'academic.time.edit',
      'academic.time.delete',
      'academic.assign_subject.view',
      'academic.assign_subject.create',
      'academic.assign_subject.edit',
      'academic.assign_subject.delete',
      'academic.class_teacher.view',
      'academic.class_teacher.create',
      'academic.class_teacher.edit',
      'academic.class_teacher.delete',
      'academic.routine.view',
      'academic.routine.create',
      'academic.routine.edit',
      'academic.routine.delete',
    ],
  },
  {
    parent: 'Academics',
    module: 'Exams',
    path: '/dashboard/academics/exams',
    description: 'Exam setup and exam management access.',
    codes: ['academics.exams'],
  },
  {
    parent: 'Academics',
    module: 'Marks',
    path: '/dashboard/academics/marks',
    description: 'Marks upload and grading access.',
    codes: ['academics.marks'],
  },
  {
    parent: 'Operations',
    module: 'Student Attendance',
    path: '/dashboard/students/attendance',
    description: 'Student attendance marking and reports.',
    codes: ['attendance.view', 'attendance.create', 'attendance.edit', 'attendance.report', 'attendance.substitute.manage'],
  },
  {
    parent: 'Operations',
    module: 'Apply Leave',
    path: '/dashboard/leave/my',
    description: 'Staff self-service leave application and balance access.',
    codes: ['leave.type.view', 'leave.apply.view', 'leave.apply.create', 'leave.apply.edit', 'leave.apply.delete', 'leave.balance.view'],
  },
  {
    parent: 'Operations',
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
    parent: 'Operations',
    module: 'Support',
    path: '/dashboard/support',
    description: 'School support tickets.',
    codes: ['support.view'],
  },
  {
    parent: 'Operations',
    module: 'Audit Logs',
    path: '/dashboard/audit',
    description: 'School-scoped audit log visibility.',
    codes: ['audit.view'],
  },
  {
    parent: 'Settings',
    module: 'Settings & Access Control',
    path: '/dashboard/settings',
    description: 'School settings and role permission management.',
    codes: ['settings.access'],
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
