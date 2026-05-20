import { NextResponse } from 'next/server';
import axios from 'axios';
import { getApiBase } from '../../../../../lib/getApiBase';

const VERIFICATION_ERROR = 'Invalid or expired verification code.';
const RATE_LIMIT_ERROR = 'Too many attempts. Please try again later.';

const appendSetCookies = (response: NextResponse, value: string | string[] | undefined) => {
  if (!value) return;
  const cookies = Array.isArray(value) ? value : [value];
  for (const cookie of cookies) {
    response.headers.append('set-cookie', cookie);
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
    const backendResponse = await axios.post(`${API_BASE}/auth/totp/verify-login`, payload, {
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
    appendSetCookies(response, backendResponse.headers['set-cookie']);
    return response;
  } catch {
    return NextResponse.json({ error: { message: VERIFICATION_ERROR } }, { status: 408 });
  }
}
