'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '../services/auth.service';
import { NotificationProvider } from './NotificationProvider';
import { usePathname, useRouter } from 'next/navigation';

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
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const pathname = usePathname();
  const router = useRouter();
  const isSubscriptionRestricted = Boolean(session?.subscriptionRestricted);

  useEffect(() => {
    if (isSubscriptionRestricted && pathname !== '/dashboard/plans') {
      router.replace('/dashboard/plans');
    }
  }, [isSubscriptionRestricted, pathname, router]);

  if (isSubscriptionRestricted) {
    return (
      <NotificationProvider>
        <main className="min-h-screen bg-sand p-4 sm:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </NotificationProvider>
    );
  }
  
  return (
    <NotificationProvider>
      <div className="flex h-screen bg-sand">
        <Sidebar 
          role={role} 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          schoolName={session?.schoolName ?? undefined}
        />
        <div className="flex flex-1 flex-col h-screen">
          <Header 
            role={role} 
            email={email} 
            displayName={session && 'displayName' in session ? session.displayName ?? null : null}
            onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
          />
          <main className="flex-1 overflow-y-auto p-4 transition-all duration-200 sm:p-6">
            <div className="mx-auto max-w-7xl animate-fade-in">
              {children}
            </div>
          </main>
          <footer className="theme-footer border-t border-white/10 px-4 py-3 text-xs text-white/80 transition-all duration-200 sm:px-6 backdrop-blur-md flex-shrink-0">
            <div className="mx-auto max-w-7xl">
              TechStage IT • School Management Console
            </div>
          </footer>
        </div>
      </div>
    </NotificationProvider>
  );
}
