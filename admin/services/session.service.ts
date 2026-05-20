export type UserSession = {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  currentSession: boolean;
};

export const listUserSessions = async () => {
  const res = await fetch('/api/auth/sessions', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Unable to load sessions.');
  }
  return res.json() as Promise<{ sessions: UserSession[] }>;
};

export const revokeUserSession = async (sessionId: string) => {
  const res = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Unable to revoke session.');
  }
  return res.json() as Promise<{ message: string }>;
};

export const logoutAllSessions = async () => {
  const res = await fetch('/api/auth/logout-all', {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Unable to logout from all devices.');
  }
  return res.json() as Promise<{ message: string }>;
};
