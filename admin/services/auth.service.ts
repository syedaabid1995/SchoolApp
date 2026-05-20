import { clearStoredThemes } from './theme.service';

const GENERIC_LOGIN_ERROR = 'Invalid login details. Please try again.';

// Test deployment - updated at $(date)
export const login = async (payload: {
  email?: string;
  username?: string;
  password: string;
  schoolId?: string;
  schoolCode?: string;
  rememberMe?: boolean;
  loginType?: 'admin' | 'staff' | 'teacher' | 'student' | 'parent';
}) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }
  return res.json() as Promise<{
    mustChangePassword?: boolean;
    subscriptionRestricted?: boolean;
    mfaRequired?: boolean;
    mfaMethod?: 'email' | 'totp';
    challengeId?: string;
    message?: string | null;
    user?: {
      id: string;
      email: string;
      role: string | null;
      schoolId: string | null;
    } | null;
  }>;
};

export const logout = async () => {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Logout failed');
  }
  clearStoredThemes();
  return res.json();
};

export const refreshToken = async () => {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error('Refresh failed');
  }
  return res.json();
};

export const resetPassword = async (payload: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Invalid or expired reset token.');
  }
  return res.json() as Promise<{ message: string }>;
};

export const verifyTwoFactor = async (payload: {
  challengeId: string;
  otp: string;
  rememberMe?: boolean;
}) => {
  const res = await fetch('/api/auth/verify-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Invalid or expired verification code.');
  }
  return res.json() as Promise<{
    message: string;
    user: {
      id: string;
      name?: string;
      email: string;
      role: string | null;
      schoolId: string | null;
    };
  }>;
};

export const verifyTotpLogin = async (payload: {
  challengeId: string;
  code: string;
  rememberMe?: boolean;
}) => {
  const res = await fetch('/api/auth/totp/verify-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Invalid or expired verification code.');
  }
  return res.json() as Promise<{
    message: string;
    user: {
      id: string;
      name?: string;
      email: string;
      role: string | null;
      schoolId: string | null;
    };
  }>;
};

export const resendTwoFactor = async (payload: { challengeId: string }) => {
  const res = await fetch('/api/auth/resend-2fa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data as any)?.error?.message ||
      (data as any)?.message ||
      'Unable to resend verification code.';
    throw new Error(message);
  }
  return res.json() as Promise<{
    mfaRequired: boolean;
    challengeId: string;
    message: string;
  }>;
};

export const startTotpSetup = async () => {
  const res = await fetch('/api/auth/totp/setup', {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as any)?.error?.message || (data as any)?.message || 'Unable to start authenticator setup.');
  }
  return res.json() as Promise<{
    secret: string;
    issuer: string;
    label: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }>;
};

export const verifyTotpSetup = async (payload: { code: string }) => {
  const res = await fetch('/api/auth/totp/verify-setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Invalid authenticator code.');
  }
  return res.json() as Promise<{
    message: string;
    backupCodes: string[];
  }>;
};

export const disableTotp = async (payload: { code: string }) => {
  const res = await fetch('/api/auth/totp/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error((data as any)?.error?.message || (data as any)?.message || 'Unable to disable authenticator app.');
  }
  return res.json() as Promise<{ message: string }>;
};

export const changePassword = async (payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) => {
  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data as any)?.error?.message ||
      (data as any)?.message ||
      'Unable to change password.';
    throw new Error(message);
  }
  return res.json() as Promise<{ message: string }>;
};

export const getSession = async () => {
  const res = await fetch('/api/auth/session');
  if (!res.ok) {
    return {
      role: null,
      schoolId: null,
      email: null,
      subscriptionRestricted: false,
      mustChangePassword: false,
      schoolName: null,
      permissionCodes: [],
    };
  }
  return res.json() as Promise<{
    role: string | null;
    schoolId: string | null;
    email: string | null;
    subscriptionRestricted?: boolean;
    mustChangePassword: boolean;
    displayName?: string | null;
    schoolName?: string | null;
    permissionCodes?: string[];
  }>;
};
