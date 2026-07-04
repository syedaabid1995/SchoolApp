export const PLATFORM_EMAIL_INTENTS = [
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'LOGIN_OTP',
  'MFA_OTP',
  'SCHOOL_CREATED',
  'SCHOOL_ADMIN_CREATED',
  'WELCOME',
  'TRIAL_ACTIVATED',
  'SUBSCRIPTION_ACTIVATED',
  'PAYMENT_RECEIPT',
  'BILLING',
  'DEMO_APPROVAL',
  'SECURITY_ALERT',
  'PLATFORM_NOTIFICATION',
] as const;

export const TENANT_EMAIL_INTENTS = [
  'ATTENDANCE',
  'HOMEWORK',
  'CIRCULAR',
  'NOTICE',
  'FEE_REMINDER',
  'EXAM',
  'PARENT_COMMUNICATION',
  'TEACHER_COMMUNICATION',
  'STUDENT_COMMUNICATION',
  'GENERAL_COMMUNICATION',
] as const;

export type PlatformEmailIntent = (typeof PLATFORM_EMAIL_INTENTS)[number];
export type TenantEmailIntent = (typeof TENANT_EMAIL_INTENTS)[number];
export type EmailIntent = PlatformEmailIntent | TenantEmailIntent;
export type EmailScope = 'PLATFORM' | 'TENANT';

export type EmailSenderIdentity = 'NO_REPLY' | 'INFO' | 'SUPPORT' | 'BILLING' | 'SECURITY';

export const PLATFORM_SENDER_EMAILS: Record<EmailSenderIdentity, string> = {
  NO_REPLY: 'no-reply@akademifyy.in',
  INFO: 'info@akademifyy.in',
  SUPPORT: 'support@akademifyy.in',
  BILLING: 'billing@akademifyy.in',
  SECURITY: 'security@akademifyy.in',
};

const platformIntentSet = new Set<string>(PLATFORM_EMAIL_INTENTS);
const tenantIntentSet = new Set<string>(TENANT_EMAIL_INTENTS);

export const isPlatformEmailIntent = (intent: string): intent is PlatformEmailIntent =>
  platformIntentSet.has(intent);

export const isTenantEmailIntent = (intent: string): intent is TenantEmailIntent =>
  tenantIntentSet.has(intent);

export const emailScopeForIntent = (intent: EmailIntent): EmailScope =>
  isPlatformEmailIntent(intent) ? 'PLATFORM' : 'TENANT';

export const normalizeEmailIntent = (
  value: unknown,
  fallback: EmailIntent,
): EmailIntent => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  if (isPlatformEmailIntent(normalized) || isTenantEmailIntent(normalized)) return normalized;
  return fallback;
};

export const defaultPlatformSenderForIntent = (intent: PlatformEmailIntent): EmailSenderIdentity => {
  if (intent === 'BILLING' || intent === 'PAYMENT_RECEIPT' || intent === 'SUBSCRIPTION_ACTIVATED') {
    return 'BILLING';
  }
  if (intent === 'SECURITY_ALERT' || intent === 'PASSWORD_RESET' || intent === 'PASSWORD_CHANGED') {
    return 'SECURITY';
  }
  if (intent === 'DEMO_APPROVAL' || intent === 'WELCOME') {
    return 'INFO';
  }
  return 'NO_REPLY';
};

export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
  html?: string;
};

export type EmailAuditMetadata = {
  provider: string;
  sender: string;
  recipient: string;
  template?: string | null;
  intent: EmailIntent;
  scope: EmailScope;
  attemptCount?: number;
  durationMs?: number;
  providerMessageId?: string | null;
  failureReason?: string | null;
  queuedAt?: string;
  sentAt?: string;
};

export type EmailQueueJobData = {
  logId: string;
  schoolId?: string | null;
  userId?: string | null;
  intent: EmailIntent;
  senderIdentity?: EmailSenderIdentity;
  templateKey?: string | null;
  to: string;
  subject: string;
  body: string;
  html?: string;
  queuedAt: string;
};

export type EmailProviderDeliveryResult = {
  status: 'SENT' | 'FAILED';
  provider: string;
  sender: string;
  providerId?: string;
  error?: string;
  durationMs: number;
};

export type EmailFacadeDeliveryResult = {
  status: 'QUEUED' | 'SENT' | 'FAILED';
  providerId?: string;
  error?: string;
};

export type EmailDeliveryStatus =
  | 'development_log'
  | 'email_not_configured'
  | 'email_queued'
  | 'email_sent'
  | 'email_failed';
