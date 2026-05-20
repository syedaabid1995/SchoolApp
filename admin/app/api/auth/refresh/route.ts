import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const cookieHeader = req.headers.get('cookie') ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  const response = NextResponse.json({
    success: true,
    tokenType: data.tokenType,
    expiresIn: data.expiresIn,
  });
  response.cookies.set('access_token', data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60,
  });
  const refreshMaxAge = Number(data.refreshTokenMaxAge);
  if (data.refreshToken) {
    response.cookies.set('refresh_token', data.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(Number.isFinite(refreshMaxAge) && refreshMaxAge > 0 ? { maxAge: refreshMaxAge } : {}),
    });
  }

  return response;
}
