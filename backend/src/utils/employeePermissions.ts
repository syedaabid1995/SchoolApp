import { prisma } from '../config/db';

export const MANAGED_EMPLOYEE_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
export type ManagedEmployeeRole = (typeof MANAGED_EMPLOYEE_ROLES)[number];

export type EmployeePermissionItem = {
  code: string;
  label: string;
  path: string;
  group: 'Overview' | 'Plans' | 'AI Assistant' | 'Employees' | 'Academics' | 'Students' | 'Attendance' | 'Fees' | 'Payroll' | 'Support' | 'Audit' | 'Utilities';
};

export const EMPLOYEE_PERMISSION_CATALOG: EmployeePermissionItem[] = [
  { code: 'dashboard.overview', label: 'Overview', path: '/dashboard', group: 'Overview' },
  { code: 'reports.view', label: 'Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.export', label: 'Reports - Export', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.students.view', label: 'Student Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.parents.view', label: 'Parent Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.attendance.view', label: 'Attendance Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.exams.view', label: 'Exam Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.staff.view', label: 'Staff Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.academics.view', label: 'Academic Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.homework.view', label: 'Homework Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.library.view', label: 'Library Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.transport.view', label: 'Transport Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.dormitory.view', label: 'Dormitory Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.fees.view', label: 'Fee Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'reports.payroll.view', label: 'Payroll Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: 'compliance.view', label: 'Compliance - View', path: '/dashboard/compliance', group: 'Audit' },
  { code: 'compliance.review', label: 'Compliance - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: 'compliance.export.review', label: 'Compliance Export - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: 'compliance.deletion.review', label: 'Compliance Deletion - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: 'plans.view', label: 'Plans', path: '/dashboard/plans', group: 'Plans' },
  { code: 'ai.assistant.view', label: 'AI Assistant - View', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: 'ai.assistant.use', label: 'AI Assistant - Chat', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: 'ai.assistant.execute', label: 'AI Assistant - Execute Actions', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: 'ai.assistant.admin', label: 'AI Assistant - Admin', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: 'settings.access', label: 'Institution & System Settings', path: '/dashboard/settings', group: 'Utilities' },
  { code: 'school.onboarding.view', label: 'School Onboarding - View', path: '/dashboard/onboarding', group: 'Utilities' },
  { code: 'school.onboarding.manage', label: 'School Onboarding - Manage', path: '/dashboard/onboarding', group: 'Utilities' },
  { code: 'school.onboarding.review', label: 'School Onboarding - Review', path: '/dashboard/schools', group: 'Utilities' },
  { code: 'teachers.list', label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: 'teachers.add', label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: 'teacher.onboarding.view', label: 'Teacher Onboarding - View', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: 'teacher.onboarding.manage', label: 'Teacher Onboarding - Manage', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: 'teacher.credentials.manage', label: 'Teacher Credentials - Manage', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: 'staff.view', label: 'Staff Directory - View', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.create', label: 'Staff Directory - Create', path: '/dashboard/staff/add', group: 'Employees' },
  { code: 'staff.edit', label: 'Staff Directory - Edit', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.delete', label: 'Staff Directory - Delete', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.document.view', label: 'Staff Documents - View', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.document.create', label: 'Staff Documents - Create', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.document.delete', label: 'Staff Documents - Delete', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.timeline.view', label: 'Staff Timeline - View', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.timeline.create', label: 'Staff Timeline - Create', path: '/dashboard/staff', group: 'Employees' },
  { code: 'staff.timeline.delete', label: 'Staff Timeline - Delete', path: '/dashboard/staff', group: 'Employees' },
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
  { code: 'academic.room.view', label: 'Timetable Rooms - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.room.create', label: 'Timetable Rooms - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.room.edit', label: 'Timetable Rooms - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.room.delete', label: 'Timetable Rooms - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.time.view', label: 'Timetable Periods - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.time.create', label: 'Timetable Periods - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.time.edit', label: 'Timetable Periods - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.time.delete', label: 'Timetable Periods - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.assign_subject.view', label: 'Assign Subjects - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.create', label: 'Assign Subjects - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.edit', label: 'Assign Subjects - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.assign_subject.delete', label: 'Assign Subjects - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.view', label: 'Class Teachers - View', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.create', label: 'Class Teachers - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.edit', label: 'Class Teachers - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.class_teacher.delete', label: 'Class Teachers - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: 'academic.routine.view', label: 'Timetable Routine - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.routine.create', label: 'Timetable Routine - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.routine.edit', label: 'Timetable Routine - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academic.routine.delete', label: 'Timetable Routine - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: 'academics.exams', label: 'Exams', path: '/dashboard/academics/exams', group: 'Academics' },
  { code: 'exam.center.view', label: 'Exam Centers - View', path: '/dashboard/academics/exams/centers', group: 'Academics' },
  { code: 'exam.center.manage', label: 'Exam Centers - Manage', path: '/dashboard/academics/exams/centers', group: 'Academics' },
  { code: 'exam.room.view', label: 'Exam Rooms - View', path: '/dashboard/academics/exams/rooms', group: 'Academics' },
  { code: 'exam.room.manage', label: 'Exam Rooms - Manage', path: '/dashboard/academics/exams/rooms', group: 'Academics' },
  { code: 'exam.seating.view', label: 'Exam Seating - View', path: '/dashboard/academics/exams/seating', group: 'Academics' },
  { code: 'exam.seating.manage', label: 'Exam Seating - Manage', path: '/dashboard/academics/exams/seating', group: 'Academics' },
  { code: 'exam.invigilator.view', label: 'Exam Invigilators - View', path: '/dashboard/academics/exams/invigilators', group: 'Academics' },
  { code: 'exam.invigilator.manage', label: 'Exam Invigilators - Manage', path: '/dashboard/academics/exams/invigilators', group: 'Academics' },
  { code: 'exam.hallticket.view', label: 'Exam Hall Tickets - View', path: '/dashboard/academics/exams/hall-tickets', group: 'Academics' },
  { code: 'exam.hallticket.export', label: 'Exam Hall Tickets - Export', path: '/dashboard/academics/exams/hall-tickets', group: 'Academics' },
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
  { code: 'staff.attendance.view', label: 'Staff Attendance - View', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: 'staff.attendance.create', label: 'Staff Attendance - Create', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: 'staff.attendance.edit', label: 'Staff Attendance - Edit', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: 'staff.attendance.report', label: 'Staff Attendance - Report', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: 'leave.type.view', label: 'Leave Types - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.type.create', label: 'Leave Types - Create', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.type.edit', label: 'Leave Types - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.type.delete', label: 'Leave Types - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.define.view', label: 'Leave Define - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.define.create', label: 'Leave Define - Create', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.define.edit', label: 'Leave Define - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.define.delete', label: 'Leave Define - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.apply.view', label: 'Apply Leave - View', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: 'leave.apply.create', label: 'Apply Leave - Create', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: 'leave.apply.edit', label: 'Apply Leave - Edit', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: 'leave.apply.delete', label: 'Apply Leave - Delete', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: 'leave.approve.view', label: 'Leave Approval - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.approve.edit', label: 'Leave Approval - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.approve.delete', label: 'Leave Approval - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: 'leave.balance.view', label: 'Leave Balance - View', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: 'fees.overview.view', label: 'Fee Overview - View', path: '/dashboard/fees/overview', group: 'Fees' },
  { code: 'fees.particulars.view', label: 'Fee Particulars - View', path: '/dashboard/fees/particulars', group: 'Fees' },
  { code: 'fees.particulars.create', label: 'Fee Particulars - Create', path: '/dashboard/fees/particulars', group: 'Fees' },
  { code: 'fees.particulars.update', label: 'Fee Particulars - Update', path: '/dashboard/fees/particulars', group: 'Fees' },
  { code: 'fees.particulars.delete', label: 'Fee Particulars - Delete', path: '/dashboard/fees/particulars', group: 'Fees' },
  { code: 'fees.types.view', label: 'Fee Types - View', path: '/dashboard/fees/types', group: 'Fees' },
  { code: 'fees.types.create', label: 'Fee Types - Create', path: '/dashboard/fees/types', group: 'Fees' },
  { code: 'fees.types.update', label: 'Fee Types - Update', path: '/dashboard/fees/types', group: 'Fees' },
  { code: 'fees.types.delete', label: 'Fee Types - Delete', path: '/dashboard/fees/types', group: 'Fees' },
  { code: 'fees.structures.view', label: 'Fee Structures - View', path: '/dashboard/fees/structures', group: 'Fees' },
  { code: 'fees.structures.create', label: 'Fee Structures - Create', path: '/dashboard/fees/structures', group: 'Fees' },
  { code: 'fees.structures.update', label: 'Fee Structures - Update', path: '/dashboard/fees/structures', group: 'Fees' },
  { code: 'fees.structures.delete', label: 'Fee Structures - Delete', path: '/dashboard/fees/structures', group: 'Fees' },
  { code: 'fees.assignments.view', label: 'Fee Assignments - View', path: '/dashboard/fees/assignments', group: 'Fees' },
  { code: 'fees.assignments.create', label: 'Fee Assignments - Create', path: '/dashboard/fees/assignments', group: 'Fees' },
  { code: 'fees.assignments.update', label: 'Fee Assignments - Update', path: '/dashboard/fees/assignments', group: 'Fees' },
  { code: 'fees.assignments.delete', label: 'Fee Assignments - Delete', path: '/dashboard/fees/assignments', group: 'Fees' },
  { code: 'fees.invoice-generate.view', label: 'Generate Invoices - View', path: '/dashboard/fees/invoice-generate', group: 'Fees' },
  { code: 'fees.invoice-generate.create', label: 'Generate Invoices - Create', path: '/dashboard/fees/invoice-generate', group: 'Fees' },
  { code: 'fees.invoices.view', label: 'Fee Invoices - View', path: '/dashboard/fees/invoices', group: 'Fees' },
  { code: 'fees.invoices.cancel', label: 'Fee Invoices - Cancel', path: '/dashboard/fees/invoices', group: 'Fees' },
  { code: 'fees.collection.view', label: 'Fee Collection - View', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: 'fees.collection.create', label: 'Fee Collection - Create', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: 'fees.receipts.print', label: 'Fee Receipts - Print', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: 'fees.discounts.view', label: 'Fee Discounts - View', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: 'fees.discounts.create', label: 'Fee Discounts - Create', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: 'fees.discounts.update', label: 'Fee Discounts - Update', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: 'fees.discounts.delete', label: 'Fee Discounts - Delete', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: 'fees.discounts.approve', label: 'Fee Discounts - Approve/Reject', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: 'fees.fines.view', label: 'Fee Fines - View', path: '/dashboard/fees/fines', group: 'Fees' },
  { code: 'fees.fines.create', label: 'Fee Fines - Create', path: '/dashboard/fees/fines', group: 'Fees' },
  { code: 'fees.fines.update', label: 'Fee Fines - Update', path: '/dashboard/fees/fines', group: 'Fees' },
  { code: 'fees.fines.delete', label: 'Fee Fines - Delete', path: '/dashboard/fees/fines', group: 'Fees' },
  { code: 'fees.ledger.view', label: 'Fee Ledger - View', path: '/dashboard/fees/ledger', group: 'Fees' },
  { code: 'fees.ledger.export', label: 'Fee Ledger - Export', path: '/dashboard/fees/ledger', group: 'Fees' },
  { code: 'fees.reports.view', label: 'Fee Reports - View', path: '/dashboard/fees/reports', group: 'Fees' },
  { code: 'fees.reports.export', label: 'Fee Reports - Export', path: '/dashboard/fees/reports', group: 'Fees' },  { code: 'payroll.view', label: 'Payroll - View', path: '/dashboard/payroll', group: 'Payroll' },
  { code: 'payroll.generate', label: 'Payroll - Generate', path: '/dashboard/payroll', group: 'Payroll' },
  { code: 'payroll.pay', label: 'Payroll - Pay', path: '/dashboard/payroll', group: 'Payroll' },
  { code: 'payroll.report', label: 'Payroll Report', path: '/dashboard/payroll/report', group: 'Payroll' },
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
  { code: 'homework.view', label: 'Homework - View', path: '/dashboard/homework', group: 'Students' },
  { code: 'library.view', label: 'Library - View', path: '/dashboard/library', group: 'Utilities' },
  { code: 'transport.view', label: 'Transport - View', path: '/dashboard/transport', group: 'Utilities' },
  { code: 'dormitory.view', label: 'Dormitory - View', path: '/dashboard/dormitory', group: 'Utilities' },
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
    'homework.view',
    'leave.type.view',
    'leave.apply.view',
    'leave.apply.create',
    'leave.apply.edit',
    'leave.apply.delete',
    'leave.balance.view',
    'idcards.view',
    'attendance.view',
    'support.view',
    'plans.view',
  ],
  ACCOUNTANT: ['dashboard.overview', 'students.list', 'fees.overview.view', 'fees.invoices.view', 'fees.collection.view', 'fees.collection.create', 'fees.receipts.print', 'fees.ledger.view', 'fees.reports.view', 'fees.reports.export', 'leave.type.view', 'leave.apply.view', 'leave.apply.create', 'leave.apply.edit', 'leave.apply.delete', 'leave.balance.view', 'idcards.view', 'support.view', 'plans.view'],
  LIBRARIAN: ['dashboard.overview', 'students.list', 'library.view', 'leave.type.view', 'leave.apply.view', 'leave.apply.create', 'leave.apply.edit', 'leave.apply.delete', 'leave.balance.view', 'idcards.view', 'support.view', 'plans.view'],
  STAFF: ['dashboard.overview', 'students.list', 'leave.type.view', 'leave.apply.view', 'leave.apply.create', 'leave.apply.edit', 'leave.apply.delete', 'leave.balance.view', 'idcards.view', 'support.view', 'plans.view'],
};

const CATALOG_PERMISSION_CODES = new Set(EMPLOYEE_PERMISSION_CATALOG.map((entry) => entry.code));

const LEGACY_FEE_PERMISSION_EXPANSIONS: Record<string, string[]> = {
  'fees.view': [
    'fees.overview.view',
    'fees.particulars.view',
    'fees.types.view',
    'fees.structures.view',
    'fees.assignments.view',
    'fees.invoice-generate.view',
    'fees.invoices.view',
    'fees.collection.view',
    'fees.discounts.view',
    'fees.fines.view',
    'fees.ledger.view',
    'fees.reports.view',
  ],
  'fees.create': [
    'fees.particulars.create',
    'fees.types.create',
    'fees.structures.create',
    'fees.assignments.create',
    'fees.invoice-generate.create',
    'fees.collection.create',
    'fees.discounts.create',
    'fees.fines.create',
  ],
  'fees.edit': [
    'fees.particulars.update',
    'fees.types.update',
    'fees.structures.update',
    'fees.assignments.update',
    'fees.discounts.update',
    'fees.fines.update',
  ],
  'fees.update': [
    'fees.particulars.update',
    'fees.types.update',
    'fees.structures.update',
    'fees.assignments.update',
    'fees.discounts.update',
    'fees.fines.update',
  ],
  'fees.delete': [
    'fees.particulars.delete',
    'fees.types.delete',
    'fees.structures.delete',
    'fees.assignments.delete',
    'fees.discounts.delete',
    'fees.fines.delete',
    'fees.invoices.cancel',
  ],
  'fees.collect': [
    'fees.invoices.view',
    'fees.collection.view',
    'fees.collection.create',
    'fees.receipts.print',
  ],
  'fees.report': [
    'fees.ledger.view',
    'fees.ledger.export',
    'fees.reports.view',
    'fees.reports.export',
  ],
};

const expandPermissionCodes = (codes: Iterable<string>) => {
  const expanded = new Set<string>();
  for (const code of codes) {
    if (CATALOG_PERMISSION_CODES.has(code)) {
      expanded.add(code);
    }
    for (const replacement of LEGACY_FEE_PERMISSION_EXPANSIONS[code] ?? []) {
      if (CATALOG_PERMISSION_CODES.has(replacement)) {
        expanded.add(replacement);
      }
    }
  }
  return Array.from(expanded);
};

export const getDefaultPermissionCodes = (roleName: string | null | undefined) => {
  const role = (roleName ?? '').toUpperCase() as ManagedEmployeeRole;
  return expandPermissionCodes(DEFAULT_PERMISSION_BY_ROLE[role] ?? []);
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

  return expandPermissionCodes(permissions.filter((entry) => entry.enabled).map((entry) => entry.permissionCode));
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
