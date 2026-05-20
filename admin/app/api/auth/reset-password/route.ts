import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

const RESET_TOKEN_ERROR = 'Invalid or expired reset token.';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: { message: RESET_TOKEN_ERROR } }, { status: 400 });
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

  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  const response = new NextResponse(
    res.ok ? text : JSON.stringify({ error: { message: RESET_TOKEN_ERROR } }),
    {
      status: res.status,
      headers: { 'Content-Type': res.ok ? res.headers.get('content-type') ?? 'application/json' : 'application/json' },
    },
  );

  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  response.cookies.delete('must_change_password');

  return response;
}
