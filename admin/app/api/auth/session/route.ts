import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getApiBase } from '../../../../lib/getApiBase';

const emptySession = (mustChangePassword = false) => ({
  role: null,
  schoolId: null,
  email: null,
  subscriptionRestricted: false,
  mustChangePassword,
  displayName: null,
  permissionCodes: [],
  hasDashboardAccess: false,
});

const decodePayload = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
};

const getBackendSetCookies = (headers: Headers) => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === 'function') return getSetCookie.call(headers);
  const setCookie = headers.get('set-cookie');
  return setCookie
    ? setCookie.split(/,(?=\s*(?:access_token|refresh_token|accessToken|refreshToken)=)/).map((cookie) => cookie.trim())
    : [];
};

const getCookieValueFromSetCookies = (setCookies: string[], name: string) => {
  const prefix = `${name}=`;
  const cookie = setCookies.find((entry) => entry.startsWith(prefix));
  if (!cookie) return null;
  const value = cookie.slice(prefix.length).split(';')[0];
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const appendSetCookies = (response: NextResponse, setCookies: string[]) => {
  for (const cookie of setCookies) {
    if (cookie) response.headers.append('set-cookie', cookie);
  }
};

export async function GET(req: Request) {
  const store = await cookies();
  let token = store.get('access_token')?.value;
  const hasSuperAdminReturnSession = Boolean(store.get('super_admin_access_token')?.value);
  const mustChangePassword = store.get('must_change_password')?.value === '1';
  if (!token) {
    return NextResponse.json(emptySession(false));
  }
  try {
    const API_BASE = getApiBase();
    const refreshedSetCookies: string[] = [];
    const fetchMe = (accessToken: string) =>
      fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
    let payload = decodePayload(token);
    let subscriptionRestricted = Boolean(payload?.subscriptionRestricted);
    let displayName: string | null = null;
    let permissionCodes: string[] = [];
    let resolvedRole = (payload?.role as string | undefined) ?? null;
    let resolvedSchoolId = (payload?.schoolId as string | undefined) ?? null;

    let res = await fetchMe(token);
    if (res.status === 401) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: req.headers.get('cookie') ?? '',
        },
        body: JSON.stringify({}),
      });
      if (!refreshRes.ok) {
        return NextResponse.json(emptySession(false), { status: 401 });
      }
      refreshedSetCookies.push(...getBackendSetCookies(refreshRes.headers));
      token = getCookieValueFromSetCookies(refreshedSetCookies, 'access_token') ?? token;
      payload = decodePayload(token);
      subscriptionRestricted = Boolean(payload?.subscriptionRestricted);
      resolvedRole = (payload?.role as string | undefined) ?? resolvedRole;
      resolvedSchoolId = (payload?.schoolId as string | undefined) ?? resolvedSchoolId;
      res = await fetchMe(token);
    }

    if (!res.ok) {
      const response = NextResponse.json(emptySession(mustChangePassword), { status: res.status });
      appendSetCookies(response, refreshedSetCookies);
      return response;
    }

    const data = (await res.json()) as {
      displayName?: string | null;
      permissionCodes?: string[];
      role?: string | null;
      schoolId?: string | null;
      employeeProfile?: { roleName?: string | null } | null;
      teacherProfile?: { roleName?: string | null } | null;
    };
    displayName = data.displayName ?? null;
    resolvedRole = data.employeeProfile?.roleName ?? data.teacherProfile?.roleName ?? data.role ?? resolvedRole;
    resolvedSchoolId = data.schoolId ?? resolvedSchoolId;
    permissionCodes = Array.isArray(data.permissionCodes) ? data.permissionCodes : [];

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
    const response = NextResponse.json({
      role: resolvedRole,
      schoolId: resolvedSchoolId,
      email: (payload?.email as string | undefined) ?? null,
      subscriptionRestricted,
      mustChangePassword,
      displayName,
      permissionCodes,
      isImpersonating: Boolean(payload?.impersonatedByUserId && hasSuperAdminReturnSession),
      impersonatedByEmail: (payload?.impersonatedByEmail as string | undefined) ?? null,
      hasDashboardAccess: Boolean(resolvedRole && (resolvedRole === 'SUPER_ADMIN' || permissionCodes.length > 0)),
    });
    appendSetCookies(response, refreshedSetCookies);
    return response;
  } catch {
    return NextResponse.json(emptySession(false), { status: 401 });
  }
}
