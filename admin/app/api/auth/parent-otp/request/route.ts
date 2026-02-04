import { NextResponse } from 'next/server';
import { getApiBase } from '../../../../../lib/getApiBase';

export async function POST(req: Request) {
  const API_BASE = getApiBase();
  const payload = await req.json();
  const res = await fetch(`${API_BASE}/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
