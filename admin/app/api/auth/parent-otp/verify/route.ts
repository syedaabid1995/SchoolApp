import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../../lib/getApiBase';

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
  void refreshTokenExpiresAt;
  const response = NextResponse.json(safeData);
  if (accessToken) {
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60,
    });
  }
  if (refreshToken) {
    const refreshMaxAge = Number(refreshTokenMaxAge);
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      ...(Number.isFinite(refreshMaxAge) && refreshMaxAge > 0 ? { maxAge: refreshMaxAge } : {}),
    });
  }

  return response;
}
