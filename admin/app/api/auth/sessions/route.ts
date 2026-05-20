import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../lib/getApiBase';

const authHeaders = async () => {
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;
  const refreshToken = store.get('refresh_token')?.value;
  if (!accessToken) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (refreshToken) {
    headers.Cookie = `refresh_token=${encodeURIComponent(refreshToken)}`;
  }
  return headers;
};

export async function GET() {
  const API_BASE = getApiBase();
  const headers = await authHeaders();
  if (!headers) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const res = await fetch(`${API_BASE}/auth/sessions`, {
    headers,
    cache: 'no-store',
  });
  const text = await res.text();

  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
