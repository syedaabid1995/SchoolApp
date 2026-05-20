import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

const VERIFICATION_ERROR = 'Invalid or expired verification code.';
const RATE_LIMIT_ERROR = 'Too many attempts. Please try again later.';

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

  const res = await fetch(`${API_BASE}/auth/resend-2fa`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: { message: res.status === 429 ? RATE_LIMIT_ERROR : VERIFICATION_ERROR } },
      { status: res.status },
    );
  }

  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
