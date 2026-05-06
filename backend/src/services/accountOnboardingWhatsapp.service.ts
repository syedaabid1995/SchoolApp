import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { sendNotification } from './notification.service';
import { hasActiveMessagingGateway } from './messagingSettings.service';

const resolveSentTo = (mobile?: string | null) => {
  const trimmed = (mobile ?? '').trim();
  return trimmed.length > 0 ? trimmed : env.WHATSAPP_FALLBACK_TO;
};

const resolveSchoolName = async (schoolId?: string | null) => {
  if (!schoolId) return null;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  return school?.name ?? null;
};

export const sendAccountCreatedWhatsapp = async (params: {
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'PARENT';
  email: string;
  mobile?: string | null;
  tempPassword?: string | null;
  fullName?: string | null;
  schoolId?: string | null;
}) => {
  const sentTo = resolveSentTo(params.mobile);
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

  const gatewayActive = await hasActiveMessagingGateway({
    schoolId: params.schoolId ?? null,
    channels: ['WHATSAPP', 'SMS'],
  });

  if (!gatewayActive) {
    logger.warn(
      { role: params.role, sentTo, schoolId: params.schoolId ?? null },
      'no active messaging gateway for school; manual share required',
    );
    return {
      sentTo,
      queued: false,
      manualShareRequired: true,
      manualShareText,
      manualShareUrl,
    };
  }

  try {
    logger.info({ role: params.role, sentTo, email: params.email, schoolId: params.schoolId ?? null }, 'queueing whatsapp onboarding message');
    await sendNotification({
      schoolId: params.schoolId ?? null,
      userId: null,
      channel: 'WHATSAPP',
      data: {
        to: sentTo,
        subject: `${params.role} account created`,
        body,
      },
    });
    logger.info({ role: params.role, sentTo, email: params.email }, 'whatsapp onboarding message queued');
  } catch (error) {
    logger.warn(
      {
        err: error,
        role: params.role,
        sentTo,
      },
      'failed to queue whatsapp onboarding message',
    );
  }

  return {
    sentTo,
    queued: true,
    manualShareRequired: false,
    manualShareText,
    manualShareUrl,
  };
};
