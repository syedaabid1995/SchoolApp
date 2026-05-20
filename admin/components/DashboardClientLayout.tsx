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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { EMPLOYEE_MANAGED_ROLES, getRequiredPermissionForPath } from '../config/employee-permissions';

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
  const [themeMode, setThemeMode] = useState<DashboardThemeMode>('system');
  const [systemThemeMode, setSystemThemeMode] = useState<DashboardResolvedThemeMode>('light');
  const { data: session } = useQuery({
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
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const superAdminAllowedPaths = [
    '/dashboard',
    '/dashboard/analytics',
    '/dashboard/reports',
    '/dashboard/schools',
    '/dashboard/users',
    '/dashboard/subscriptions',
    '/dashboard/support',
    '/dashboard/audit',
    '/dashboard/logs',
    '/dashboard/themes',
    '/dashboard/system-health',
    '/dashboard/backups',
    '/dashboard/compliance',
    '/dashboard/settings',
  ];
  const isManagedEmployeeRole = EMPLOYEE_MANAGED_ROLES.includes((session?.role ?? '') as (typeof EMPLOYEE_MANAGED_ROLES)[number]);
  const requiredPermission = getRequiredPermissionForPath(pathname);
  const isSuperAdminLayout = isSuperAdmin || role === 'SUPER_ADMIN';
  const settingsTab = searchParams.get('tab') ?? '';
  const isSafeSettingsTab =
    pathname === '/dashboard/settings' &&
    (!settingsTab ||
      settingsTab === 'security' ||
      (session?.role === 'SCHOOL_ADMIN' && ['branding', 'theme'].includes(settingsTab)));
  const { data: shellBranding } = useQuery({
    queryKey: ['login-branding-settings', 'platform-shell'],
    queryFn: () => getLoginBrandingSettings(),
    enabled: isSuperAdminLayout,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60_000,
  });
  const platformSettings = {
    platformName: shellBranding?.appName || defaultLoginBranding.appName,
    consoleName: shellBranding?.schoolName || defaultLoginBranding.schoolName || 'School Management Console',
    footerText: shellBranding?.footerText || defaultLoginBranding.footerText,
    defaultThemeMode: 'system' as DashboardThemeMode,
  };
  const canAccessRoute =
    !isManagedEmployeeRole || isSafeSettingsTab || (requiredPermission ? permissionCodes.includes(requiredPermission) : false);
  const canAccessSuperAdminRoute =
    !isSuperAdmin || superAdminAllowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));

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
          '--shell-sidebar': '#020617',
          '--shell-sidebar-card': 'rgba(255, 255, 255, 0.06)',
          '--shell-sidebar-hover': 'rgba(255, 255, 255, 0.08)',
          '--shell-sidebar-active': '#ffffff',
          '--shell-sidebar-active-text': '#0f172a',
          '--shell-sidebar-text': '#f8fafc',
          '--shell-sidebar-muted': '#94a3b8',
          '--shell-sidebar-border': 'rgba(148, 163, 184, 0.22)',
          '--shell-sidebar-icon': 'rgba(255, 255, 255, 0.08)',
          '--shell-sidebar-icon-active': '#e2e8f0',
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
          '--shell-sidebar': isSuperAdminLayout ? '#0b1220' : 'var(--theme-navbar-bg)',
          '--shell-sidebar-card': 'rgba(255, 255, 255, 0.06)',
          '--shell-sidebar-hover': 'rgba(255, 255, 255, 0.08)',
          '--shell-sidebar-active': '#ffffff',
          '--shell-sidebar-active-text': '#0f172a',
          '--shell-sidebar-text': '#f8fafc',
          '--shell-sidebar-muted': 'rgba(226, 232, 240, 0.78)',
          '--shell-sidebar-border': 'rgba(255, 255, 255, 0.12)',
          '--shell-sidebar-icon': 'rgba(255, 255, 255, 0.08)',
          '--shell-sidebar-icon-active': '#e2e8f0',
        } as CSSProperties);

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
    if (isSubscriptionRestricted && pathname !== '/dashboard/plans') {
      router.replace('/dashboard/plans');
    }
  }, [isSubscriptionRestricted, pathname, router]);

  useEffect(() => {
    if (isSuperAdmin && !canAccessSuperAdminRoute) {
      router.replace('/dashboard/analytics');
    }
  }, [isSuperAdmin, canAccessSuperAdminRoute, router]);

  if (isSubscriptionRestricted) {
    return (
      <main className="min-h-screen bg-sand p-4 sm:p-6">
        <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
      </main>
    );
  }

  if (isManagedEmployeeRole && !canAccessRoute) {
    return (
      <div
        className={`dashboard-shell dashboard-shell-${resolvedThemeMode} flex h-screen bg-[var(--shell-bg)] text-[var(--shell-text)]`}
        style={shellStyle}
      >
        <Sidebar
          role={role}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          schoolName={session?.schoolName ?? undefined}
          permissionCodes={permissionCodes}
          platformName={platformSettings.platformName}
          platformSubtitle={platformSettings.consoleName}
        />
        <div className="flex flex-1 flex-col h-screen">
          <Header
            role={role}
            email={email}
            displayName={session && 'displayName' in session ? session.displayName ?? null : null}
            permissionCodes={permissionCodes}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            themeMode={themeMode}
            resolvedThemeMode={resolvedThemeMode}
            onThemeModeChange={updateThemeMode}
            consoleTitle={platformSettings.consoleName}
          />
          <main className="flex-1 overflow-y-auto bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6">
            <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-8 text-center">
              <h1 className="text-2xl font-semibold text-[var(--shell-text)]">Permission Not Available</h1>
              <p className="mt-2 text-sm text-[var(--shell-muted)]">
                The requested page is not available for your role. Contact your school admin.
              </p>
            </section>
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
      className={`dashboard-shell dashboard-shell-${resolvedThemeMode} ${isSuperAdminLayout ? 'super-admin-console' : ''} flex h-screen bg-[var(--shell-bg)] text-[var(--shell-text)]`}
      style={shellStyle}
    >
      <Sidebar 
        role={role} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        schoolName={session?.schoolName ?? undefined}
        permissionCodes={permissionCodes}
        platformName={platformSettings.platformName}
        platformSubtitle={platformSettings.consoleName}
      />
      <div className="flex flex-1 flex-col h-screen">
        <Header 
          role={role} 
          email={email} 
          displayName={session && 'displayName' in session ? session.displayName ?? null : null}
          permissionCodes={permissionCodes}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
          themeMode={themeMode}
          resolvedThemeMode={resolvedThemeMode}
          onThemeModeChange={updateThemeMode}
          consoleTitle={platformSettings.consoleName}
        />
        <main
          className={
            isSuperAdminLayout
              ? 'flex-1 overflow-y-auto bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6 lg:p-8'
              : 'flex-1 overflow-y-auto bg-[var(--shell-bg)] p-4 transition-all duration-200 sm:p-6'
          }
        >
          <div className={isSuperAdminLayout ? 'mx-auto max-w-[1500px] animate-fade-in' : 'mx-auto max-w-7xl animate-fade-in'}>
            {children}
          </div>
        </main>
        <footer
          className={
            isSuperAdminLayout
              ? 'flex-shrink-0 border-t border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 text-xs text-[var(--shell-muted)] transition-all duration-200 sm:px-6'
              : 'theme-footer flex-shrink-0 border-t border-white/10 px-4 py-3 text-xs text-white/80 backdrop-blur-md transition-all duration-200 sm:px-6'
          }
        >
          <div className={isSuperAdminLayout ? 'mx-auto max-w-[1500px]' : 'mx-auto max-w-7xl'}>
            {isSuperAdminLayout ? platformSettings.footerText : defaultLoginBranding.footerText}
          </div>
        </footer>
      </div>
    </div>
  );
}
