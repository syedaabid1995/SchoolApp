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
  if (!token) {
    return NextResponse.json({ role: null, schoolId: null });
  }
  try {
    const payload = decodePayload(token);
    return NextResponse.json({
      role: (payload?.role as string | undefined) ?? null,
      schoolId: (payload?.schoolId as string | undefined) ?? null,
    });
  } catch {
    return NextResponse.json({ role: null, schoolId: null });
  }
}
