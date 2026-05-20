export const EMPLOYEE_MANAGED_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
export type EmployeeManagedRole = (typeof EMPLOYEE_MANAGED_ROLES)[number];

export type PermissionCatalogItem = {
  code: string;
  label: string;
  path: string;
  group: 'Overview' | 'Plans' | 'Employees' | 'Academics' | 'Students' | 'Attendance' | 'Support' | 'Audit' | 'Utilities';
};

export const EMPLOYEE_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { code: 'dashboard.overview', label: 'Overview', path: '/dashboard', group: 'Overview' },
  { code: 'dashboard.overview', label: 'Reports', path: '/dashboard/reports', group: 'Overview' },
  { code: 'plans.view', label: 'Plans', path: '/dashboard/plans', group: 'Plans' },
  { code: 'settings.access', label: 'Settings / Access Control', path: '/dashboard/settings', group: 'Utilities' },
  { code: 'teachers.list', label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: 'teachers.add', label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: 'attendance.substitute.manage', label: 'Attendance Substitutions', path: '/dashboard/teachers/assign', group: 'Attendance' },
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
  { code: 'academics.setup', label: 'Timetable', path: '/dashboard/academics/timetable', group: 'Academics' },
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

export const getRequiredPermissionForPath = (pathname: string) => {
  if (pathname.startsWith('/dashboard/reports')) return 'dashboard.overview';
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
  if (pathname.startsWith('/dashboard/id-cards')) return 'idcards.view';

  if (pathname.startsWith('/dashboard/attendance')) return 'attendance.view';
  if (pathname.startsWith('/dashboard/settings')) return 'settings.access';
  if (pathname.startsWith('/dashboard/support')) return 'support.view';
  if (pathname.startsWith('/dashboard/audit')) return 'audit.view';

  return null;
};
