import { cookies } from 'next/headers';

const ACCESS_COOKIE = 'access_token';
const ROLE_CLAIM = 'role';
const EMAIL_CLAIM = 'email';

const decodePayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
};

export const getServerToken = async () => {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
};

export const getServerRole = async () => {
  const token = await getServerToken();
  if (!token) return null;
  const payload = decodePayload(token);
  return (payload?.[ROLE_CLAIM] as string | undefined) ?? null;
};

export const getServerEmail = async () => {
  const token = await getServerToken();
  if (!token) return null;
  const payload = decodePayload(token);
  return (payload?.[EMAIL_CLAIM] as string | undefined) ?? null;
};
