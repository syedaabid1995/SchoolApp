import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  let payload: { refreshToken?: string } = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('refresh_token='))
    ?.split('=')[1];
  if (!payload.refreshToken && cookieToken) {
    payload.refreshToken = cookieToken;
  }
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  const response = NextResponse.json(data);
  response.cookies.set('access_token', data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });

  return response;
}
