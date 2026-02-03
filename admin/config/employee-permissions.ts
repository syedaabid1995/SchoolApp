export const EMPLOYEE_MANAGED_ROLES = ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
export type EmployeeManagedRole = (typeof EMPLOYEE_MANAGED_ROLES)[number];

export type PermissionCatalogItem = {
  code: string;
  label: string;
  path: string;
  group: 'Overview' | 'Plans' | 'Employees' | 'Academics' | 'Students' | 'Attendance' | 'Support' | 'Audit';
};

export const EMPLOYEE_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { code: 'dashboard.overview', label: 'Overview', path: '/dashboard', group: 'Overview' },
  { code: 'plans.view', label: 'Plans', path: '/dashboard/plans', group: 'Plans' },
  { code: 'teachers.list', label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: 'teachers.add', label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: 'academics.setup', label: 'Academic Setup', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academics.exams', label: 'Exams', path: '/dashboard/academics/exams', group: 'Academics' },
  { code: 'academics.marks', label: 'Upload Marks', path: '/dashboard/academics/marks', group: 'Academics' },
  { code: 'students.list', label: 'Students - List', path: '/dashboard/students', group: 'Students' },
  { code: 'students.add', label: 'Students - Add', path: '/dashboard/students/add', group: 'Students' },
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

export const getRequiredPermissionForPath = (pathname: string) => {
  if (pathname === '/dashboard') return 'dashboard.overview';
  if (pathname.startsWith('/dashboard/plans')) return 'plans.view';

  if (pathname.startsWith('/dashboard/teachers/add')) return 'teachers.add';
  if (pathname.startsWith('/dashboard/teachers')) return 'teachers.list';

  if (pathname.startsWith('/dashboard/academics/exams')) return 'academics.exams';
  if (pathname.startsWith('/dashboard/academics/marks')) return 'academics.marks';
  if (pathname.startsWith('/dashboard/academics')) return 'academics.setup';

  if (pathname.startsWith('/dashboard/students/add')) return 'students.add';
  if (pathname.startsWith('/dashboard/students/transfers')) return 'students.transfers';
  if (pathname.startsWith('/dashboard/students')) return 'students.list';

  if (pathname.startsWith('/dashboard/attendance')) return 'attendance.view';
  if (pathname.startsWith('/dashboard/support')) return 'support.view';
  if (pathname.startsWith('/dashboard/audit')) return 'audit.view';

  return null;
};
