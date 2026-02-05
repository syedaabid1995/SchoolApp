import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendNotification } from './notification.service';

const resolveSentTo = (mobile?: string | null) => {
  const trimmed = (mobile ?? '').trim();
  return trimmed.length > 0 ? trimmed : env.WHATSAPP_FALLBACK_TO;
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
  const passwordNote = params.tempPassword ? ` Temporary password: ${params.tempPassword}` : '';
  const body = `Hello ${displayName}, your ${params.role} account has been created.${passwordNote}`;

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

  return { sentTo };
};
