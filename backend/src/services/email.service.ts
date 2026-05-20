import { env } from '../config/env';
import { logger } from '../config/logger';

export type LoginOtpEmailResult = 'development_log' | 'email_not_configured';

export const sendLoginOtpEmail = async (params: {
  to: string;
  otp: string;
  challengeId: string;
  userId: string;
  schoolId: string | null;
  expiresAt: Date;
}): Promise<LoginOtpEmailResult> => {
  if (env.NODE_ENV === 'development') {
    logger.info(
      {
        to: params.to,
        userId: params.userId,
        schoolId: params.schoolId,
        challengeId: params.challengeId,
        otp: params.otp,
        expiresAt: params.expiresAt.toISOString(),
      },
      'development MFA login OTP',
    );
    return 'development_log';
  }

  logger.warn(
    {
      to: params.to,
      userId: params.userId,
      schoolId: params.schoolId,
      challengeId: params.challengeId,
      expiresAt: params.expiresAt.toISOString(),
    },
    'MFA login OTP email service not configured',
  );
  return 'email_not_configured';
};
