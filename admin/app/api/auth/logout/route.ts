import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

export async function POST() {
  const API_BASE = getApiBase();
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => undefined);

  const response = NextResponse.json({ success: true });
  response.cookies.set('access_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
