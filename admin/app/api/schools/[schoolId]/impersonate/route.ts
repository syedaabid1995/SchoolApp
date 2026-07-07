import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../../lib/getApiBase';

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

export async function POST(req: Request, context: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await context.params;
  const store = await cookies();
  const accessToken = store.get('access_token')?.value;
  const refreshToken = store.get('refresh_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: { message: 'Missing authorization token' } }, { status: 401 });
  }

  const userAgent = req.headers.get('user-agent') ?? 'SchoolApp-Admin/1.0';
  const forwardedFor = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  const forwardedHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': userAgent,
    'X-Original-User-Agent': userAgent,
  };
  if (forwardedFor) headers['X-Forwarded-For'] = forwardedFor;
  if (forwardedHost) headers['X-Forwarded-Host'] = forwardedHost;

  const backendResponse = await fetch(`${getApiBase()}/admin/schools/${schoolId}/impersonate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const data = await backendResponse.json().catch(() => null);
  if (!backendResponse.ok) {
    return NextResponse.json(
      data ?? { error: { message: 'Unable to impersonate school admin' } },
      { status: backendResponse.status },
    );
  }

  const response = NextResponse.json({
    targetUrl: data.targetUrl,
    school: data.school,
    user: data.user,
  });
  response.cookies.set('super_admin_access_token', accessToken, cookieOptions(60 * 60));
  if (refreshToken) {
    response.cookies.set('super_admin_refresh_token', refreshToken, cookieOptions(60 * 60));
  }
  response.cookies.set('access_token', data.accessToken, cookieOptions(data.accessTokenMaxAge ?? 15 * 60));
  response.cookies.set('refresh_token', data.refreshToken, cookieOptions(data.refreshTokenMaxAge ?? 60 * 60));
  response.cookies.delete('must_change_password');

  return response;
}
