export const login = async (payload: { email: string; password: string; schoolId?: string }) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Login failed');
  }
  return res.json();
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
    return { role: null, schoolId: null };
  }
  return res.json() as Promise<{ role: string | null; schoolId: string | null }>;
};
