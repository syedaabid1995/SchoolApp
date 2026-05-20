import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { sendNotification } from './notification.service';
import { hasActiveMessagingGateway } from './messagingSettings.service';

const resolveSentTo = (mobile?: string | null) => {
  const trimmed = (mobile ?? '').trim();
  return trimmed.length > 0 ? trimmed : env.WHATSAPP_FALLBACK_TO;
};

const isDeliverableEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.local');

const resolveSchoolName = async (schoolId?: string | null) => {
  if (!schoolId) return null;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  return school?.name ?? null;
};

export const sendAccountCreatedWhatsapp = async (params: {
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT' | 'ACCOUNTANT' | 'LIBRARIAN' | 'STAFF';
  email: string;
  mobile?: string | null;
  tempPassword?: string | null;
  fullName?: string | null;
  schoolId?: string | null;
}) => {
  const sentTo = resolveSentTo(params.mobile);
  const mobile = (params.mobile ?? '').trim();
  const displayName = params.fullName?.trim() || params.email;
  const schoolName = await resolveSchoolName(params.schoolId);
  const appLabel =
    params.role === 'SCHOOL_ADMIN' ? 'SAAPT School ERP' : `${schoolName ?? 'School'} ERP`;
  const bodyLines = [
    `Hello ${displayName},`,
    '',
    `Welcome to ${appLabel}. Your ${params.role} account is ready.`,
    '',
    `School ID: ${params.schoolId ?? 'N/A'}`,
    `Login Email: ${params.email}`,
    ...(params.tempPassword ? [`Temporary Password: ${params.tempPassword}`] : []),
    '',
    'Please sign in and change your password immediately.',
    'If you did not request this account, contact your school administrator.',
  ];
  const body = bodyLines.join('\n');
  const schoolIdLabel = params.schoolId ?? 'N/A';
  const manualShareText = [
    `${appLabel} - Account Details`,
    '',
    `Hello ${displayName},`,
    `Your ${params.role} account has been created successfully.`,
    '',
    `School ID: ${schoolIdLabel}`,
    `Role: ${params.role}`,
    `Email: ${params.email}`,
    ...(params.tempPassword ? [`Temporary Password: ${params.tempPassword}`] : []),
    '',
    'Next steps:',
    '1) Sign in using the credentials above',
    '2) Change your password after first login',
    '',
    'For support, please contact your school administrator.',
  ].join('\n');
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
        sent: result.delivery?.status === 'SENT',
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

  if (isDeliverableEmail(params.email)) {
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
