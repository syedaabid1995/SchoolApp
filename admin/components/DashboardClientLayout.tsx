'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { getSession } from '../services/auth.service';
import { usePathname, useRouter } from 'next/navigation';
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
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const pathname = usePathname();
  const router = useRouter();
  const isSubscriptionRestricted = Boolean(session?.subscriptionRestricted);
  const permissionCodes = session?.permissionCodes ?? [];
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const superAdminAllowedPaths = [
    '/dashboard',
    '/dashboard/analytics',
    '/dashboard/schools',
    '/dashboard/subscriptions',
    '/dashboard/support',
    '/dashboard/audit',
    '/dashboard/themes',
    '/dashboard/settings',
  ];
  const isManagedEmployeeRole = EMPLOYEE_MANAGED_ROLES.includes((session?.role ?? '') as (typeof EMPLOYEE_MANAGED_ROLES)[number]);
  const requiredPermission = getRequiredPermissionForPath(pathname);
  const canAccessRoute =
    !isManagedEmployeeRole || (requiredPermission ? permissionCodes.includes(requiredPermission) : false);
  const canAccessSuperAdminRoute =
    !isSuperAdmin || superAdminAllowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));

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
      <div className="flex h-screen bg-sand">
        <Sidebar
          role={role}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          schoolName={session?.schoolName ?? undefined}
          permissionCodes={permissionCodes}
        />
        <div className="flex flex-1 flex-col h-screen">
          <Header
            role={role}
            email={email}
            displayName={session && 'displayName' in session ? session.displayName ?? null : null}
            permissionCodes={permissionCodes}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <main className="flex-1 overflow-y-auto p-4 transition-all duration-200 sm:p-6">
            <section className="mx-auto max-w-3xl rounded-2xl border border-slate/10 bg-white p-8 text-center">
              <h1 className="text-2xl font-semibold text-ink">Permission Not Available</h1>
              <p className="mt-2 text-sm text-slate">
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
    <div className="flex h-screen bg-sand">
      <Sidebar 
        role={role} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        schoolName={session?.schoolName ?? undefined}
        permissionCodes={permissionCodes}
      />
      <div className="flex flex-1 flex-col h-screen">
        <Header 
          role={role} 
          email={email} 
          displayName={session && 'displayName' in session ? session.displayName ?? null : null}
          permissionCodes={permissionCodes}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        />
        <main className="flex-1 overflow-y-auto p-4 transition-all duration-200 sm:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {children}
          </div>
        </main>
        <footer className="theme-footer border-t border-white/10 px-4 py-3 text-xs text-white/80 transition-all duration-200 sm:px-6 backdrop-blur-md flex-shrink-0">
          <div className="mx-auto max-w-7xl">
            SAAPT • School Management Console
          </div>
        </footer>
      </div>
    </div>
  );
}
