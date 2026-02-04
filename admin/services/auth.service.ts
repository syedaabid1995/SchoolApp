// Test deployment - updated at $(date)
export const login = async (payload: { email: string; password: string; schoolId?: string }) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message =
      (data as any)?.error?.message ||
      (data as any)?.message ||
      'Login failed';
    throw new Error(message);
  }
  return res.json() as Promise<{ mustChangePassword?: boolean; subscriptionRestricted?: boolean }>;
};

export const logout = async () => {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Logout failed');
  }
  return res.json();
};

export const refreshToken = async (refreshToken: string) => {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new Error('Refresh failed');
  }
  return res.json();
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
