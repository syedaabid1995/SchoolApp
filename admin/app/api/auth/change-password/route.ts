import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../lib/getApiBase';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const payload = await req.json();
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;
  if (!accessToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  const response = NextResponse.json(data);
  response.cookies.delete('must_change_password');
  return response;
}
