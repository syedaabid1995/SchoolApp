import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export const MODULE_FEATURE_KEYS = [
  'module_ai_assistant',
  'module_attendance',
  'module_academics',
  'module_timetable',
  'module_exams',
  'module_fees',
  'module_expenses',
  'module_library',
  'module_transport',
  'module_homework',
  'module_support',
  'module_reports',
  'module_messaging',
  'module_parent_portal',
  'module_id_cards',
  'feature_student_promotion',
  'feature_fee_collection',
  'feature_fee_reports',
  'feature_dashboard',
  'feature_reports_center',
  'feature_bulk_imports',
  'feature_schools',
  'feature_users',
  'feature_subscriptions',
  'feature_billing',
  'feature_catalog',
  'feature_demo_requests',
  'feature_support_tickets',
  'feature_audit_logs',
  'feature_system_health',
  'feature_settings_brand',
  'feature_settings_security',
  'feature_settings_feature_flags',
  'feature_settings_modules',
  'feature_settings_access',
  'feature_settings_compliance',
  'feature_backups',
  'feature_settings_advanced',
  'feature_change_password',
  'feature_messaging_providers',
  'feature_send_push',
  'feature_communication_logs',
  'feature_push_templates',
  'feature_onboarding_readiness',
  'feature_academic_setup',
  'feature_attendance_settings',
  'feature_student_list',
  'feature_add_student',
  'feature_staff_list',
  'feature_teacher_onboarding',
  'feature_add_teacher',
  'feature_mark_attendance',
  'feature_student_attendance',
  'feature_staff_attendance',
  'feature_apply_leave',
  'feature_leave_management',
  'feature_exams',
  'feature_marks',
  'feature_exam_centers',
  'feature_exam_rooms',
  'feature_exam_seating',
  'feature_exam_invigilators',
  'feature_exam_hall_tickets',
  'feature_fee_overview',
  'feature_fee_groups',
  'feature_fee_types',
  'feature_fee_masters',
  'feature_fee_discounts',
  'feature_notice_board',
  'feature_send_email',
  'feature_send_sms',
  'feature_login_credentials_send',
  'feature_email_templates',
  'feature_sms_templates',
  'feature_dormitory',
  'feature_payroll',
  'feature_payroll_report',
  'feature_payment_methods',
  'feature_fee_challan',
  'feature_role_permissions',
  'feature_plans',
  'feature_branding',
  'feature_base_setup',
] as const;

export type ModuleFeatureKey = (typeof MODULE_FEATURE_KEYS)[number];

export const MODULE_FEATURE_DEFINITIONS: Array<{
  key: ModuleFeatureKey;
  name: string;
  description: string;
}> = [
  { key: 'module_ai_assistant', name: 'AI Assistant', description: 'AI assistant page, chat, and confirmed assistant actions.' },
  { key: 'module_attendance', name: 'Attendance', description: 'Attendance pages and related workflows.' },
  { key: 'module_academics', name: 'Academics', description: 'Academic setup, classes, sections, and terms.' },
  { key: 'module_timetable', name: 'Timetable', description: 'Scheduling and timetable management.' },
  { key: 'module_exams', name: 'Exams', description: 'Exams, marks upload, and results workflows.' },
  { key: 'module_fees', name: 'Fees', description: 'Fee collection and finance workflows.' },
  { key: 'module_expenses', name: 'Expenses', description: 'School expense tracking, categories, approvals, and exports.' },
  { key: 'module_library', name: 'Library', description: 'Library and book issue workflows.' },
  { key: 'module_transport', name: 'Transport', description: 'Routes, vehicles, and transport assignment.' },
  { key: 'module_homework', name: 'Homework', description: 'Homework creation, evaluation, and reporting workflows.' },
  { key: 'module_support', name: 'Support', description: 'School support tickets and replies.' },
  { key: 'module_reports', name: 'Reports', description: 'Report landing pages and exports.' },
  { key: 'module_messaging', name: 'Messaging', description: 'SMS, notifications, and provider integrations.' },
  { key: 'module_parent_portal', name: 'Parent Portal', description: 'Parent portal access and school-facing communication.' },
  { key: 'module_id_cards', name: 'ID Cards', description: 'Student ID card generation workflows.' },
  { key: 'feature_student_promotion', name: 'Student Promotion', description: 'Students > Promotion page and promotion API actions.' },
  { key: 'feature_fee_collection', name: 'Fee Collection', description: 'Fees > Fee Collection page, payment collection, reversal, and collection lookup APIs.' },
  { key: 'feature_fee_reports', name: 'Fee Reports', description: 'Fees > Fee Reports page, report generation, and report export APIs.' },
  { key: 'feature_dashboard', name: 'Dashboard', description: 'Dashboard landing page menu entry.' },
  { key: 'feature_reports_center', name: 'Reports Center', description: 'Reports center pages and menu entry.' },
  { key: 'feature_bulk_imports', name: 'Bulk Imports', description: 'Bulk import pages and menu entries.' },
  { key: 'feature_schools', name: 'Schools', description: 'Platform school management pages.' },
  { key: 'feature_users', name: 'Users', description: 'User management pages and menu entries.' },
  { key: 'feature_subscriptions', name: 'Subscriptions', description: 'Subscription management pages.' },
  { key: 'feature_billing', name: 'Billing', description: 'Billing pages.' },
  { key: 'feature_catalog', name: 'Catalog', description: 'Catalog and module catalog pages.' },
  { key: 'feature_demo_requests', name: 'Demo Requests', description: 'Demo request pages.' },
  { key: 'feature_support_tickets', name: 'Support Tickets', description: 'Support ticket pages.' },
  { key: 'feature_audit_logs', name: 'Audit Logs', description: 'Audit log pages.' },
  { key: 'feature_system_health', name: 'System Health', description: 'System health pages.' },
  { key: 'feature_settings_brand', name: 'Settings: Branding & Theme', description: 'Platform settings branding tab.' },
  { key: 'feature_settings_security', name: 'Settings: Security', description: 'Platform settings security tab.' },
  { key: 'feature_settings_feature_flags', name: 'Settings: Feature Flags', description: 'Platform settings feature flags tab.' },
  { key: 'feature_settings_modules', name: 'Settings: Modules', description: 'Platform settings modules tab.' },
  { key: 'feature_settings_access', name: 'Settings: Access', description: 'Platform settings access tab.' },
  { key: 'feature_settings_compliance', name: 'Settings: Compliance', description: 'Platform settings compliance tab.' },
  { key: 'feature_backups', name: 'Backups', description: 'Backup pages.' },
  { key: 'feature_settings_advanced', name: 'Settings: Advanced', description: 'Platform settings advanced tab.' },
  { key: 'feature_change_password', name: 'Change Password', description: 'Change password page menu entry.' },
  { key: 'feature_messaging_providers', name: 'Messaging Providers', description: 'Messaging provider settings pages.' },
  { key: 'feature_send_push', name: 'Send Push', description: 'Push notification send page.' },
  { key: 'feature_communication_logs', name: 'Communication Logs', description: 'Communication log pages.' },
  { key: 'feature_push_templates', name: 'Push Templates', description: 'Push template pages.' },
  { key: 'feature_onboarding_readiness', name: 'Onboarding Readiness', description: 'School onboarding readiness pages.' },
  { key: 'feature_academic_setup', name: 'Academic Setup', description: 'Academic setup page.' },
  { key: 'feature_attendance_settings', name: 'Attendance Settings', description: 'Attendance settings page.' },
  { key: 'feature_student_list', name: 'Student List', description: 'Student list and student detail pages.' },
  { key: 'feature_add_student', name: 'Add Student', description: 'Add student page.' },
  { key: 'feature_staff_list', name: 'Employee List', description: 'Staff list and staff detail pages.' },
  { key: 'feature_teacher_onboarding', name: 'Teacher Onboarding', description: 'Teacher onboarding pages.' },
  { key: 'feature_add_teacher', name: 'Add Teacher', description: 'Add staff and teacher pages.' },
  { key: 'feature_mark_attendance', name: 'Mark Attendance', description: 'Mark own attendance page.' },
  { key: 'feature_student_attendance', name: 'Student Attendance', description: 'Student attendance pages.' },
  { key: 'feature_staff_attendance', name: 'Staff Attendance', description: 'Staff attendance pages.' },
  { key: 'feature_apply_leave', name: 'Apply Leave', description: 'Apply leave page.' },
  { key: 'feature_leave_management', name: 'Leave Management', description: 'Leave request management pages.' },
  { key: 'feature_exams', name: 'Exams', description: 'Exam setup pages.' },
  { key: 'feature_marks', name: 'Marks', description: 'Marks pages.' },
  { key: 'feature_exam_centers', name: 'Exam Centers', description: 'Exam center pages.' },
  { key: 'feature_exam_rooms', name: 'Exam Rooms', description: 'Exam room pages.' },
  { key: 'feature_exam_seating', name: 'Exam Seating', description: 'Exam seating pages.' },
  { key: 'feature_exam_invigilators', name: 'Exam Invigilators', description: 'Exam invigilator pages.' },
  { key: 'feature_exam_hall_tickets', name: 'Exam Hall Tickets', description: 'Exam hall ticket pages.' },
  { key: 'feature_fee_overview', name: 'Fee Overview', description: 'Fee overview page.' },
  { key: 'feature_fee_groups', name: 'Fee Groups', description: 'Fee group pages.' },
  { key: 'feature_fee_types', name: 'Fee Types', description: 'Fee type pages.' },
  { key: 'feature_fee_masters', name: 'Fee Masters', description: 'Fee master pages.' },
  { key: 'feature_fee_discounts', name: 'Fee Discounts', description: 'Fee discount pages.' },
  { key: 'feature_notice_board', name: 'Notice Board', description: 'Notice board pages.' },
  { key: 'feature_send_email', name: 'Send Email', description: 'Send email page.' },
  { key: 'feature_send_sms', name: 'Send SMS', description: 'Send SMS page.' },
  { key: 'feature_login_credentials_send', name: 'Login Credentials Send', description: 'Login credential communication page.' },
  { key: 'feature_email_templates', name: 'Email Templates', description: 'Email template pages.' },
  { key: 'feature_sms_templates', name: 'SMS Templates', description: 'SMS template pages.' },
  { key: 'feature_dormitory', name: 'Dormitory', description: 'Dormitory pages.' },
  { key: 'feature_payroll', name: 'Payroll', description: 'Payroll pages.' },
  { key: 'feature_payroll_report', name: 'Payroll Report', description: 'Payroll report pages.' },
  { key: 'feature_payment_methods', name: 'Payment Methods', description: 'Payment method pages.' },
  { key: 'feature_fee_challan', name: 'Fee Challan', description: 'Fee challan detail pages.' },
  { key: 'feature_role_permissions', name: 'Role Permissions', description: 'Role permission pages.' },
  { key: 'feature_plans', name: 'Plans', description: 'Subscription plan pages.' },
  { key: 'feature_branding', name: 'Branding', description: 'School branding page.' },
  { key: 'feature_base_setup', name: 'Base Setup', description: 'School base setup page.' },
];

export const ensureModuleFeatureFlags = async () => {
  const existingFlags = await prisma.featureFlag.findMany({
    where: { key: { in: [...MODULE_FEATURE_KEYS] } },
    select: { key: true, name: true, description: true },
  });
  const existingByKey = new Map(existingFlags.map((flag) => [flag.key, flag]));
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (const definition of MODULE_FEATURE_DEFINITIONS) {
    const existing = existingByKey.get(definition.key);
    if (!existing) {
      operations.push(
        prisma.featureFlag.create({
          data: {
            key: definition.key,
            name: definition.name,
            description: definition.description,
            status: 'ENABLED',
          },
        }),
      );
      continue;
    }

    if (existing.name !== definition.name || existing.description !== definition.description) {
      operations.push(
        prisma.featureFlag.update({
          where: { key: definition.key },
          data: {
            name: definition.name,
            description: definition.description,
          },
        }),
      );
    }
  }

  if (!operations.length) return existingFlags;
  return prisma.$transaction(operations);
};

export const isFeatureEnabled = async (params: {
  key: string;
  schoolId?: string | null;
  userId?: string | null;
}) => {
  const { key, schoolId, userId } = params;

  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    include: { overrides: true },
  });

  if (!flag) return false;

  const userOverride = flag.overrides.find((override) => override.userId === userId);
  if (userOverride) return userOverride.status === 'ENABLED';

  const schoolOverride = flag.overrides.find((override) => override.schoolId === schoolId);
  if (schoolOverride) return schoolOverride.status === 'ENABLED';

  return flag.status === 'ENABLED';
};

const moduleFeatureKeySet = new Set<string>(MODULE_FEATURE_KEYS);

export const isModuleFeatureKey = (key: string): key is ModuleFeatureKey =>
  moduleFeatureKeySet.has(key);

export const getEffectiveModuleFeatureFlags = async (params: {
  schoolId?: string | null;
  userId?: string | null;
} = {}) => {
  const { schoolId, userId } = params;
  const flags = await prisma.featureFlag.findMany({
    where: { key: { in: [...MODULE_FEATURE_KEYS] } },
    include: { overrides: true },
  });
  const flagsByKey = new Map(flags.map((flag) => [flag.key, flag]));

  return Object.fromEntries(
    MODULE_FEATURE_KEYS.map((key) => {
      const flag = flagsByKey.get(key);
      if (!flag) return [key, true];
      if (flag.status === 'DISABLED') return [key, false];

      const userOverride = userId
        ? flag.overrides.find((override) => override.userId === userId)
        : undefined;
      if (userOverride) return [key, userOverride.status === 'ENABLED'];

      const schoolOverride = schoolId
        ? flag.overrides.find((override) => override.schoolId === schoolId && !override.userId)
        : undefined;
      if (schoolOverride) return [key, schoolOverride.status === 'ENABLED'];

      return [key, flag.status === 'ENABLED'];
    }),
  ) as Record<ModuleFeatureKey, boolean>;
};

export const isModuleFeatureEnabled = async (params: {
  key: ModuleFeatureKey;
  schoolId?: string | null;
  userId?: string | null;
}) => {
  const flags = await getEffectiveModuleFeatureFlags({
    schoolId: params.schoolId,
    userId: params.userId,
  });
  return flags[params.key] !== false;
};

export const assertModuleFeatureEnabled = async (params: {
  key: ModuleFeatureKey;
  schoolId?: string | null;
  userId?: string | null;
  message?: string;
}) => {
  const enabled = await isModuleFeatureEnabled(params);
  if (!enabled) {
    throw new HttpError(403, params.message ?? 'This module is disabled by the platform administrator');
  }
};

export const getConfigValue = async (params: {
  key: string;
  schoolId?: string | null;
}) => {
  const { key, schoolId } = params;

  const config = await prisma.configEntry.findUnique({ where: { key } });
  if (!config) return null;

  if (schoolId) {
    const override = await prisma.tenantConfigOverride.findUnique({
      where: { configId_schoolId: { configId: config.id, schoolId } },
    });

    if (override) {
      return override.value;
    }
  }

  return config.value;
};
