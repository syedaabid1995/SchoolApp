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
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
    let subscriptionRestricted = Boolean(payload?.subscriptionRestricted);
    let displayName: string | null = null;
    try {
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
    if (!subscriptionRestricted && payload?.schoolId) {
      try {
        const subRes = await fetch(`${API_BASE}/subscriptions`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (subRes.ok) {
          const sub = (await subRes.json()) as {
            status?: string;
            endsAt?: string | null;
            nextDueAt?: string | null;
          };
          const now = new Date();
          const endsAt = sub.endsAt ? new Date(sub.endsAt) : null;
          const nextDueAt = sub.nextDueAt ? new Date(sub.nextDueAt) : null;
          if (
            sub.status === 'EXPIRED' ||
            (nextDueAt && !Number.isNaN(nextDueAt.getTime()) && nextDueAt < now) ||
            (endsAt && !Number.isNaN(endsAt.getTime()) && endsAt < now)
          ) {
            subscriptionRestricted = true;
          }
        }
      } catch {
        // Ignore subscription check failures
      }
    }
    return NextResponse.json({
      role: (payload?.role as string | undefined) ?? null,
      schoolId: (payload?.schoolId as string | undefined) ?? null,
      email: (payload?.email as string | undefined) ?? null,
      subscriptionRestricted,
      mustChangePassword,
      displayName,
    });
  } catch {
    return NextResponse.json({
      role: null,
      schoolId: null,
      email: null,
      subscriptionRestricted: false,
      mustChangePassword: false,
      displayName: null,
    });
  }
}
