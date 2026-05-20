import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../../lib/getApiBase';

const DISABLE_ERROR = 'Unable to disable authenticator app.';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: { message: DISABLE_ERROR } }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/totp/disable`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new NextResponse(res.ok ? text : JSON.stringify({ error: { message: DISABLE_ERROR } }), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
