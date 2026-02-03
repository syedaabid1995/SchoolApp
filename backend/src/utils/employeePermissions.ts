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
  { code: 'teachers.list', label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: 'teachers.add', label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: 'academics.setup', label: 'Academic Setup', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academics.exams', label: 'Exams', path: '/dashboard/academics/exams', group: 'Academics' },
  { code: 'academics.marks', label: 'Upload Marks', path: '/dashboard/academics/marks', group: 'Academics' },
  { code: 'students.list', label: 'Students - List', path: '/dashboard/students', group: 'Students' },
  { code: 'students.add', label: 'Students - Add', path: '/dashboard/students/add', group: 'Students' },
  { code: 'idcards.view', label: 'ID Cards', path: '/dashboard/id-cards', group: 'Utilities' },
  {
    code: 'students.transfers',
    label: 'Incoming Transfer Requests',
    path: '/dashboard/students/transfers',
    group: 'Students',
  },
  { code: 'attendance.view', label: 'Attendance', path: '/dashboard/attendance', group: 'Attendance' },
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

  if (!overrides.length) {
    return Array.from(defaults);
  }

  const overrideMap = new Map(overrides.map((entry) => [entry.permissionCode, entry.enabled]));
  return EMPLOYEE_PERMISSION_CATALOG.filter((entry) => {
    if (overrideMap.has(entry.code)) {
      return Boolean(overrideMap.get(entry.code));
    }
    return defaults.has(entry.code);
  }).map((entry) => entry.code);
};
