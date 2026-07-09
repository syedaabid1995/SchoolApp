import { NextResponse } from 'next/server';
import axios from 'axios';
import { getApiBase } from '../../../../lib/getApiBase';

const VERIFICATION_ERROR = 'Invalid or expired verification code.';
const RATE_LIMIT_ERROR = 'Too many attempts. Please try again later.';
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

const clearCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 0,
};

const clearCookie = (response: NextResponse, name: string) => {
  response.cookies.set(name, '', clearCookieOptions);
  response.cookies.set(name, '', { ...clearCookieOptions, domain: cookieRootDomain() });
};

const clearAuthCookies = (response: NextResponse) => {
  [
    'access_token',
    'refresh_token',
    'accessToken',
    'refreshToken',
    'super_admin_access_token',
    'super_admin_refresh_token',
    'must_change_password',
  ].forEach((name) => clearCookie(response, name));
};

const appendSetCookies = (response: NextResponse, value: string | string[] | undefined) => {
  if (!value) return;
  const cookies = (Array.isArray(value) ? value : [value]).flatMap((cookie) =>
    cookie.split(/,(?=\s*(?:access_token|refresh_token|accessToken|refreshToken)=)/),
  );
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed) response.headers.append('set-cookie', trimmed);
  }
};

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: { message: VERIFICATION_ERROR } }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent') ?? 'SchoolApp-Admin/1.0';
  const forwardedFor = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
    'X-Original-User-Agent': userAgent,
  };
  if (forwardedFor) {
    headers['X-Forwarded-For'] = forwardedFor;
  }

  try {
    const backendResponse = await axios.post(`${API_BASE}/auth/verify-2fa`, payload, {
      timeout: 30000,
      headers,
      validateStatus: () => true,
    });

    if (backendResponse.status >= 400) {
      return NextResponse.json(
        { error: { message: backendResponse.status === 429 ? RATE_LIMIT_ERROR : VERIFICATION_ERROR } },
        { status: backendResponse.status },
      );
    }

    const response = NextResponse.json(backendResponse.data);
    clearAuthCookies(response);
    appendSetCookies(response, backendResponse.headers['set-cookie']);
    return response;
  } catch {
    return NextResponse.json({ error: { message: VERIFICATION_ERROR } }, { status: 408 });
  }
}
