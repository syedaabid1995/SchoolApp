import { PermissionCodes as P } from './permission-manifest';
export const EMPLOYEE_MANAGED_ROLES = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'] as const;
export type EmployeeManagedRole = (typeof EMPLOYEE_MANAGED_ROLES)[number];

export type PermissionCatalogItem = {
  code: string;
  label: string;
  path: string;
  group: 'Overview' | 'Plans' | 'AI Assistant' | 'Employees' | 'Academics' | 'Students' | 'Attendance' | 'Fees' | 'Payroll' | 'Communication' | 'Support' | 'Audit' | 'Utilities';
};

export const EMPLOYEE_PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { code: P.dashboardOverview, label: 'Overview', path: '/dashboard', group: 'Overview' },
  { code: P.dashboardOverview, label: 'Reports', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsView, label: 'Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsExport, label: 'Reports - Export', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsStudentsView, label: 'Student Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsParentsView, label: 'Parent Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsAttendanceView, label: 'Attendance Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsExamsView, label: 'Exam Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsStaffView, label: 'Staff Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsAcademicsView, label: 'Academic Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsHomeworkView, label: 'Homework Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsLibraryView, label: 'Library Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsTransportView, label: 'Transport Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsDormitoryView, label: 'Dormitory Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsFeesView, label: 'Fee Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.reportsPayrollView, label: 'Payroll Reports - View', path: '/dashboard/reports', group: 'Overview' },
  { code: P.complianceView, label: 'Compliance - View', path: '/dashboard/compliance', group: 'Audit' },
  { code: P.complianceReview, label: 'Compliance - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: P.complianceExportReview, label: 'Compliance Export - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: P.complianceDeletionReview, label: 'Compliance Deletion - Review', path: '/dashboard/compliance', group: 'Audit' },
  { code: P.communicationNoticeBoardView, label: 'Notice Board - View', path: '/dashboard/communication/notice-board', group: 'Communication' },
  { code: P.communicationNoticeBoardCreate, label: 'Notice Board - Create', path: '/dashboard/communication/notice-board', group: 'Communication' },
  { code: P.communicationNoticeBoardEdit, label: 'Notice Board - Edit', path: '/dashboard/communication/notice-board', group: 'Communication' },
  { code: P.communicationNoticeBoardDelete, label: 'Notice Board - Delete', path: '/dashboard/communication/notice-board', group: 'Communication' },
  { code: P.communicationEmailSend, label: 'Send Email', path: '/dashboard/communication/send-email', group: 'Communication' },
  { code: P.communicationSmsSend, label: 'Send SMS', path: '/dashboard/communication/send-sms', group: 'Communication' },
  { code: P.communicationPushSend, label: 'Send Push', path: '/dashboard/communication/send-push', group: 'Communication' },
  { code: P.communicationEmailLogView, label: 'Email / SMS Logs', path: '/dashboard/communication/logs', group: 'Communication' },
  { code: P.communicationPushLogView, label: 'Push Logs', path: '/dashboard/communication/push-logs', group: 'Communication' },
  { code: P.communicationScheduledLogView, label: 'Scheduled Email / SMS Logs', path: '/dashboard/communication/scheduled-logs', group: 'Communication' },
  { code: P.communicationLoginCredentialsSend, label: 'Login Credentials Send', path: '/dashboard/communication/login-credentials', group: 'Communication' },
  { code: P.communicationEmailTemplateView, label: 'Email Templates - View', path: '/dashboard/communication/email-templates', group: 'Communication' },
  { code: P.communicationEmailTemplateCreate, label: 'Email Templates - Create', path: '/dashboard/communication/email-templates', group: 'Communication' },
  { code: P.communicationEmailTemplateEdit, label: 'Email Templates - Edit', path: '/dashboard/communication/email-templates', group: 'Communication' },
  { code: P.communicationEmailTemplateDelete, label: 'Email Templates - Delete', path: '/dashboard/communication/email-templates', group: 'Communication' },
  { code: P.communicationSmsTemplateView, label: 'SMS Templates - View', path: '/dashboard/communication/sms-templates', group: 'Communication' },
  { code: P.communicationSmsTemplateCreate, label: 'SMS Templates - Create', path: '/dashboard/communication/sms-templates', group: 'Communication' },
  { code: P.communicationSmsTemplateEdit, label: 'SMS Templates - Edit', path: '/dashboard/communication/sms-templates', group: 'Communication' },
  { code: P.communicationSmsTemplateDelete, label: 'SMS Templates - Delete', path: '/dashboard/communication/sms-templates', group: 'Communication' },
  { code: P.communicationPushTemplateView, label: 'Push Templates - View', path: '/dashboard/communication/push-templates', group: 'Communication' },
  { code: P.communicationPushTemplateCreate, label: 'Push Templates - Create', path: '/dashboard/communication/push-templates', group: 'Communication' },
  { code: P.communicationPushTemplateEdit, label: 'Push Templates - Edit', path: '/dashboard/communication/push-templates', group: 'Communication' },
  { code: P.communicationPushTemplateDelete, label: 'Push Templates - Delete', path: '/dashboard/communication/push-templates', group: 'Communication' },
  { code: P.plansView, label: 'Plans', path: '/dashboard/plans', group: 'Plans' },
  { code: P.aiAssistantView, label: 'AI Assistant - View', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: P.aiAssistantUse, label: 'AI Assistant - Chat', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: P.aiAssistantExecute, label: 'AI Assistant - Execute Actions', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: P.aiAssistantAdmin, label: 'AI Assistant - Admin', path: '/dashboard/assistant', group: 'AI Assistant' },
  { code: P.settingsAccess, label: 'Institution & System Settings', path: '/dashboard/settings', group: 'Utilities' },
  { code: P.schoolOnboardingView, label: 'School Onboarding - View', path: '/dashboard/onboarding', group: 'Utilities' },
  { code: P.schoolOnboardingManage, label: 'School Onboarding - Manage', path: '/dashboard/onboarding', group: 'Utilities' },
  { code: P.schoolOnboardingReview, label: 'School Onboarding - Review', path: '/dashboard/schools', group: 'Utilities' },
  { code: P.teachersList, label: 'Employees - List', path: '/dashboard/teachers', group: 'Employees' },
  { code: P.teachersAdd, label: 'Employees - Add', path: '/dashboard/teachers/add', group: 'Employees' },
  { code: P.teacherOnboardingView, label: 'Teacher Onboarding - View', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: P.teacherOnboardingManage, label: 'Teacher Onboarding - Manage', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: P.teacherCredentialsManage, label: 'Teacher Credentials - Manage', path: '/dashboard/teachers/onboarding', group: 'Employees' },
  { code: P.staffView, label: 'Staff Directory - View', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffCreate, label: 'Staff Directory - Create', path: '/dashboard/staff/add', group: 'Employees' },
  { code: P.staffEdit, label: 'Staff Directory - Edit', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffDelete, label: 'Staff Directory - Delete', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffDocumentView, label: 'Staff Documents - View', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffDocumentCreate, label: 'Staff Documents - Create', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffDocumentDelete, label: 'Staff Documents - Delete', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffTimelineView, label: 'Staff Timeline - View', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffTimelineCreate, label: 'Staff Timeline - Create', path: '/dashboard/staff', group: 'Employees' },
  { code: P.staffTimelineDelete, label: 'Staff Timeline - Delete', path: '/dashboard/staff', group: 'Employees' },
  { code: P.attendanceSubstituteManage, label: 'Attendance Substitutions', path: '/dashboard/academics', group: 'Attendance' },
  { code: P.academicsSetup, label: 'Academic Setup', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassView, label: 'Academic Classes - View', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassCreate, label: 'Academic Classes - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassEdit, label: 'Academic Classes - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassDelete, label: 'Academic Classes - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSectionView, label: 'Academic Sections - View', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSectionCreate, label: 'Academic Sections - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSectionEdit, label: 'Academic Sections - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSectionDelete, label: 'Academic Sections - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSubjectView, label: 'Academic Subjects - View', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSubjectCreate, label: 'Academic Subjects - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSubjectEdit, label: 'Academic Subjects - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicSubjectDelete, label: 'Academic Subjects - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicRoomView, label: 'Timetable Rooms - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoomCreate, label: 'Timetable Rooms - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoomEdit, label: 'Timetable Rooms - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoomDelete, label: 'Timetable Rooms - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicTimeView, label: 'Timetable Periods - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicTimeCreate, label: 'Timetable Periods - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicTimeEdit, label: 'Timetable Periods - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicTimeDelete, label: 'Timetable Periods - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicAssignSubjectView, label: 'Assign Subjects - View', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicAssignSubjectCreate, label: 'Assign Subjects - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicAssignSubjectEdit, label: 'Assign Subjects - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicAssignSubjectDelete, label: 'Assign Subjects - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassTeacherView, label: 'Class Teachers - View', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassTeacherCreate, label: 'Class Teachers - Create', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassTeacherEdit, label: 'Class Teachers - Edit', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicClassTeacherDelete, label: 'Class Teachers - Delete', path: '/dashboard/academics', group: 'Academics' },
  { code: P.academicRoutineView, label: 'Timetable Routine - View', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoutineCreate, label: 'Timetable Routine - Create', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoutineEdit, label: 'Timetable Routine - Edit', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicRoutineDelete, label: 'Timetable Routine - Delete', path: '/dashboard/timetable', group: 'Academics' },
  { code: P.academicsExams, label: 'Exams', path: '/dashboard/academics/exams', group: 'Academics' },
  { code: P.examCenterView, label: 'Exam Centers - View', path: '/dashboard/academics/exams/centers', group: 'Academics' },
  { code: P.examCenterManage, label: 'Exam Centers - Manage', path: '/dashboard/academics/exams/centers', group: 'Academics' },
  { code: P.examRoomView, label: 'Exam Rooms - View', path: '/dashboard/academics/exams/rooms', group: 'Academics' },
  { code: P.examRoomManage, label: 'Exam Rooms - Manage', path: '/dashboard/academics/exams/rooms', group: 'Academics' },
  { code: P.examSeatingView, label: 'Exam Seating - View', path: '/dashboard/academics/exams/seating', group: 'Academics' },
  { code: P.examSeatingManage, label: 'Exam Seating - Manage', path: '/dashboard/academics/exams/seating', group: 'Academics' },
  { code: P.examInvigilatorView, label: 'Exam Invigilators - View', path: '/dashboard/academics/exams/invigilators', group: 'Academics' },
  { code: P.examInvigilatorManage, label: 'Exam Invigilators - Manage', path: '/dashboard/academics/exams/invigilators', group: 'Academics' },
  { code: P.examHallticketView, label: 'Exam Hall Tickets - View', path: '/dashboard/academics/exams/hall-tickets', group: 'Academics' },
  { code: P.examHallticketExport, label: 'Exam Hall Tickets - Export', path: '/dashboard/academics/exams/hall-tickets', group: 'Academics' },
  { code: P.academicsMarks, label: 'Upload Marks', path: '/dashboard/academics/marks', group: 'Academics' },
  { code: P.studentsList, label: 'Students - List', path: '/dashboard/students', group: 'Students' },
  { code: P.studentsAdd, label: 'Students - Add', path: '/dashboard/students/add', group: 'Students' },
  { code: P.studentView, label: 'Student Information - View', path: '/dashboard/students', group: 'Students' },
  { code: P.studentCreate, label: 'Student Information - Create', path: '/dashboard/students/add', group: 'Students' },
  { code: P.studentEdit, label: 'Student Information - Edit', path: '/dashboard/students', group: 'Students' },
  { code: P.studentDelete, label: 'Student Information - Delete', path: '/dashboard/students', group: 'Students' },
  { code: P.studentImport, label: 'Student Information - Import', path: '/dashboard/students', group: 'Students' },
  { code: P.studentDocumentView, label: 'Student Documents - View', path: '/dashboard/students', group: 'Students' },
  { code: P.studentDocumentCreate, label: 'Student Documents - Create', path: '/dashboard/students', group: 'Students' },
  { code: P.studentDocumentDelete, label: 'Student Documents - Delete', path: '/dashboard/students', group: 'Students' },
  { code: P.studentTimelineView, label: 'Student Timeline - View', path: '/dashboard/students', group: 'Students' },
  { code: P.studentTimelineCreate, label: 'Student Timeline - Create', path: '/dashboard/students', group: 'Students' },
  { code: P.studentTimelineDelete, label: 'Student Timeline - Delete', path: '/dashboard/students', group: 'Students' },
  { code: P.attendanceView, label: 'Student Attendance - View', path: '/dashboard/attendance/students/mark', group: 'Attendance' },
  { code: P.attendanceCreate, label: 'Student Attendance - Create', path: '/dashboard/attendance/students/mark', group: 'Attendance' },
  { code: P.attendanceEdit, label: 'Student Attendance - Edit', path: '/dashboard/attendance/students/mark', group: 'Attendance' },
  { code: P.attendanceReport, label: 'Student Attendance - Report', path: '/dashboard/attendance/students/mark', group: 'Attendance' },
  { code: P.staffAttendanceView, label: 'Staff Attendance - View', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: P.staffAttendanceCreate, label: 'Staff Attendance - Create', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: P.staffAttendanceEdit, label: 'Staff Attendance - Edit', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: P.staffAttendanceReport, label: 'Staff Attendance - Report', path: '/dashboard/staff/attendance', group: 'Attendance' },
  { code: P.leaveTypeView, label: 'Leave Types - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveTypeCreate, label: 'Leave Types - Create', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveTypeEdit, label: 'Leave Types - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveTypeDelete, label: 'Leave Types - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveDefineView, label: 'Leave Define - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveDefineCreate, label: 'Leave Define - Create', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveDefineEdit, label: 'Leave Define - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveDefineDelete, label: 'Leave Define - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveApplyView, label: 'Apply Leave - View', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: P.leaveApplyCreate, label: 'Apply Leave - Create', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: P.leaveApplyEdit, label: 'Apply Leave - Edit', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: P.leaveApplyDelete, label: 'Apply Leave - Delete', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: P.leaveApproveView, label: 'Leave Approval - View', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveApproveEdit, label: 'Leave Approval - Edit', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveApproveDelete, label: 'Leave Approval - Delete', path: '/dashboard/leave/requests', group: 'Attendance' },
  { code: P.leaveBalanceView, label: 'Leave Balance - View', path: '/dashboard/leave/my', group: 'Attendance' },
  { code: P.feesOverviewView, label: 'Fee Overview - View', path: '/dashboard/fees/overview', group: 'Fees' },
  { code: P.feesTypesView, label: 'Fee Types - View', path: '/dashboard/fees/types', group: 'Fees' },
  { code: P.feesTypesCreate, label: 'Fee Types - Create', path: '/dashboard/fees/types', group: 'Fees' },
  { code: P.feesTypesUpdate, label: 'Fee Types - Update', path: '/dashboard/fees/types', group: 'Fees' },
  { code: P.feesTypesDelete, label: 'Fee Types - Delete', path: '/dashboard/fees/types', group: 'Fees' },
  { code: P.feesGroupsView, label: 'Fee Groups - View', path: '/dashboard/fees/groups', group: 'Fees' },
  { code: P.feesGroupsCreate, label: 'Fee Groups - Create', path: '/dashboard/fees/groups', group: 'Fees' },
  { code: P.feesGroupsUpdate, label: 'Fee Groups - Update', path: '/dashboard/fees/groups', group: 'Fees' },
  { code: P.feesGroupsDelete, label: 'Fee Groups - Delete', path: '/dashboard/fees/groups', group: 'Fees' },
  { code: P.feesMastersView, label: 'Fee Masters - View', path: '/dashboard/fees/masters', group: 'Fees' },
  { code: P.feesMastersCreate, label: 'Fee Masters - Create', path: '/dashboard/fees/masters', group: 'Fees' },
  { code: P.feesMastersUpdate, label: 'Fee Masters - Update', path: '/dashboard/fees/masters', group: 'Fees' },
  { code: P.feesMastersDelete, label: 'Fee Masters - Delete', path: '/dashboard/fees/masters', group: 'Fees' },
  { code: P.feesCollectionView, label: 'Fee Collection - View', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: P.feesCollectionCreate, label: 'Fee Collection - Create', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: P.feesCollectionReverse, label: 'Fee Collection - Reverse Payment', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: P.feesReceiptsPrint, label: 'Fee Receipts - Print', path: '/dashboard/fees/collection', group: 'Fees' },
  { code: P.feesDiscountsView, label: 'Fee Discounts - View', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: P.feesDiscountsCreate, label: 'Fee Discounts - Create', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: P.feesDiscountsUpdate, label: 'Fee Discounts - Update', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: P.feesDiscountsDelete, label: 'Fee Discounts - Delete', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: P.feesDiscountsApprove, label: 'Fee Discounts - Approve/Reject', path: '/dashboard/fees/discounts', group: 'Fees' },
  { code: P.feesReportsView, label: 'Fee Reports - View', path: '/dashboard/fees/reports', group: 'Fees' },
  { code: P.feesReportsExport, label: 'Fee Reports - Export', path: '/dashboard/fees/reports', group: 'Fees' },
  { code: P.expensesView, label: 'Expenses - View', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesCreate, label: 'Expenses - Create', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesEdit, label: 'Expenses - Edit / Request Edit', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesDelete, label: 'Expenses - Delete / Request Delete', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesApprove, label: 'Expenses - Approve Changes', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesCategoriesView, label: 'Expense Categories - View', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesCategoriesCreate, label: 'Expense Categories - Create', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesCategoriesEdit, label: 'Expense Categories - Edit', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesCategoriesDelete, label: 'Expense Categories - Delete', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesReportsView, label: 'Expense Reports - View', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.expensesReportsExport, label: 'Expense Reports - Export', path: '/dashboard/accounts/expenses', group: 'Payroll' },
  { code: P.payrollView, label: 'Payroll - View', path: '/dashboard/payroll', group: 'Payroll' },
  { code: P.payrollGenerate, label: 'Payroll - Generate', path: '/dashboard/payroll', group: 'Payroll' },
  { code: P.payrollPay, label: 'Payroll - Pay', path: '/dashboard/payroll', group: 'Payroll' },
  { code: P.payrollReport, label: 'Payroll Report', path: '/dashboard/payroll/report', group: 'Payroll' },
  { code: P.studentGroupView, label: 'Student Groups - View', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentGroupCreate, label: 'Student Groups - Create', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentGroupEdit, label: 'Student Groups - Edit', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentGroupDelete, label: 'Student Groups - Delete', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentCategoryView, label: 'Student Categories - View', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentCategoryCreate, label: 'Student Categories - Create', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentCategoryEdit, label: 'Student Categories - Edit', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentCategoryDelete, label: 'Student Categories - Delete', path: '/dashboard/students/groups', group: 'Students' },
  { code: P.studentPromoteView, label: 'Student Promotion - View', path: '/dashboard/students/promotion', group: 'Students' },
  { code: P.studentPromoteCreate, label: 'Student Promotion - Create', path: '/dashboard/students/promotion', group: 'Students' },
  { code: P.studentDisabledView, label: 'Disabled Students - View', path: '/dashboard/students/disabled', group: 'Students' },
  { code: P.studentDisabledEdit, label: 'Disabled Students - Edit', path: '/dashboard/students/disabled', group: 'Students' },
  { code: P.studentDisabledDelete, label: 'Disabled Students - Delete', path: '/dashboard/students/disabled', group: 'Students' },
  { code: P.studentDisabledRestore, label: 'Disabled Students - Restore', path: '/dashboard/students/disabled', group: 'Students' },
  { code: P.homeworkView, label: 'Homework - View', path: '/dashboard/homework', group: 'Students' },
  { code: P.libraryView, label: 'Library - View', path: '/dashboard/library', group: 'Utilities' },
  { code: P.transportView, label: 'Transport - View', path: '/dashboard/transport', group: 'Utilities' },
  { code: P.dormitoryView, label: 'Dormitory - View', path: '/dashboard/dormitory', group: 'Utilities' },
  { code: P.idcardsView, label: 'ID Cards', path: '/dashboard/id-cards', group: 'Utilities' },
  {
    code: P.studentsTransfers,
    label: 'Incoming Transfer Requests',
    path: '/dashboard/students/transfers',
    group: 'Students',
  },
  { code: P.attendanceView, label: 'Attendance', path: '/dashboard/attendance', group: 'Attendance' },
  { code: P.supportView, label: 'Support', path: '/dashboard/support', group: 'Support' },
  { code: P.auditView, label: 'Audit Logs', path: '/dashboard/audit', group: 'Audit' },
];

export const getRequiredPermissionForPath = (pathname: string) => {
  if (pathname.startsWith('/dashboard/reports')) return P.reportsView;
  if (pathname.startsWith('/dashboard/compliance')) return P.complianceView;
  if (pathname === '/dashboard') return P.dashboardOverview;
  if (pathname.startsWith('/dashboard/plans')) return P.plansView;
  if (pathname.startsWith('/dashboard/imports')) return P.studentImport;
  if (pathname.startsWith('/dashboard/assistant')) return P.aiAssistantView;
  if (pathname.startsWith('/dashboard/onboarding')) return P.schoolOnboardingView;
  if (/^\/dashboard\/schools\/[^/]+\/onboarding/.test(pathname)) return P.schoolOnboardingReview;
  if (pathname.startsWith('/dashboard/communication/notice-board')) return P.communicationNoticeBoardView;
  if (pathname.startsWith('/dashboard/communication/send-email')) return P.communicationEmailSend;
  if (pathname.startsWith('/dashboard/communication/send-sms')) return P.communicationSmsSend;
  if (pathname.startsWith('/dashboard/communication/send-push')) return P.communicationPushSend;
  if (pathname.startsWith('/dashboard/communication/logs')) return P.communicationEmailLogView;
  if (pathname.startsWith('/dashboard/communication/push-logs')) return P.communicationPushLogView;
  if (pathname.startsWith('/dashboard/communication/scheduled-logs')) return P.communicationScheduledLogView;
  if (pathname.startsWith('/dashboard/communication/login-credentials')) return P.communicationLoginCredentialsSend;
  if (pathname.startsWith('/dashboard/communication/email-templates')) return P.communicationEmailTemplateView;
  if (pathname.startsWith('/dashboard/communication/sms-templates')) return P.communicationSmsTemplateView;
  if (pathname.startsWith('/dashboard/communication/push-templates')) return P.communicationPushTemplateView;

  if (pathname.startsWith('/dashboard/teachers/add')) return P.teachersAdd;
  if (pathname.startsWith('/dashboard/teachers/onboarding')) return P.teacherOnboardingView;
  if (/^\/dashboard\/teachers\/[^/]+\/(onboarding|credentials|assignments|readiness)/.test(pathname)) return P.teacherOnboardingView;
  if (pathname.startsWith('/dashboard/teachers')) return P.teachersList;
  if (pathname.startsWith('/dashboard/staff/add')) return P.staffCreate;
  if (pathname.startsWith('/dashboard/staff/attendance')) return P.staffAttendanceView;
  if (pathname.startsWith('/dashboard/staff')) return P.staffView;
  if (pathname.startsWith('/dashboard/leave/requests')) return P.leaveApproveView;
  if (pathname.startsWith('/dashboard/leave/my')) return P.leaveApplyView;
  if (pathname.startsWith('/dashboard/fees/groups')) return P.feesGroupsView;
  if (pathname.startsWith('/dashboard/fees/types')) return P.feesTypesView;
  if (pathname.startsWith('/dashboard/fees/masters')) return P.feesMastersView;
  if (pathname.startsWith('/dashboard/fees/collection')) return P.feesCollectionView;
  if (pathname.startsWith('/dashboard/fees/discounts')) return P.feesDiscountsView;
  if (pathname.startsWith('/dashboard/fees/reports')) return P.feesReportsView;
  if (pathname.startsWith('/dashboard/fees')) return P.feesOverviewView;
  if (pathname.startsWith('/dashboard/accounts/expenses')) return P.expensesView;
  if (pathname.startsWith('/dashboard/payroll/report')) return P.payrollReport;
  if (pathname.startsWith('/dashboard/payroll')) return P.payrollView;

  if (pathname.startsWith('/dashboard/timetable')) return P.academicsSetup;
  if (pathname.startsWith('/dashboard/academics/exams/centers')) return P.examCenterView;
  if (pathname.startsWith('/dashboard/academics/exams/rooms')) return P.examRoomView;
  if (pathname.startsWith('/dashboard/academics/exams/seating')) return P.examSeatingView;
  if (pathname.startsWith('/dashboard/academics/exams/invigilators')) return P.examInvigilatorView;
  if (pathname.startsWith('/dashboard/academics/exams/hall-tickets')) return P.examHallticketView;
  if (pathname.startsWith('/dashboard/academics/exams')) return P.academicsExams;
  if (pathname.startsWith('/dashboard/academics/marks')) return P.academicsMarks;
  if (pathname.startsWith('/dashboard/academics')) return P.academicsSetup;
  if (pathname.startsWith('/dashboard/dormitory')) return P.dormitoryView;
  if (pathname.startsWith('/dashboard/transport')) return P.transportView;
  if (pathname.startsWith('/dashboard/homework')) return P.homeworkView;
  if (pathname.startsWith('/dashboard/library')) return P.libraryView;

  if (pathname.startsWith('/dashboard/students/add')) return P.studentsAdd;
  if (pathname.startsWith('/dashboard/students/attendance')) return P.attendanceView;
  if (pathname.startsWith('/dashboard/students/groups')) return P.studentGroupView;
  if (pathname.startsWith('/dashboard/students/promotion')) return P.studentPromoteView;
  if (pathname.startsWith('/dashboard/students/disabled')) return P.studentDisabledView;
  if (pathname.startsWith('/dashboard/students/transfers')) return P.studentsTransfers;
  if (pathname.startsWith('/dashboard/students')) return P.studentsList;
  if (pathname.startsWith('/dashboard/id-cards')) return P.idcardsView;

  if (pathname.startsWith('/dashboard/attendance')) return P.attendanceView;
  if (pathname.startsWith('/dashboard/institution-setup')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/payment-methods')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/fee-challan-details')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/role-permissions')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/base-setup')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/sessions')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/holidays')) return P.academicsSetup;
  if (pathname.startsWith('/dashboard/sms-settings')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/settings')) return P.settingsAccess;
  if (pathname.startsWith('/dashboard/support')) return P.supportView;
  if (pathname.startsWith('/dashboard/audit')) return P.auditView;

  return null;
};
