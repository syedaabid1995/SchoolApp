const DEFAULT_CREDENTIAL_SENDER_NAME = 'Akademifyy';
const SAAPT_CREDENTIAL_SENDER_NAME = 'SAAPT';

export const resolveCredentialSenderNameFromLoginUrl = (loginUrl?: string | null) => {
  if (!loginUrl) return DEFAULT_CREDENTIAL_SENDER_NAME;
  try {
    const hostname = new URL(loginUrl).hostname.toLowerCase();
    if (hostname === 'saapttech.com' || hostname.endsWith('.saapttech.com')) {
      return SAAPT_CREDENTIAL_SENDER_NAME;
    }
  } catch {
    return DEFAULT_CREDENTIAL_SENDER_NAME;
  }
  return DEFAULT_CREDENTIAL_SENDER_NAME;
};

export const buildTemporaryPasswordCredentialEmailContent = (params: {
  recipientName: string;
  schoolName?: string | null;
  schoolCode?: string | null;
  loginUrl: string;
  email: string;
  tempPassword: string;
  roleLabel?: string | null;
}) => {
  const roleLabel = params.roleLabel?.trim() || 'User';
  const body = [
    `Hello ${params.recipientName},`,
    '',
    `Your ${roleLabel} login credentials have been regenerated.`,
    ...(params.schoolName ? [`School: ${params.schoolName}`] : []),
    ...(params.schoolCode ? [`School Code: ${params.schoolCode}`] : []),
    `Login URL: ${params.loginUrl}`,
    `Email: ${params.email}`,
    `Temporary Password: ${params.tempPassword}`,
    '',
    'Please sign in and change your password immediately.',
    'If you did not request this reset, contact your administrator.',
  ].join('\n');

  return {
    subject: `Your ${roleLabel} login credentials`,
    body,
  };
};
