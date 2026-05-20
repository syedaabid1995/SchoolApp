import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';
import axios from 'axios';
import { resolveSchoolSubdomainFromHost } from '../../../../lib/school-domain';

const GENERIC_LOGIN_ERROR = 'Invalid login details. Please try again.';

const appendBackendSetCookies = (
  response: NextResponse,
  setCookieHeader: string | string[] | undefined,
) => {
  if (!setCookieHeader) return;
  const rawCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const cookies = rawCookies.flatMap((cookie) =>
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
    return new NextResponse(
      JSON.stringify({ error: { message: GENERIC_LOGIN_ERROR } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const hostSubdomain = resolveSchoolSubdomainFromHost(
      req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    );
    if (hostSubdomain && typeof record.schoolId !== 'string' && typeof record.schoolCode !== 'string') {
      payload = { ...record, schoolCode: hostSubdomain };
    }
  }
  const userAgent = req.headers.get('user-agent') ?? 'SchoolApp-Admin/1.0';
  const forwardedFor = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
      'X-Original-User-Agent': userAgent,
    };
    if (forwardedFor) {
      headers['X-Forwarded-For'] = forwardedFor;
    }
    if (forwardedHost) {
      headers['X-Forwarded-Host'] = forwardedHost;
    }

    const response = await axios.post(`${API_BASE}/auth/login`, payload, {
      timeout: 30000,
      headers,
    });

    const data = response.data;
    if (data?.mfaRequired) {
      return NextResponse.json({
        mfaRequired: true,
        mfaMethod: data.mfaMethod ?? 'email',
        challengeId: data.challengeId ?? null,
        message: data.message ?? null,
      });
    }

    const nextResponse = NextResponse.json({
      mustChangePassword: Boolean(data.mustChangePassword),
      subscriptionRestricted: Boolean(data.subscriptionRestricted),
      user: data.user ?? null,
    });
    if (data.mustChangePassword) {
      nextResponse.cookies.set('must_change_password', '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    } else {
      nextResponse.cookies.delete('must_change_password');
    }
    appendBackendSetCookies(nextResponse, response.headers['set-cookie']);

    return nextResponse;
  } catch (error: any) {
    console.error('Login API error:', error.message);
    
    if (error.response) {
      const backendMessage =
        typeof error.response.data?.error?.message === 'string'
          ? error.response.data.error.message
          : typeof error.response.data?.message === 'string'
            ? error.response.data.message
            : error.response.status === 429
              ? 'Too many attempts. Please try again later.'
              : GENERIC_LOGIN_ERROR;
      return new NextResponse(
        JSON.stringify({ error: { message: backendMessage } }),
        { status: error.response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ error: { message: GENERIC_LOGIN_ERROR } }),
      { status: 408, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
