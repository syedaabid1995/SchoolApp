import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../lib/getApiBase';

export async function POST() {
  const API_BASE = getApiBase();
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;
  const refreshToken = store.get('refresh_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (refreshToken) {
    headers.Cookie = `refresh_token=${encodeURIComponent(refreshToken)}`;
  }

  const res = await fetch(`${API_BASE}/auth/logout-all`, {
    method: 'POST',
    headers,
  });
  const text = await res.text();
  const response = new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });

  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  response.cookies.delete('must_change_password');

  return response;
}
