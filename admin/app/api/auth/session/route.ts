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
    return NextResponse.json({
      role: (payload?.role as string | undefined) ?? null,
      schoolId: (payload?.schoolId as string | undefined) ?? null,
      email: (payload?.email as string | undefined) ?? null,
      mustChangePassword,
    });
  } catch {
    return NextResponse.json({ role: null, schoolId: null, email: null, mustChangePassword: false });
  }
}
