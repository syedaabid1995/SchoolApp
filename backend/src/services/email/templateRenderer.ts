import type { EmailIntent } from './email.types';

type EmailTemplate = {
  namespace: 'platform' | 'tenant';
  key: string;
  subject: string;
  body: string;
};

const templates: Partial<Record<EmailIntent, EmailTemplate>> = {
  SCHOOL_CREATED: {
    namespace: 'platform',
    key: 'platform.school-created',
    subject: 'School created on Akademifyy',
    body: 'The school {{schoolName}} has been created successfully. Login URL: {{loginUrl}}',
  },
  SCHOOL_ADMIN_CREATED: {
    namespace: 'platform',
    key: 'platform.school-admin-credentials',
    subject: 'Your Akademifyy school admin account',
    body: [
      'Hello {{recipientName}},',
      '',
      'Your school admin account for {{schoolName}} is ready.',
      'Login URL: {{loginUrl}}',
      'Email: {{email}}',
      'Temporary Password: {{tempPassword}}',
      '',
      'Please sign in and change your password immediately.',
    ].join('\n'),
  },
  WELCOME: {
    namespace: 'platform',
    key: 'platform.welcome',
    subject: 'Welcome to Akademifyy',
    body: 'Welcome to Akademifyy. Your account is ready.',
  },
  TRIAL_ACTIVATED: {
    namespace: 'platform',
    key: 'platform.trial-activated',
    subject: 'Akademifyy trial activated',
    body: '{{body}}',
  },
  SUBSCRIPTION_ACTIVATED: {
    namespace: 'platform',
    key: 'platform.subscription-activated',
    subject: 'Akademifyy subscription activated',
    body: '{{body}}',
  },
  PASSWORD_RESET: {
    namespace: 'platform',
    key: 'platform.password-reset',
    subject: 'Reset your password',
    body: [
      'We received a request to reset your password.',
      'Open this secure link to continue: {{resetLink}}',
      'This link expires at {{expiresAt}}.',
      'If you did not request this, you can ignore this message.',
    ].join('\n\n'),
  },
  PASSWORD_CHANGED: {
    namespace: 'platform',
    key: 'platform.password-changed',
    subject: 'Your password was changed',
    body: 'Your password was changed successfully. If this was not you, contact support immediately.',
  },
  LOGIN_OTP: {
    namespace: 'platform',
    key: 'platform.login-otp',
    subject: 'Your login verification code',
    body: [
      'Your verification code is {{otp}}.',
      'This code expires at {{expiresAt}}.',
      'If you did not request this code, contact support immediately.',
    ].join('\n\n'),
  },
  MFA_OTP: {
    namespace: 'platform',
    key: 'platform.login-otp',
    subject: 'Your verification code',
    body: [
      'Your verification code is {{otp}}.',
      'This code expires at {{expiresAt}}.',
      'If you did not request this code, contact support immediately.',
    ].join('\n\n'),
  },
  DEMO_APPROVAL: {
    namespace: 'platform',
    key: 'platform.demo-approval',
    subject: 'Your Akademifyy demo access is ready',
    body: [
      'Hello {{recipientName}},',
      'Your Akademifyy demo request has been approved.',
      'Use this link within 24 hours: {{demoUrl}}',
      'This link expires at {{expiresAt}}.',
      'If you did not request this demo, you can ignore this email.',
    ].join('\n\n'),
  },
  BILLING: {
    namespace: 'platform',
    key: 'platform.billing',
    subject: 'Akademifyy billing update',
    body: '{{body}}',
  },
  PAYMENT_RECEIPT: {
    namespace: 'platform',
    key: 'platform.receipt',
    subject: 'Akademifyy payment receipt',
    body: '{{body}}',
  },
  SECURITY_ALERT: {
    namespace: 'platform',
    key: 'platform.security',
    subject: 'Akademifyy security alert',
    body: '{{body}}',
  },
  PLATFORM_NOTIFICATION: {
    namespace: 'platform',
    key: 'platform.notification',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  ATTENDANCE: {
    namespace: 'tenant',
    key: 'tenant.attendance',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  HOMEWORK: {
    namespace: 'tenant',
    key: 'tenant.homework',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  CIRCULAR: {
    namespace: 'tenant',
    key: 'tenant.circular',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  NOTICE: {
    namespace: 'tenant',
    key: 'tenant.notice',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  FEE_REMINDER: {
    namespace: 'tenant',
    key: 'tenant.fee-reminder',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  EXAM: {
    namespace: 'tenant',
    key: 'tenant.exam',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  PARENT_COMMUNICATION: {
    namespace: 'tenant',
    key: 'tenant.parent',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  TEACHER_COMMUNICATION: {
    namespace: 'tenant',
    key: 'tenant.teacher',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  STUDENT_COMMUNICATION: {
    namespace: 'tenant',
    key: 'tenant.communication',
    subject: '{{subject}}',
    body: '{{body}}',
  },
  GENERAL_COMMUNICATION: {
    namespace: 'tenant',
    key: 'tenant.communication',
    subject: '{{subject}}',
    body: '{{body}}',
  },
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderText = (value: string, data: Record<string, unknown>) =>
  Object.keys(data).reduce((result, key) => {
    const replacement = String(data[key] ?? '');
    return result.replace(new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g'), replacement);
  }, value);

export const getEmailTemplate = (intent: EmailIntent) => templates[intent] ?? null;

export const renderEmailTemplate = (params: {
  intent: EmailIntent;
  subject?: string;
  body?: string;
  html?: string;
  data?: Record<string, unknown>;
}) => {
  const template = getEmailTemplate(params.intent);
  const data = {
    ...(params.data ?? {}),
    ...(params.subject !== undefined ? { subject: params.subject } : {}),
    ...(params.body !== undefined ? { body: params.body } : {}),
  };
  const subject = params.subject ?? template?.subject ?? 'Notification';
  const body = params.body ?? template?.body ?? '';

  return {
    templateKey: template?.key ?? null,
    subject: renderText(subject, data),
    body: renderText(body, data),
    html: params.html ? renderText(params.html, data) : undefined,
  };
};
