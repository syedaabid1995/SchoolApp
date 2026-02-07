'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ThemeContext } from './ThemeProvider';
import { listParentChildren, getParentProfile, type ParentChild } from '../services/parentPortal.service';
import { logout } from '../services/auth.service';

export const ParentChildContext = createContext<{
  activeChildId: string;
  setActiveChildId: (id: string) => void;
  children: ParentChild[];
}>({
  activeChildId: '',
  setActiveChildId: () => undefined,
  children: [],
});

const navItems = [
  { label: 'Dashboard', href: '/parent/dashboard' },
  { label: 'Attendance', href: '/parent/attendance' },
  { label: 'Exams & Results', href: '/parent/exams' },
  { label: 'Subjects', href: '/parent/subjects' },
  { label: 'Timetable', href: '/parent/timetable' },
  { label: 'Notices', href: '/parent/notices' },
  { label: 'Fees', href: '/parent/fees' },
  { label: 'Profile', href: '/parent/profile' },
];

export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logoUrl } = useContext(ThemeContext);
  const { data: childrenData } = useQuery({
    queryKey: ['parent-children'],
    queryFn: listParentChildren,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const { data: profile } = useQuery({
    queryKey: ['parent-profile'],
    queryFn: getParentProfile,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const [activeChildId, setActiveChildId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!activeChildId && childrenData?.length) {
      setActiveChildId(childrenData[0].id);
    }
  }, [activeChildId, childrenData]);

  const activeChild = useMemo(
    () => (childrenData ?? []).find((child) => child.id === activeChildId),
    [childrenData, activeChildId],
  );

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.replace('/parent/login');
    }
  };

  return (
    <ParentChildContext.Provider
      value={{
        activeChildId,
        setActiveChildId,
        children: childrenData ?? [],
      }}
    >
    <div className="flex h-screen bg-sand">
      <aside
        className={`theme-navbar fixed left-0 top-0 z-50 flex h-screen w-64 transform flex-col border-r border-slate/10 px-4 py-6 text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-3 flex-shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School Logo" className="h-9 w-9 rounded-md object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-md bg-white/10" />
          )}
          <p className="text-xs uppercase text-white/70">PARENT PORTAL</p>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-white/70 lg:hidden">
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-2 overflow-y-auto flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <div className="flex flex-1 flex-col h-screen">
        <header className="theme-header sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate/10 px-4 py-4 text-white sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="rounded-md p-2 text-white/80 hover:bg-white/10 lg:hidden"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-semibold text-white">Welcome, {profile?.name || 'Parent'}</h2>
              <p className="text-sm text-white/80">Parent Console • View only</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white sm:inline-block">
              {profile?.schoolName || 'School'}
            </div>
            <select
              value={activeChildId}
              onChange={(e) => setActiveChildId(e.target.value)}
              className="min-w-[220px] rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            >
              <option value="">{childrenData?.length ? 'Select Child' : 'No linked children'}</option>
              {(childrenData ?? []).map((child: ParentChild) => (
                <option key={child.id} value={child.id} className="text-ink">
                  {child.name} • {child.classLabel}
                </option>
              ))}
            </select>
            <button
              onClick={handleLogout}
              className="rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/50"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>

        <footer className="theme-footer border-t border-white/10 px-4 py-3 text-xs text-white/80 sm:px-6">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <span>View-only access</span>
            <span>Active child: {activeChild?.name || '—'}</span>
          </div>
        </footer>
      </div>
    </div>
    </ParentChildContext.Provider>
  );
}
