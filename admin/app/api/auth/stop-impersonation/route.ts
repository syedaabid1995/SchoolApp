import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const DEFAULT_ROOT_DOMAIN = 'app.akademifyy.in';

const cookieRootDomain = () => {
  const root = (process.env.NEXT_PUBLIC_SCHOOL_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

  if (!root || root === 'localhost' || root === '127.0.0.1') return undefined;
  return root.startsWith('.') ? root : `.${root}`;
};

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
  domain: cookieRootDomain(),
});

const clearCookie = (response: NextResponse, name: string) => {
  response.cookies.set(name, '', cookieOptions(0));
};

const returnUrl = (req: Request) => {
  if (process.env.NEXT_PUBLIC_SUPER_ADMIN_URL) {
    return `${process.env.NEXT_PUBLIC_SUPER_ADMIN_URL.replace(/\/+$/, '')}/dashboard/schools`;
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  const protocol = req.headers.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const rootDomain = (process.env.NEXT_PUBLIC_SCHOOL_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const port = host.includes(':') ? `:${host.split(':').pop()}` : '';

  if (host.endsWith('.localhost') || host.includes('.localhost:')) {
    return `http://localhost${port}/dashboard/schools`;
  }

  return `${protocol}://${rootDomain}/dashboard/schools`;
};

export async function POST(req: Request) {
  const store = await cookies();
  const superAdminAccessToken = store.get('super_admin_access_token')?.value;
  const superAdminRefreshToken = store.get('super_admin_refresh_token')?.value;

  if (!superAdminAccessToken) {
    return NextResponse.json({ error: { message: 'No super admin session found' } }, { status: 409 });
  }

  const response = NextResponse.json({
    success: true,
    redirectTo: returnUrl(req),
  });

  response.cookies.set('access_token', superAdminAccessToken, cookieOptions(15 * 60));
  if (superAdminRefreshToken) {
    response.cookies.set('refresh_token', superAdminRefreshToken, cookieOptions(60 * 60));
  }
  clearCookie(response, 'super_admin_access_token');
  clearCookie(response, 'super_admin_refresh_token');
  clearCookie(response, 'must_change_password');

  return response;
}
