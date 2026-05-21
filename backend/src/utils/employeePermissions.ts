import { prisma } from '../config/db';

export const MANAGED_EMPLOYEE_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
export type ManagedEmployeeRole = (typeof MANAGED_EMPLOYEE_ROLES)[number];

export type EmployeePermissionItem = {
  code: string;
  label: string;
  path: string;
  group: 'Overview' | 'Plans' | 'Employees' | 'Academics' | 'Students' | 'Attendance' | 'Support' | 'Audit' | 'Utilities';
};

export const EMPLOYEE_PERMISSION_CATALOG: EmployeePermissionItem[] = [
  { code: 'dashboard.overview', label: 'Overview', path: '/dashboard', group: 'Overview' },
  { code: 'plans.view', label: 'Plans', path: '/dashboard/plans', group: 'Plans' },
  { code: 'settings.access', label: 'Access Control', path: '/dashboard/settings/access', group: 'Utilities' },
  { code: 'teachers.list', label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: 'teachers.add', label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: 'academics.setup', label: 'Academic Setup', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class.view', label: 'Academic Classes - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class.create', label: 'Academic Classes - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class.edit', label: 'Academic Classes - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class.delete', label: 'Academic Classes - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.section.view', label: 'Academic Sections - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.section.create', label: 'Academic Sections - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.section.edit', label: 'Academic Sections - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.section.delete', label: 'Academic Sections - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.subject.view', label: 'Academic Subjects - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.subject.create', label: 'Academic Subjects - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.subject.edit', label: 'Academic Subjects - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.subject.delete', label: 'Academic Subjects - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.room.view', label: 'Academic Rooms - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.room.create', label: 'Academic Rooms - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.room.edit', label: 'Academic Rooms - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.room.delete', label: 'Academic Rooms - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.time.view', label: 'Academic Time Periods - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.time.create', label: 'Academic Time Periods - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.time.edit', label: 'Academic Time Periods - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.time.delete', label: 'Academic Time Periods - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.view', label: 'Assign Subjects - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.create', label: 'Assign Subjects - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.edit', label: 'Assign Subjects - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.delete', label: 'Assign Subjects - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.view', label: 'Class Teachers - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.create', label: 'Class Teachers - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.edit', label: 'Class Teachers - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.delete', label: 'Class Teachers - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.routine.view', label: 'Class Routine - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.routine.create', label: 'Class Routine - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.routine.edit', label: 'Class Routine - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.routine.delete', label: 'Class Routine - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academics.exams', label: 'Exams', path: '/dashboard/academics/exams', group: 'Academics' },
  { code: 'academics.marks', label: 'Upload Marks', path: '/dashboard/academics/marks', group: 'Academics' },
  { code: 'students.list', label: 'Students - List', path: '/dashboard/students', group: 'Students' },
  { code: 'students.add', label: 'Students - Add', path: '/dashboard/students/add', group: 'Students' },
  { code: 'student.view', label: 'Student Information - View', path: '/dashboard/students', group: 'Students' },
  { code: 'student.create', label: 'Student Information - Create', path: '/dashboard/students/add', group: 'Students' },
  { code: 'student.edit', label: 'Student Information - Edit', path: '/dashboard/students', group: 'Students' },
  { code: 'student.delete', label: 'Student Information - Delete', path: '/dashboard/students', group: 'Students' },
  { code: 'student.import', label: 'Student Information - Import', path: '/dashboard/students', group: 'Students' },
  { code: 'student.document.view', label: 'Student Documents - View', path: '/dashboard/students', group: 'Students' },
  { code: 'student.document.create', label: 'Student Documents - Create', path: '/dashboard/students', group: 'Students' },
  { code: 'student.document.delete', label: 'Student Documents - Delete', path: '/dashboard/students', group: 'Students' },
  { code: 'student.timeline.view', label: 'Student Timeline - View', path: '/dashboard/students', group: 'Students' },
  { code: 'student.timeline.create', label: 'Student Timeline - Create', path: '/dashboard/students', group: 'Students' },
  { code: 'student.timeline.delete', label: 'Student Timeline - Delete', path: '/dashboard/students', group: 'Students' },
  { code: 'attendance.create', label: 'Student Attendance - Create', path: '/dashboard/students/attendance', group: 'Attendance' },
  { code: 'attendance.edit', label: 'Student Attendance - Edit', path: '/dashboard/students/attendance', group: 'Attendance' },
  { code: 'attendance.report', label: 'Student Attendance - Report', path: '/dashboard/students/attendance', group: 'Attendance' },
  { code: 'student.group.view', label: 'Student Groups - View', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.group.create', label: 'Student Groups - Create', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.group.edit', label: 'Student Groups - Edit', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.group.delete', label: 'Student Groups - Delete', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.category.view', label: 'Student Categories - View', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.category.create', label: 'Student Categories - Create', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.category.edit', label: 'Student Categories - Edit', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.category.delete', label: 'Student Categories - Delete', path: '/dashboard/students/groups', group: 'Students' },
  { code: 'student.promote.view', label: 'Student Promotion - View', path: '/dashboard/students/promotion', group: 'Students' },
  { code: 'student.promote.create', label: 'Student Promotion - Create', path: '/dashboard/students/promotion', group: 'Students' },
  { code: 'student.disabled.view', label: 'Disabled Students - View', path: '/dashboard/students/disabled', group: 'Students' },
  { code: 'student.disabled.edit', label: 'Disabled Students - Edit', path: '/dashboard/students/disabled', group: 'Students' },
  { code: 'student.disabled.delete', label: 'Disabled Students - Delete', path: '/dashboard/students/disabled', group: 'Students' },
  { code: 'student.disabled.restore', label: 'Disabled Students - Restore', path: '/dashboard/students/disabled', group: 'Students' },
  { code: 'idcards.view', label: 'ID Cards', path: '/dashboard/id-cards', group: 'Utilities' },
  {
    code: 'students.transfers',
    label: 'Incoming Transfer Requests',
    path: '/dashboard/students/transfers',
    group: 'Students',
  },
  { code: 'attendance.view', label: 'Attendance', path: '/dashboard/attendance', group: 'Attendance' },
  {
    code: 'attendance.substitute.manage',
    label: 'Attendance Substitutions',
    path: '/dashboard/teachers/assign',
    group: 'Attendance',
  },
  { code: 'support.view', label: 'Support', path: '/dashboard/support', group: 'Support' },
  { code: 'audit.view', label: 'Audit Logs', path: '/dashboard/audit', group: 'Audit' },
];

const DEFAULT_PERMISSION_BY_ROLE: Record<ManagedEmployeeRole, string[]> = {
  SCHOOL_ADMIN: EMPLOYEE_PERMISSION_CATALOG.map((entry) => entry.code),
  TEACHER: [
    'dashboard.overview',
    'academics.setup',
    'academics.exams',
    'academics.marks',
    'students.list',
    'idcards.view',
    'attendance.view',
    'support.view',
    'plans.view',
  ],
  ACCOUNTANT: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
  LIBRARIAN: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
  STAFF: ['dashboard.overview', 'students.list', 'idcards.view', 'support.view', 'plans.view'],
};

export const getDefaultPermissionCodes = (roleName: string | null | undefined) => {
  const role = (roleName ?? '').toUpperCase() as ManagedEmployeeRole;
  return DEFAULT_PERMISSION_BY_ROLE[role] ?? [];
};

export const getPlanPermissionCodesForSchool = async (schoolId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { schoolId },
    select: { planId: true },
  });

  if (!subscription?.planId) {
    return [];
  }

  const permissions = await prisma.subscriptionPlanPermission.findMany({
    where: { planId: subscription.planId },
    select: { permissionCode: true, enabled: true },
  });

  if (!permissions.length) {
    return [];
  }

  return permissions.filter((entry) => entry.enabled).map((entry) => entry.permissionCode);
};

export const getEffectivePermissionCodesForRole = async (schoolId: string, roleName: string | null | undefined) => {
  const defaults = new Set(getDefaultPermissionCodes(roleName));
  const role = (roleName ?? '').toUpperCase() as ManagedEmployeeRole;
  if (!MANAGED_EMPLOYEE_ROLES.includes(role)) {
    return Array.from(defaults);
  }

  const overrides = await prisma.employeeRolePermission.findMany({
    where: { schoolId, roleName: role },
    select: { permissionCode: true, enabled: true },
  });

  const overrideMap = new Map(overrides.map((entry) => [entry.permissionCode, entry.enabled]));
  const baseCodes = overrides.length
    ? EMPLOYEE_PERMISSION_CATALOG.filter((entry) => {
        if (overrideMap.has(entry.code)) {
          return Boolean(overrideMap.get(entry.code));
        }
        return defaults.has(entry.code);
      }).map((entry) => entry.code)
    : Array.from(defaults);

  const planCodes = new Set(await getPlanPermissionCodesForSchool(schoolId));
  if (planCodes.size === 0) {
    return [];
  }

  return baseCodes.filter((code) => planCodes.has(code));
};

export const getEffectivePermissionCodesForUser = async (
  schoolId: string,
  userId: string,
  roleName: string | null | undefined
) => {
  const roleEffective = new Set(await getEffectivePermissionCodesForRole(schoolId, roleName));
  const overrides = await prisma.employeeUserPermission.findMany({
    where: { schoolId, userId },
    select: { permissionCode: true, enabled: true },
  });

  if (!overrides.length) {
    return Array.from(roleEffective);
  }

  const overrideMap = new Map(overrides.map((entry) => [entry.permissionCode, entry.enabled]));
  const withOverrides = EMPLOYEE_PERMISSION_CATALOG.filter((entry) => {
    if (overrideMap.has(entry.code)) {
      return Boolean(overrideMap.get(entry.code));
    }
    return roleEffective.has(entry.code);
  }).map((entry) => entry.code);

  const planCodes = new Set(await getPlanPermissionCodesForSchool(schoolId));
  if (planCodes.size === 0) {
    return [];
  }

  return withOverrides.filter((code) => planCodes.has(code));
};
