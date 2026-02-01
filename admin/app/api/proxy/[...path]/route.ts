import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

const forward = async (req: Request, method: string, path: string[]) => {
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;

  const url = new URL(req.url);
  const target = `${API_BASE}/${path.join('/')}${url.search}`;

  const headers: Record<string, string> = {};
  const contentType = req.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType && contentType.includes('application/json')) {
      body = await req.text();
    } else {
      const buffer = await req.arrayBuffer();
      body = buffer;
    }
  }

  const res = await fetch(target, {
    method,
    headers,
    body,
  });

  const responseBody = await res.arrayBuffer();
  const response = new NextResponse(responseBody, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream',
    },
  });
  const disposition = res.headers.get('content-disposition');
  if (disposition) {
    response.headers.set('content-disposition', disposition);
  }
  return response;
};

export async function GET(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, 'GET', path);
}

export async function POST(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, 'POST', path);
}

export async function PATCH(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, 'PATCH', path);
}

export async function PUT(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, 'PUT', path);
}

export async function DELETE(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return forward(req, 'DELETE', path);
}
