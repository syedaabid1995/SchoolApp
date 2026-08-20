export const ModuleFeatureKeys = {
  aiAssistant: 'module_ai_assistant',
  attendance: 'module_attendance',
  academics: 'module_academics',
  timetable: 'module_timetable',
  exams: 'module_exams',
  fees: 'module_fees',
  expenses: 'module_expenses',
  library: 'module_library',
  transport: 'module_transport',
  homework: 'module_homework',
  support: 'module_support',
  reports: 'module_reports',
  messaging: 'module_messaging',
  parentPortal: 'module_parent_portal',
  idCards: 'module_id_cards',
  dashboard: 'feature_dashboard',
  reportsCenter: 'feature_reports_center',
  bulkImports: 'feature_bulk_imports',
  schools: 'feature_schools',
  users: 'feature_users',
  subscriptions: 'feature_subscriptions',
  billing: 'feature_billing',
  catalog: 'feature_catalog',
  demoRequests: 'feature_demo_requests',
  supportTickets: 'feature_support_tickets',
  auditLogs: 'feature_audit_logs',
  systemHealth: 'feature_system_health',
  settingsBrand: 'feature_settings_brand',
  settingsSecurity: 'feature_settings_security',
  settingsFeatureFlags: 'feature_settings_feature_flags',
  settingsModules: 'feature_settings_modules',
  settingsAccess: 'feature_settings_access',
  settingsCompliance: 'feature_settings_compliance',
  backups: 'feature_backups',
  settingsAdvanced: 'feature_settings_advanced',
  changePassword: 'feature_change_password',
  messagingProviders: 'feature_messaging_providers',
  sendPush: 'feature_send_push',
  communicationLogs: 'feature_communication_logs',
  pushTemplates: 'feature_push_templates',
  onboardingReadiness: 'feature_onboarding_readiness',
  academicSetup: 'feature_academic_setup',
  attendanceSettings: 'feature_attendance_settings',
  studentList: 'feature_student_list',
  addStudent: 'feature_add_student',
  studentPromotion: 'feature_student_promotion',
  staffList: 'feature_staff_list',
  teacherOnboarding: 'feature_teacher_onboarding',
  addTeacher: 'feature_add_teacher',
  markAttendance: 'feature_mark_attendance',
  studentAttendance: 'feature_student_attendance',
  staffAttendance: 'feature_staff_attendance',
  applyLeave: 'feature_apply_leave',
  leaveManagement: 'feature_leave_management',
  examList: 'feature_exams',
  marks: 'feature_marks',
  examCenters: 'feature_exam_centers',
  examRooms: 'feature_exam_rooms',
  examSeating: 'feature_exam_seating',
  examInvigilators: 'feature_exam_invigilators',
  examHallTickets: 'feature_exam_hall_tickets',
  feeOverview: 'feature_fee_overview',
  feeGroups: 'feature_fee_groups',
  feeTypes: 'feature_fee_types',
  feeMasters: 'feature_fee_masters',
  feeCollection: 'feature_fee_collection',
  feeDiscounts: 'feature_fee_discounts',
  feeReports: 'feature_fee_reports',
  noticeBoard: 'feature_notice_board',
  sendEmail: 'feature_send_email',
  sendSms: 'feature_send_sms',
  loginCredentialsSend: 'feature_login_credentials_send',
  emailTemplates: 'feature_email_templates',
  smsTemplates: 'feature_sms_templates',
  dormitory: 'feature_dormitory',
  payroll: 'feature_payroll',
  payrollReport: 'feature_payroll_report',
  paymentMethods: 'feature_payment_methods',
  feeChallan: 'feature_fee_challan',
  rolePermissions: 'feature_role_permissions',
  plans: 'feature_plans',
  branding: 'feature_branding',
  baseSetup: 'feature_base_setup',
} as const;

export type ModuleFeatureKey = (typeof ModuleFeatureKeys)[keyof typeof ModuleFeatureKeys];
export type ModuleFeatureFlags = Partial<Record<ModuleFeatureKey | string, boolean>>;

type RouteFeatureRule = {
  path: string;
  featureKeys: ModuleFeatureKey[];
  match?: 'exact' | 'prefix';
  tab?: string;
};

const routeFeatureRules: RouteFeatureRule[] = [
  { path: '/dashboard', match: 'exact', featureKeys: [ModuleFeatureKeys.dashboard] },
  { path: '/dashboard/reports', match: 'prefix', featureKeys: [ModuleFeatureKeys.reports, ModuleFeatureKeys.reportsCenter] },
  { path: '/dashboard/accounts/expenses', match: 'prefix', featureKeys: [ModuleFeatureKeys.expenses] },
  { path: '/dashboard/imports', match: 'prefix', featureKeys: [ModuleFeatureKeys.bulkImports] },
  { path: '/dashboard/schools', match: 'prefix', featureKeys: [ModuleFeatureKeys.schools] },
  { path: '/dashboard/users', match: 'prefix', featureKeys: [ModuleFeatureKeys.users] },
  { path: '/dashboard/subscriptions', match: 'prefix', featureKeys: [ModuleFeatureKeys.subscriptions] },
  { path: '/dashboard/billing', match: 'prefix', featureKeys: [ModuleFeatureKeys.billing] },
  { path: '/dashboard/catalog', match: 'prefix', featureKeys: [ModuleFeatureKeys.catalog] },
  { path: '/dashboard/demo-requests', match: 'prefix', featureKeys: [ModuleFeatureKeys.demoRequests] },
  { path: '/dashboard/support', match: 'prefix', featureKeys: [ModuleFeatureKeys.support, ModuleFeatureKeys.supportTickets] },
  { path: '/dashboard/audit', match: 'prefix', featureKeys: [ModuleFeatureKeys.auditLogs] },
  { path: '/dashboard/system-health', match: 'prefix', featureKeys: [ModuleFeatureKeys.systemHealth] },
  { path: '/dashboard/settings', match: 'exact', tab: 'brand', featureKeys: [ModuleFeatureKeys.settingsBrand] },
  { path: '/dashboard/settings', match: 'exact', tab: 'security', featureKeys: [ModuleFeatureKeys.settingsSecurity] },
  { path: '/dashboard/settings', match: 'exact', tab: 'features', featureKeys: [ModuleFeatureKeys.settingsFeatureFlags] },
  { path: '/dashboard/settings', match: 'exact', tab: 'modules', featureKeys: [ModuleFeatureKeys.settingsModules] },
  { path: '/dashboard/settings', match: 'exact', tab: 'access', featureKeys: [ModuleFeatureKeys.settingsAccess] },
  { path: '/dashboard/settings', match: 'exact', tab: 'compliance', featureKeys: [ModuleFeatureKeys.settingsCompliance] },
  { path: '/dashboard/settings', match: 'exact', tab: 'advanced', featureKeys: [ModuleFeatureKeys.settingsAdvanced] },
  { path: '/dashboard/backups', match: 'prefix', featureKeys: [ModuleFeatureKeys.backups] },
  { path: '/change-password', match: 'exact', featureKeys: [ModuleFeatureKeys.changePassword] },
  { path: '/dashboard/settings', match: 'exact', tab: 'messaging', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.messagingProviders] },
  { path: '/dashboard/communication/send-push', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.sendPush] },
  { path: '/dashboard/communication/logs', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.communicationLogs] },
  { path: '/dashboard/communication/push-templates', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.pushTemplates] },
  { path: '/dashboard/onboarding', match: 'prefix', featureKeys: [ModuleFeatureKeys.onboardingReadiness] },
  { path: '/dashboard/assistant', match: 'prefix', featureKeys: [ModuleFeatureKeys.aiAssistant] },
  { path: '/dashboard/academics/exams/hall-tickets', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examHallTickets] },
  { path: '/dashboard/academics/exams/invigilators', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examInvigilators] },
  { path: '/dashboard/academics/exams/seating', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examSeating] },
  { path: '/dashboard/academics/exams/rooms', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examRooms] },
  { path: '/dashboard/academics/exams/centers', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examCenters] },
  { path: '/dashboard/academics/exams', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.examList] },
  { path: '/dashboard/academics/marks', match: 'prefix', featureKeys: [ModuleFeatureKeys.exams, ModuleFeatureKeys.marks] },
  { path: '/dashboard/academics', match: 'prefix', featureKeys: [ModuleFeatureKeys.academics, ModuleFeatureKeys.academicSetup] },
  { path: '/dashboard/timetable', match: 'prefix', featureKeys: [ModuleFeatureKeys.timetable] },
  { path: '/dashboard/attendance/settings', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.attendanceSettings] },
  { path: '/dashboard/students/add', match: 'prefix', featureKeys: [ModuleFeatureKeys.addStudent] },
  { path: '/dashboard/students/promotion', match: 'prefix', featureKeys: [ModuleFeatureKeys.studentPromotion] },
  { path: '/dashboard/students/attendance', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.studentAttendance] },
  { path: '/dashboard/students', match: 'prefix', featureKeys: [ModuleFeatureKeys.studentList] },
  { path: '/dashboard/id-cards', match: 'prefix', featureKeys: [ModuleFeatureKeys.idCards] },
  { path: '/dashboard/teachers/onboarding', match: 'prefix', featureKeys: [ModuleFeatureKeys.teacherOnboarding] },
  { path: '/dashboard/staff/add', match: 'prefix', featureKeys: [ModuleFeatureKeys.addTeacher] },
  { path: '/dashboard/staff/attendance', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.staffAttendance] },
  { path: '/dashboard/staff', match: 'prefix', featureKeys: [ModuleFeatureKeys.staffList] },
  { path: '/dashboard/attendance/students/mark', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.studentAttendance] },
  { path: '/dashboard/attendance/my', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.markAttendance] },
  { path: '/dashboard/attendance', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance] },
  { path: '/dashboard/leave/requests', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.leaveManagement] },
  { path: '/dashboard/leave/my', match: 'prefix', featureKeys: [ModuleFeatureKeys.attendance, ModuleFeatureKeys.applyLeave] },
  { path: '/dashboard/fees/collection', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeCollection] },
  { path: '/dashboard/fees/reports', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeReports] },
  { path: '/dashboard/fees/discounts', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeDiscounts] },
  { path: '/dashboard/fees/masters', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeMasters] },
  { path: '/dashboard/fees/types', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeTypes] },
  { path: '/dashboard/fees/groups', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeGroups] },
  { path: '/dashboard/fees/overview', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeOverview] },
  { path: '/dashboard/fees', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees] },
  { path: '/dashboard/homework', match: 'prefix', featureKeys: [ModuleFeatureKeys.homework] },
  { path: '/dashboard/communication/notice-board', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.noticeBoard] },
  { path: '/dashboard/communication/send-email', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.sendEmail] },
  { path: '/dashboard/communication/send-sms', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.sendSms] },
  { path: '/dashboard/communication/login-credentials', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.loginCredentialsSend] },
  { path: '/dashboard/communication/email-templates', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.emailTemplates] },
  { path: '/dashboard/communication/sms-templates', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.smsTemplates] },
  { path: '/dashboard/communication', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging] },
  { path: '/dashboard/transport', match: 'prefix', featureKeys: [ModuleFeatureKeys.transport] },
  { path: '/dashboard/library', match: 'prefix', featureKeys: [ModuleFeatureKeys.library] },
  { path: '/dashboard/dormitory', match: 'prefix', featureKeys: [ModuleFeatureKeys.dormitory] },
  { path: '/dashboard/payroll/report', match: 'prefix', featureKeys: [ModuleFeatureKeys.payrollReport] },
  { path: '/dashboard/payroll', match: 'prefix', featureKeys: [ModuleFeatureKeys.payroll] },
  { path: '/dashboard/payment-methods', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.paymentMethods] },
  { path: '/dashboard/fee-challan-details', match: 'prefix', featureKeys: [ModuleFeatureKeys.fees, ModuleFeatureKeys.feeChallan] },
  { path: '/dashboard/role-permissions', match: 'prefix', featureKeys: [ModuleFeatureKeys.rolePermissions] },
  { path: '/dashboard/plans', match: 'prefix', featureKeys: [ModuleFeatureKeys.plans] },
  { path: '/dashboard/settings/branding', match: 'prefix', featureKeys: [ModuleFeatureKeys.branding] },
  { path: '/dashboard/base-setup', match: 'prefix', featureKeys: [ModuleFeatureKeys.baseSetup] },
  { path: '/dashboard/sms-settings', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.messagingProviders] },
  { path: '/dashboard/settings/sms', match: 'prefix', featureKeys: [ModuleFeatureKeys.messaging, ModuleFeatureKeys.messagingProviders] },
  { path: '/parent', match: 'prefix', featureKeys: [ModuleFeatureKeys.parentPortal] },
];

const matchesRule = (rule: RouteFeatureRule, cleanPath: string, tab: string | null) => {
  if (rule.tab !== undefined && rule.tab !== (tab || 'brand')) return false;
  if ((rule.match ?? 'prefix') === 'exact') return cleanPath === rule.path;
  return cleanPath === rule.path || cleanPath.startsWith(`${rule.path}/`);
};

export const moduleFeaturesForPath = (pathname: string) => {
  const [cleanPath, query = ''] = pathname.split('?');
  const tab = new URLSearchParams(query).get('tab');
  const matches = routeFeatureRules.filter((rule) => matchesRule(rule, cleanPath, tab));
  if (!matches.length) return [];

  const longestPathLength = Math.max(...matches.map((rule) => rule.path.length + (rule.tab ? rule.tab.length : 0)));
  const mostSpecificRules = matches.filter((rule) => rule.path.length + (rule.tab ? rule.tab.length : 0) === longestPathLength);
  return [...new Set(mostSpecificRules.flatMap((rule) => rule.featureKeys))];
};

export const moduleFeatureForPath = (pathname: string) => moduleFeaturesForPath(pathname)[0] ?? null;

export const isModuleEnabled = (moduleFlags: ModuleFeatureFlags | null | undefined, key: ModuleFeatureKey) =>
  moduleFlags?.[key] !== false;

export const isPathModuleEnabled = (moduleFlags: ModuleFeatureFlags | null | undefined, pathname: string) => {
  const featureKeys = moduleFeaturesForPath(pathname);
  return featureKeys.every((featureKey) => isModuleEnabled(moduleFlags, featureKey));
};
