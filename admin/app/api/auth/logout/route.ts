import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

const clearCookie = (response: NextResponse, name: string) => {
  response.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
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
  ['access_token', 'refresh_token', 'accessToken', 'refreshToken'].forEach((name) => clearCookie(response, name));
  return response;
}
