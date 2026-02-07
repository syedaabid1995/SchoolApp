'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { logout } from '../services/auth.service';
import { listNotificationSummary } from '../services/notificationSummary.service';

const resolveConsoleTitle = (role: string | null) => {
  if (role === 'SUPER_ADMIN') return 'Super Admin Console';
  if (role === 'SCHOOL_ADMIN') return 'School Admin Console';
  if (role === 'TEACHER') return 'Teacher Console';
  return 'Admin Console';
};

export const Header = ({
  role,
  email,
  displayName,
  permissionCodes = [],
  onMenuToggle,
}: {
  role: string | null;
  email: string | null;
  displayName?: string | null;
  permissionCodes?: string[];
  onMenuToggle?: () => void;
}) => {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const { data: notificationData } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: listNotificationSummary,
  });

  useEffect(() => {
    if (!showNotifications) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);
  const resolvedName = displayName || email?.split('@')[0] || 'User';
  const roleLabel = role ? role.replace(/_/g, ' ') : 'USER';

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="theme-header sticky top-0 z-30 flex items-center justify-between border-b border-slate/10 px-4 py-4 text-white transition-all duration-200 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="rounded-md p-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white transition-colors duration-200">
            Welcome, {resolvedName}
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-white/80 transition-colors duration-200">{resolveConsoleTitle(role)}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative" ref={notificationRef}>
          <button
            className="relative rounded-md p-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white"
            aria-label="Notifications"
            onClick={() => setShowNotifications((prev) => !prev)}
          >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-5-5.9V4a1 1 0 10-2 0v1.1A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9"
            />
          </svg>
          {(notificationData?.items?.length ?? 0) > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-400" />
          ) : null}
          </button>
          {showNotifications ? (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate/10 bg-white p-3 text-sm text-slate shadow-lg">
              <p className="text-xs font-semibold text-ink">Notifications</p>
              <div className="mt-2 space-y-2">
                {notificationData?.items?.length ? (
                  notificationData.items.map((item) => {
                    const content = (
                      <div className="rounded-lg border border-slate/10 p-2">
                        <p className="font-medium text-ink">{item.title}</p>
                        {item.message ? <p className="text-xs text-slate">{item.message}</p> : null}
                      </div>
                    );
                    return item.href ? (
                      <Link key={item.id} href={item.href} className="block hover:opacity-90">
                        {content}
                      </Link>
                    ) : (
                      <div key={item.id}>{content}</div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-slate/10 p-2 text-xs text-slate">
                    No notifications yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/10 hover:border-white/50"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
