'use client';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header, type DashboardResolvedThemeMode, type DashboardThemeMode } from './Header';
import { getSession } from '../services/auth.service';
import {
  defaultLoginBranding,
  getLoginBrandingSettings,
} from '../services/branding.service';
import { akademifyyBrand, getCurrentPlatformBrand } from '../lib/platform-brand';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getRequiredPermissionForPath } from '../config/employee-permissions';
import AccessDeniedPanel from './AccessDeniedPanel';
import FullPageLoader from './FullPageLoader';
import { registerCurrentWebPushDevice } from '../lib/webPushRegistration';

export default function DashboardClientLayout({ 
  children, 
  role, 
  email 
}: { 
  children: React.ReactNode;
  role: string | null;
  email: string | null;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<DashboardThemeMode>('light');
  const [systemThemeMode, setSystemThemeMode] = useState<DashboardResolvedThemeMode>('light');
  const [hostBrand, setHostBrand] = useState(akademifyyBrand);
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSubscriptionRestricted = Boolean(session?.subscriptionRestricted);
  const permissionCodes = session?.permissionCodes ?? [];
  const effectiveRole = session?.role ?? role;
  const hasAnyRole = Boolean(effectiveRole);
  const isSuperAdmin = effectiveRole === 'SUPER_ADMIN';
  const superAdminAllowedPaths = [
    '/dashboard',
    '/dashboard/reports',
    '/dashboard/schools',
    '/dashboard/schools/',
    '/dashboard/users',
    '/dashboard/subscriptions',
    '/dashboard/support',
    '/dashboard/audit',
    '/dashboard/logs',
    '/dashboard/communication',
    '/dashboard/themes',
    '/dashboard/system-health',
    '/dashboard/backups',
    '/dashboard/compliance',
    '/dashboard/payment-methods',
    '/dashboard/holidays',
    '/dashboard/sms-settings',
    '/dashboard/settings',
  ];
  const schoolSetupAllowedPaths = [
    '/dashboard/onboarding',
    '/dashboard/settings/branding',
    '/dashboard/payment-methods',
    '/dashboard/fee-challan-details',
    '/dashboard/role-permissions',
    '/dashboard/base-setup',
    '/dashboard/holidays',
    '/dashboard/sms-settings',
  ];
  const requiredPermission = getRequiredPermissionForPath(pathname);
  const isSuperAdminLayout = isSuperAdmin || role === 'SUPER_ADMIN';
  const settingsTab = searchParams.get('tab') ?? '';
  const isAccountRoute = pathname === '/change-password';
  const isSafeSettingsTab =
    pathname === '/dashboard/settings' &&
    (!settingsTab ||
      settingsTab === 'security' ||
      (effectiveRole === 'SCHOOL_ADMIN' && ['brand', 'branding', 'theme', 'messaging'].includes(settingsTab)));
  const isSafeSchoolSetupRoute =
    effectiveRole === 'SCHOOL_ADMIN' && schoolSetupAllowedPaths.some((allowedPath) => pathname === allowedPath);
  const { data: shellBranding } = useQuery({
    queryKey: ['login-branding-settings', 'platform-shell'],
    queryFn: () => getLoginBrandingSettings(),
    enabled: isSuperAdminLayout,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
  const platformSettings = {
    platformName: hostBrand.key === 'saapt' ? hostBrand.appName : shellBranding?.appName || defaultLoginBranding.appName,
    consoleName: hostBrand.key === 'saapt'
      ? hostBrand.consoleName
      : shellBranding?.schoolName || defaultLoginBranding.schoolName || 'School Management Console',
    footerText: hostBrand.key === 'saapt' ? hostBrand.footerText : shellBranding?.footerText || defaultLoginBranding.footerText,
    logoUrl: hostBrand.key === 'saapt' ? hostBrand.logoUrl : shellBranding?.logoUrl || defaultLoginBranding.logoUrl || '',
    defaultThemeMode: 'light' as DashboardThemeMode,
  };
  const canAccessRoute =
    hasAnyRole &&
    (isAccountRoute ||
      isSuperAdmin ||
      isSafeSettingsTab ||
      isSafeSchoolSetupRoute ||
      (requiredPermission ? permissionCodes.includes(requiredPermission) : false));
  const canAccessSuperAdminRoute =
    isAccountRoute ||
    !isSuperAdmin ||
    superAdminAllowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));

  const resolvedThemeMode: DashboardResolvedThemeMode = themeMode === 'system' ? systemThemeMode : themeMode;

  const shellStyle =
    resolvedThemeMode === 'dark'
      ? ({
          '--shell-bg': '#0f172a',
          '--shell-header': 'rgba(15, 23, 42, 0.94)',
          '--shell-card': '#111827',
          '--shell-subtle': '#1e293b',
          '--shell-hover': '#243244',
          '--shell-border': '#334155',
          '--shell-text': '#e5e7eb',
          '--shell-muted': '#94a3b8',
          '--shell-accent': '#2563eb',
          '--shell-sidebar': '#0f172a',
          '--shell-sidebar-card': '#111827',
          '--shell-sidebar-hover': '#1e293b',
          '--shell-sidebar-active': '#2563eb',
          '--shell-sidebar-active-text': '#ffffff',
          '--shell-sidebar-text': '#e5e7eb',
          '--shell-sidebar-muted': '#94a3b8',
          '--shell-sidebar-border': '#334155',
          '--shell-sidebar-icon': '#1e293b',
          '--shell-sidebar-icon-active': 'rgba(255, 255, 255, 0.18)',
        } as CSSProperties)
      : ({
          '--shell-bg': '#f5f7fb',
          '--shell-header': 'rgba(255, 255, 255, 0.94)',
          '--shell-card': '#ffffff',
          '--shell-subtle': '#f8fafc',
          '--shell-hover': '#f1f5f9',
          '--shell-border': '#e2e8f0',
          '--shell-text': '#0f172a',
          '--shell-muted': '#64748b',
          '--shell-accent': '#2563eb',
          '--shell-sidebar': '#ffffff',
          '--shell-sidebar-card': '#f8fafc',
          '--shell-sidebar-hover': '#f1f5f9',
          '--shell-sidebar-active': '#eff6ff',
          '--shell-sidebar-active-text': '#1d4ed8',
          '--shell-sidebar-text': '#0f172a',
          '--shell-sidebar-muted': '#64748b',
          '--shell-sidebar-border': '#e2e8f0',
          '--shell-sidebar-icon': '#f1f5f9',
          '--shell-sidebar-icon-active': '#dbeafe',
        } as CSSProperties);

  useEffect(() => {
    setHostBrand(getCurrentPlatformBrand());
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem('dashboard-theme-mode');
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      setThemeMode(stored);
      return;
    }
    if (isSuperAdminLayout) {
      setThemeMode(platformSettings.defaultThemeMode);
    }
  }, [isSuperAdminLayout, platformSettings.defaultThemeMode]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => setSystemThemeMode(media.matches ? 'dark' : 'light');
    syncSystemTheme();
    media.addEventListener('change', syncSystemTheme);
    return () => media.removeEventListener('change', syncSystemTheme);
  }, []);

  const updateThemeMode = (mode: DashboardThemeMode) => {
    setThemeMode(mode);
    window.localStorage.setItem('dashboard-theme-mode', mode);
  };

  useEffect(() => {
    document.documentElement.dataset.dashboardTheme = resolvedThemeMode;
    document.documentElement.dataset.dashboardThemePreference = themeMode;
  }, [resolvedThemeMode, themeMode]);

  useEffect(() => {
    if (isSubscriptionRestricted && pathname !== '/dashboard/plans' && pathname !== '/change-password') {
      router.replace('/dashboard/plans');
    }
  }, [isSubscriptionRestricted, pathname, router]);

  useEffect(() => {
    if (isSuperAdmin && !canAccessSuperAdminRoute) {
      router.replace('/dashboard');
    }
  }, [isSuperAdmin, canAccessSuperAdminRoute, router]);

  useEffect(() => {
    if (!isSessionLoading && session && !session.role) {
      router.replace('/login');
    }
  }, [isSessionLoading, router, session]);

  useEffect(() => {
    if (isSessionLoading || !session?.role || typeof window === 'undefined' || !('Notification' in window)) return;
    const userKey = [session.email ?? email ?? 'user', session.schoolId ?? 'platform', session.role].join(':');
    const promptKey = `akademifyy.webPushAutoPrompted.${userKey}`;
    const canPromptNow = Notification.permission === 'default' && !window.sessionStorage.getItem(promptKey);
    if (Notification.permission === 'default' && !canPromptNow) return;
    if (Notification.permission === 'denied') return;
    void registerCurrentWebPushDevice({
      app: 'admin-web',
      requestPermission: canPromptNow,
    })
      .finally(() => {
        if (canPromptNow) {
          window.sessionStorage.setItem(promptKey, '1');
        }
      })
      .catch(() => undefined);
  }, [email, isSessionLoading, session?.email, session?.role, session?.schoolId]);

  if (isSessionLoading) {
    return <FullPageLoader label="Checking access..." />;
  }

  if (session && !session.role) {
    return <FullPageLoader label="Redirecting to login..." />;
  }

  if (isSubscriptionRestricted && !isAccountRoute) {
    return (
      <main className="min-h-screen bg-sand p-4 sm:p-6">
        <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
      </main>
    );
  }

  if (!isSuperAdmin && !canAccessRoute) {
    return (
      <div
        className={`dashboard-shell dashboard-shell-${resolvedThemeMode} flex h-screen w-full overflow-hidden bg-[var(--shell-bg)] text-[var(--shell-text)]`}
        style={shellStyle}
      >
        <Sidebar
          role={effectiveRole}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          schoolName={session?.schoolName ?? undefined}
          permissionCodes={permissionCodes}
          platformName={platformSettings.platformName}
          platformSubtitle={platformSettings.consoleName}
          platformLogoUrl={platformSettings.logoUrl}
        />
        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <Header
            role={effectiveRole}
            email={email}
            displayName={session && 'displayName' in session ? session.displayName ?? null : null}
            permissionCodes={permissionCodes}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            themeMode={themeMode}
            resolvedThemeMode={resolvedThemeMode}
            onThemeModeChange={updateThemeMode}
            consoleTitle={platformSettings.consoleName}
            isImpersonating={session?.isImpersonating}
            impersonatedByEmail={session?.impersonatedByEmail}
          />
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6">
            <AccessDeniedPanel />
          </main>
        </div>
      </div>
    );
  }

  if (isSuperAdmin && !canAccessSuperAdminRoute) {
    return null;
  }

  return (
    <div
      className={`dashboard-shell dashboard-shell-${resolvedThemeMode} ${isSuperAdminLayout ? 'super-admin-console' : ''} flex h-screen w-full overflow-hidden bg-[var(--shell-bg)] text-[var(--shell-text)]`}
      style={shellStyle}
    >
      <Sidebar
        role={effectiveRole}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        schoolName={session?.schoolName ?? undefined}
        permissionCodes={permissionCodes}
        platformName={platformSettings.platformName}
        platformSubtitle={platformSettings.consoleName}
        platformLogoUrl={platformSettings.logoUrl}
      />
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          role={effectiveRole}
          email={email}
          displayName={session && 'displayName' in session ? session.displayName ?? null : null}
          permissionCodes={permissionCodes}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
          themeMode={themeMode}
          resolvedThemeMode={resolvedThemeMode}
          onThemeModeChange={updateThemeMode}
          consoleTitle={platformSettings.consoleName}
          isImpersonating={session?.isImpersonating}
          impersonatedByEmail={session?.impersonatedByEmail}
        />
        <main
          className={
            isSuperAdminLayout
              ? 'min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6 lg:p-8'
              : 'min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6'
          }
        >
          <div className={isSuperAdminLayout ? 'mx-auto w-full min-w-0 max-w-[1500px] animate-fade-in' : 'mx-auto w-full min-w-0 max-w-7xl animate-fade-in'}>
            {children}
          </div>
        </main>
        <footer
          className={
            isSuperAdminLayout
              ? 'min-w-0 flex-shrink-0 overflow-hidden border-t border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-xs text-[var(--shell-muted)] transition-all duration-200 sm:px-6'
              : 'theme-footer min-w-0 flex-shrink-0 overflow-hidden border-t border-white/10 px-4 py-3 text-xs text-white/80 backdrop-blur-md transition-all duration-200 sm:px-6'
          }
        >
          <div className={isSuperAdminLayout ? 'mx-auto w-full min-w-0 max-w-[1500px]' : 'mx-auto w-full min-w-0 max-w-7xl'}>
            {isSuperAdminLayout ? platformSettings.footerText : defaultLoginBranding.footerText}
          </div>
        </footer>
      </div>
    </div>
  );
}
