import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { sendNotification } from './notification.service';
import { hasActiveMessagingGateway } from './messagingSettings.service';

type AccountOnboardingRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF';
type AccountOnboardingEvent = 'CREATED' | 'REGENERATED';

const resolveSentTo = (mobile?: string | null) => {
  const trimmed = (mobile ?? '').trim();
  return trimmed.length > 0 ? trimmed : env.WHATSAPP_FALLBACK_TO;
};

const isDeliverableEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.local');

const resolveSchoolContext = async (schoolId?: string | null) => {
  if (!schoolId) return null;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, code: true },
  });
  return school ?? null;
};

export const buildAccountOnboardingMessageContent = (params: {
  role: AccountOnboardingRole;
  email: string;
  displayName: string;
  appLabel: string;
  schoolCode: string;
  tempPassword?: string | null;
  loginUrl?: string | null;
  event?: AccountOnboardingEvent;
}) => {
  const loginUrl = params.loginUrl?.trim() || null;
  const event = params.event ?? 'CREATED';
  const bodyIntro =
    event === 'REGENERATED'
      ? `Your ${params.role} login credentials have been regenerated.`
      : `Welcome to ${params.appLabel}. Your ${params.role} account is ready.`;
  const manualIntro =
    event === 'REGENERATED'
      ? `Your ${params.role} login credentials have been regenerated.`
      : `Your ${params.role} account has been created successfully.`;
  const body = [
    `Hello ${params.displayName},`,
    '',
    bodyIntro,
    '',
    `School Code: ${params.schoolCode}`,
    `Login Email: ${params.email}`,
    ...(params.tempPassword ? [`Temporary Password: ${params.tempPassword}`] : []),
    ...(loginUrl ? [`Login URL: ${loginUrl}`] : []),
    '',
    'Please sign in and change your password immediately.',
    'If you did not request this account, contact your school administrator.',
  ].join('\n');

  const manualShareText = [
    `${params.appLabel} - Account Details`,
    '',
    `Hello ${params.displayName},`,
    manualIntro,
    '',
    `School Code: ${params.schoolCode}`,
    `Role: ${params.role}`,
    `Email: ${params.email}`,
    ...(params.tempPassword ? [`Temporary Password: ${params.tempPassword}`] : []),
    ...(loginUrl ? [`Login URL: ${loginUrl}`] : []),
    '',
    'Next steps:',
    '1) Sign in using the credentials above',
    '2) Change your password after first login',
    '',
    'For support, please contact your school administrator.',
  ].join('\n');

  return { body, manualShareText };
};

export const sendAccountCreatedWhatsapp = async (params: {
  role: AccountOnboardingRole;
  email: string;
  mobile?: string | null;
  tempPassword?: string | null;
  fullName?: string | null;
  schoolId?: string | null;
  schoolCode?: string | null;
  loginUrl?: string | null;
  event?: AccountOnboardingEvent;
}) => {
  const sentTo = resolveSentTo(params.mobile);
  const mobile = (params.mobile ?? '').trim();
  const displayName = params.fullName?.trim() || params.email;
  const school = await resolveSchoolContext(params.schoolId);
  const schoolName = school?.name ?? null;
  const schoolCode = params.schoolCode?.trim() || school?.code || 'N/A';
  const loginUrl = params.loginUrl?.trim() || null;
  const appLabel =
    params.role === 'SCHOOL_ADMIN' ? `${schoolName ?? 'School'} Admin Portal` : `${schoolName ?? 'School'} ERP`;
  const { body, manualShareText } = buildAccountOnboardingMessageContent({
    role: params.role,
    email: params.email,
    displayName,
    appLabel,
    schoolCode,
    tempPassword: params.tempPassword,
    loginUrl,
    event: params.event,
  });
  const manualShareUrl = `https://wa.me/${sentTo}?text=${encodeURIComponent(manualShareText)}`;

  const deliveries: Record<
    'EMAIL' | 'WHATSAPP' | 'SMS',
    { attempted: boolean; sent: boolean; logId?: string; error?: string }
  > = {
    EMAIL: { attempted: false, sent: false },
    WHATSAPP: { attempted: false, sent: false },
    SMS: { attempted: false, sent: false },
  };

  const sendIfConfigured = async (channel: 'EMAIL' | 'WHATSAPP' | 'SMS', to: string) => {
    const gatewayActive = await hasActiveMessagingGateway({
      schoolId: params.schoolId ?? null,
      channels: [channel],
    });
    if (!gatewayActive) return;

    deliveries[channel].attempted = true;
    try {
      logger.info(
        { role: params.role, channel, to, email: params.email, schoolId: params.schoolId ?? null },
        'sending account onboarding message',
      );
      const result = await sendNotification({
        schoolId: params.schoolId ?? null,
        userId: null,
        channel,
        data: {
          to,
          subject: `${params.role} account created`,
          body,
        },
      });
      deliveries[channel] = {
        attempted: true,
        sent: result.delivery?.status === 'SENT' || result.delivery?.status === 'QUEUED',
        logId: result.logId,
        error: result.delivery?.error,
      };
    } catch (error) {
      deliveries[channel] = {
        attempted: true,
        sent: false,
        error: error instanceof Error ? error.message : 'Failed to send onboarding message',
      };
      logger.warn(
        {
          err: error,
          role: params.role,
          channel,
          to,
          schoolId: params.schoolId ?? null,
        },
        'failed to send account onboarding message',
      );
    }
  };

  if (params.role !== 'SCHOOL_ADMIN' && isDeliverableEmail(params.email)) {
    await sendIfConfigured('EMAIL', params.email);
  }
  if (mobile) {
    await sendIfConfigured('WHATSAPP', mobile);
    await sendIfConfigured('SMS', mobile);
  }

  const queued = Object.values(deliveries).some((delivery) => delivery.sent);
  if (!queued) {
    logger.warn(
      { role: params.role, sentTo, email: params.email, schoolId: params.schoolId ?? null, deliveries },
      'no active or successful onboarding delivery; manual share required',
    );
  }

  return {
    sentTo,
    queued,
    deliveries,
    manualShareRequired: !queued,
    manualShareText,
    manualShareUrl,
  };
};
