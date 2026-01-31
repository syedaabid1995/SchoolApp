import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const decodePayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
};

export async function GET() {
  const store = await cookies();
  const token = store.get('access_token')?.value;
  const mustChangePassword = store.get('must_change_password')?.value === '1';
  if (!token) {
    return NextResponse.json({ role: null, schoolId: null, mustChangePassword: false });
  }
  try {
    const payload = decodePayload(token);
    let displayName: string | null = null;
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { displayName?: string | null };
        displayName = data.displayName ?? null;
      }
    } catch {
      displayName = null;
    }
    return NextResponse.json({
      role: (payload?.role as string | undefined) ?? null,
      schoolId: (payload?.schoolId as string | undefined) ?? null,
      email: (payload?.email as string | undefined) ?? null,
      mustChangePassword,
      displayName,
    });
  } catch {
    return NextResponse.json({ role: null, schoolId: null, email: null, mustChangePassword: false, displayName: null });
  }
}
