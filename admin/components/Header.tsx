'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { logout } from '../services/auth.service';
import { listNotificationSummary } from '../services/notificationSummary.service';

export type DashboardThemeMode = 'light' | 'dark';

const resolveConsoleTitle = (role: string | null) => {
  if (role === 'SUPER_ADMIN') return 'Super Admin Console';
  if (role === 'SCHOOL_ADMIN') return 'School Admin Console';
  if (role === 'TEACHER') return 'Teacher Console';
  if (role === 'ACCOUNTANT') return 'Accounts Console';
  if (role === 'LIBRARIAN') return 'Library Console';
  return 'Admin Console';
};

const initials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

export const Header = ({
  role,
  email,
  displayName,
  onMenuToggle,
  themeMode,
  onThemeModeChange,
}: {
  role: string | null;
  email: string | null;
  displayName?: string | null;
  permissionCodes?: string[];
  onMenuToggle?: () => void;
  themeMode: DashboardThemeMode;
  onThemeModeChange: (mode: DashboardThemeMode) => void;
}) => {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const { data: notificationData, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: listNotificationSummary,
    enabled: showNotifications,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!showNotifications && !showProfile) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications, showProfile]);

  const resolvedName = displayName || email?.split('@')[0] || 'User';
  const roleLabel = role ? role.replace(/_/g, ' ') : 'USER';
  const notificationCount = notificationData?.items?.length ?? 0;

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const toggleTheme = () => {
    onThemeModeChange(themeMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--shell-border)] bg-[var(--shell-header)] px-4 py-3 text-[var(--shell-text)] shadow-sm backdrop-blur-xl transition-colors sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-2 text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)] lg:hidden"
            aria-label="Open navigation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--shell-text)] sm:text-lg">
              {resolveConsoleTitle(role)}
            </h2>
            <p className="truncate text-xs text-[var(--shell-muted)] sm:text-sm">
              Signed in as {resolvedName}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm font-semibold text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"
            aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="text-xs font-black">{themeMode === 'dark' ? 'LT' : 'DK'}</span>
            <span className="hidden sm:inline">{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]"
              aria-label="Notifications"
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowProfile(false);
              }}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-5-5.9V4a1 1 0 10-2 0v1.1A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9"
                />
              </svg>
              {notificationCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              ) : null}
            </button>
            {showNotifications ? (
              <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-3 text-sm text-[var(--shell-text)] shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Notifications</p>
                  <span className="text-xs text-[var(--shell-muted)]">{notificationCount} new</span>
                </div>
                <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                  {isNotificationsLoading ? (
                    <div className="h-16 animate-pulse rounded-xl bg-[var(--shell-hover)]" />
                  ) : notificationData?.items?.length ? (
                    notificationData.items.map((item) => {
                      const content = (
                        <div className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-subtle)] p-3 hover:bg-[var(--shell-hover)]">
                          <p className="font-semibold text-[var(--shell-text)]">{item.title}</p>
                          {item.message ? <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">{item.message}</p> : null}
                        </div>
                      );
                      return item.href ? (
                        <Link key={item.id} href={item.href} prefetch={false} className="block">
                          {content}
                        </Link>
                      ) : (
                        <div key={item.id}>{content}</div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-4 text-center text-xs text-[var(--shell-muted)]">
                      No notifications yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setShowProfile((prev) => !prev);
                setShowNotifications(false);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-2 pr-3 text-left hover:bg-[var(--shell-hover)]"
              aria-label="Profile menu"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--shell-accent)] text-xs font-bold text-white">
                {initials(resolvedName)}
              </span>
              <span className="hidden max-w-32 sm:block">
                <span className="block truncate text-xs font-bold text-[var(--shell-text)]">{resolvedName}</span>
                <span className="block truncate text-[11px] text-[var(--shell-muted)]">{roleLabel}</span>
              </span>
            </button>

            {showProfile ? (
              <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-3 text-sm text-[var(--shell-text)] shadow-xl">
                <div className="rounded-xl bg-[var(--shell-subtle)] p-3">
                  <p className="font-bold">{resolvedName}</p>
                  <p className="mt-1 break-all text-xs text-[var(--shell-muted)]">{email ?? 'No email'}</p>
                  <p className="mt-2 inline-flex rounded-full border border-[var(--shell-border)] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--shell-muted)]">
                    {roleLabel}
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  <Link
                    href="/dashboard/settings/security"
                    prefetch={false}
                    className="block rounded-xl px-3 py-2 font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                  >
                    Profile & Security
                  </Link>
                  <Link
                    href="/change-password"
                    prefetch={false}
                    className="block rounded-xl px-3 py-2 font-semibold text-[var(--shell-text)] hover:bg-[var(--shell-hover)]"
                  >
                    Change Password
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full rounded-xl px-3 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};
