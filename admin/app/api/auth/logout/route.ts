import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

const DEFAULT_ROOT_DOMAIN = 'app.akademifyy.in';

const cookieRootDomain = () => {
  const root = (process.env.NEXT_PUBLIC_SCHOOL_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

  if (!root || root === 'localhost' || root === '127.0.0.1') return undefined;
  return root.startsWith('.') ? root : `.${root}`;
};

const clearCookie = (response: NextResponse, name: string) => {
  const options = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  };
  response.cookies.set(name, '', options);
  response.cookies.set(name, '', { ...options, domain: cookieRootDomain() });
};

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const cookieHeader = req.headers.get('cookie') ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  }).catch(() => undefined);

  const response = NextResponse.json({ success: true });
  ['access_token', 'refresh_token', 'accessToken', 'refreshToken', 'super_admin_access_token', 'super_admin_refresh_token'].forEach((name) => clearCookie(response, name));
  return response;
}
