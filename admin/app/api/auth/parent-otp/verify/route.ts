import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../../lib/getApiBase';

const getBackendSetCookies = (headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);
  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
};

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const payload = await req.json();
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

  const res = await fetch(`${API_BASE}/otp/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  const { accessToken, refreshToken, refreshTokenMaxAge, refreshTokenExpiresAt, ...safeData } = data;
  void accessToken;
  void refreshToken;
  void refreshTokenMaxAge;
  void refreshTokenExpiresAt;
  const response = NextResponse.json(safeData);
  for (const cookie of getBackendSetCookies(res.headers)) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}
