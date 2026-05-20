import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../lib/getApiBase';
import { resolveSchoolSubdomainFromHost } from '../../../../lib/school-domain';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  let payload = await req.json();
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const hostSubdomain = resolveSchoolSubdomainFromHost(
      req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    );
    if (hostSubdomain && typeof record.schoolId !== 'string' && typeof record.schoolCode !== 'string') {
      payload = { ...record, schoolCode: hostSubdomain };
    }
  }
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');

  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(forwardedHost ? { 'X-Forwarded-Host': forwardedHost } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }

  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
  });
}
