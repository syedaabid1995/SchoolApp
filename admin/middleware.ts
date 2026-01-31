import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from './utils/roles';

const ACCESS_COOKIE = 'access_token';

const decodeRole = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  try {
    const json = Buffer.from(payload, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return (parsed.role as string | undefined) ?? null;
  } catch {
    return null;
  }
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/login')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const role = decodeRole(token);

    if (
      (pathname.startsWith('/dashboard/schools') || pathname.startsWith('/dashboard/subscriptions')) &&
      !isSuperAdmin(role)
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
