import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';

const getBackendSetCookies = (headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);
  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
};

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const cookieHeader = req.headers.get('cookie') ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  const response = NextResponse.json({
    success: true,
    tokenType: data.tokenType,
    expiresIn: data.expiresIn,
  });
  for (const cookie of getBackendSetCookies(res.headers)) {
    response.headers.append('set-cookie', cookie);
  }

  return response;
}
