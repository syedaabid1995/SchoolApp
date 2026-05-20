'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { logout } from '../services/auth.service';
import { listNotificationSummary } from '../services/notificationSummary.service';

export type DashboardThemeMode = 'light' | 'dark' | 'system';
export type DashboardResolvedThemeMode = 'light' | 'dark';

const ThemeIcon = ({
  name,
  className = 'h-4 w-4',
}: {
  name: DashboardThemeMode | 'bell' | 'menu' | 'profile';
  className?: string;
}) => {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }

  if (name === 'dark') {
    return (
      <svg {...common}>
        <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />
      </svg>
    );
  }

  if (name === 'system') {
    return (
      <svg {...common}>
        <path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9A1.5 1.5 0 0 1 19 16.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5Z" />
        <path d="M9 20h6" />
        <path d="M12 16.5V20" />
      </svg>
    );
  }

  if (name === 'menu') {
    return (
      <svg {...common}>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    );
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
        <path d="M15 17a3 3 0 0 1-6 0" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
};

const resolveConsoleTitle = (role: string | null, override?: string) => {
  if (role === 'SUPER_ADMIN') return override || 'Super Admin Console';
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

type GlobalSearchItem = {
  title: string;
  description: string;
  href: string;
  group: string;
  keywords: string[];
};

const superAdminSearchItems: GlobalSearchItem[] = [
  {
    title: 'Dashboard',
    description: 'Open platform overview and KPIs',
    href: '/dashboard',
    group: 'Overview',
    keywords: ['dashboard', 'home', 'overview', 'kpi', 'summary'],
  },
  {
    title: 'Analytics',
    description: 'View platform analytics',
    href: '/dashboard/analytics',
    group: 'Overview',
    keywords: ['analytics', 'chart', 'metrics', 'growth'],
  },
  {
    title: 'Reports',
    description: 'Open role-aware reports',
    href: '/dashboard/reports',
    group: 'Overview',
    keywords: ['reports', 'school report', 'revenue report', 'audit report'],
  },
  {
    title: 'Schools',
    description: 'Manage school tenants',
    href: '/dashboard/schools',
    group: 'Management',
    keywords: ['school', 'schools', 'tenant', 'campus'],
  },
  {
    title: 'Add School',
    description: 'Open create school drawer',
    href: '/dashboard/schools?action=create',
    group: 'Management',
    keywords: ['add school', 'create school', 'new school', 'tenant create'],
  },
  {
    title: 'Users',
    description: 'Manage platform users',
    href: '/dashboard/users',
    group: 'Management',
    keywords: ['users', 'user management', 'admin users', 'teacher', 'parent', 'student'],
  },
  {
    title: 'Subscriptions',
    description: 'Manage school subscription lifecycle',
    href: '/dashboard/subscriptions',
    group: 'Management',
    keywords: ['subscription', 'billing', 'trial', 'renew', 'plan', 'payment'],
  },
  {
    title: 'Support Tickets',
    description: 'View and respond to school support tickets',
    href: '/dashboard/support',
    group: 'Management',
    keywords: ['support', 'ticket', 'help', 'issue', 'priority'],
  },
  {
    title: 'Create Support Ticket',
    description: 'Open support ticket creation',
    href: '/dashboard/support?action=create',
    group: 'Management',
    keywords: ['create support', 'new ticket', 'add ticket', 'support create'],
  },
  {
    title: 'Audit Logs',
    description: 'Inspect global audit and security events',
    href: '/dashboard/logs',
    group: 'Security',
    keywords: ['audit', 'logs', 'security logs', 'activity', 'export'],
  },
  {
    title: 'Themes',
    description: 'Manage theme tokens and publishing',
    href: '/dashboard/settings?tab=theme',
    group: 'Settings',
    keywords: ['theme', 'themes', 'color', 'publish', 'rollback'],
  },
  {
    title: 'Login Branding',
    description: 'Customize login page branding',
    href: '/dashboard/settings?tab=branding',
    group: 'Settings',
    keywords: ['branding', 'login branding', 'logo', 'login page'],
  },
  {
    title: 'System Health',
    description: 'Check API, database, Redis, queues, storage',
    href: '/dashboard/system-health',
    group: 'Health',
    keywords: ['health', 'system', 'database', 'redis', 'queue', 'storage'],
  },
  {
    title: 'Backups',
    description: 'Open backup and restore settings',
    href: '/dashboard/settings?tab=backups',
    group: 'Settings',
    keywords: ['backup', 'restore', 'database backup'],
  },
  {
    title: 'Compliance',
    description: 'Open compliance settings and operations',
    href: '/dashboard/settings?tab=compliance',
    group: 'Settings',
    keywords: ['compliance', 'data export', 'deletion', 'consent', 'privacy'],
  },
  {
    title: 'Settings',
    description: 'Open platform settings',
    href: '/dashboard/settings',
    group: 'Settings',
    keywords: ['settings', 'configuration', 'setup'],
  },
  {
    title: 'Security Settings',
    description: 'Open security and MFA settings',
    href: '/dashboard/settings?tab=security',
    group: 'Settings',
    keywords: ['security', 'mfa', 'password', 'session'],
  },
  {
    title: 'Messaging Settings',
    description: 'Open SMS, WhatsApp, and Email provider settings',
    href: '/dashboard/settings?tab=messaging',
    group: 'Settings',
    keywords: ['sms', 'whatsapp', 'wati', 'twilio', 'msg91', 'email', 'message', 'provider', 'notification'],
  },
  {
    title: 'Access Control',
    description: 'Manage role permissions',
    href: '/dashboard/settings?tab=access',
    group: 'Settings',
    keywords: ['access', 'permission', 'roles', 'rbac'],
  },
];

const buildSearchHref = (href: string, query: string) => {
  const trimmed = query.trim();
  if (!trimmed) return href;
  if (href === '/dashboard/schools') return `${href}?query=${encodeURIComponent(trimmed)}`;
  if (['/dashboard/users', '/dashboard/subscriptions', '/dashboard/support', '/dashboard/logs'].includes(href)) {
    return `${href}?search=${encodeURIComponent(trimmed)}`;
  }
  return href;
};

export const Header = ({
  role,
  email,
  displayName,
  onMenuToggle,
  themeMode,
  resolvedThemeMode,
  onThemeModeChange,
  consoleTitle,
}: {
  role: string | null;
  email: string | null;
  displayName?: string | null;
  permissionCodes?: string[];
  onMenuToggle?: () => void;
  themeMode: DashboardThemeMode;
  resolvedThemeMode: DashboardResolvedThemeMode;
  onThemeModeChange: (mode: DashboardThemeMode) => void;
  consoleTitle?: string;
}) => {
  const router = useRouter();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const { data: notificationData, isLoading: isNotificationsLoading } = useQuery({
    queryKey: ['notification-summary'],
    queryFn: listNotificationSummary,
    enabled: showNotifications,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!showNotifications && !showProfile && !showGlobalSearch) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfile(false);
      }
      const clickedInsideSearch =
        Boolean(desktopSearchRef.current?.contains(target)) || Boolean(mobileSearchRef.current?.contains(target));
      if (!clickedInsideSearch) {
        setShowGlobalSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications, showProfile, showGlobalSearch]);

  const resolvedName = displayName || email?.split('@')[0] || 'User';
  const roleLabel = role ? role.replace(/_/g, ' ') : 'USER';
  const notificationCount = notificationData?.items?.length ?? 0;
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const globalSearchResults = useMemo(() => {
    const trimmed = globalSearchQuery.trim().toLowerCase();
    const matches = trimmed
      ? superAdminSearchItems.filter((item) => {
          const haystack = [item.title, item.description, item.group, ...item.keywords].join(' ').toLowerCase();
          return haystack.includes(trimmed);
        })
      : superAdminSearchItems;

    const directSearchItems =
      trimmed.length >= 2
        ? [
            {
              title: `Search schools for "${globalSearchQuery.trim()}"`,
              description: 'Open Schools with this search applied',
              href: `/dashboard/schools?query=${encodeURIComponent(globalSearchQuery.trim())}`,
              group: 'Search',
              keywords: [],
            },
            {
              title: `Search users for "${globalSearchQuery.trim()}"`,
              description: 'Open Users with this search applied',
              href: `/dashboard/users?search=${encodeURIComponent(globalSearchQuery.trim())}`,
              group: 'Search',
              keywords: [],
            },
            {
              title: `Search subscriptions for "${globalSearchQuery.trim()}"`,
              description: 'Open Subscriptions with this search applied',
              href: `/dashboard/subscriptions?search=${encodeURIComponent(globalSearchQuery.trim())}`,
              group: 'Search',
              keywords: [],
            },
            {
              title: `Search support tickets for "${globalSearchQuery.trim()}"`,
              description: 'Open Support with this search applied',
              href: `/dashboard/support?search=${encodeURIComponent(globalSearchQuery.trim())}`,
              group: 'Search',
              keywords: [],
            },
            {
              title: `Search audit logs for "${globalSearchQuery.trim()}"`,
              description: 'Open Audit Logs with this search applied',
              href: `/dashboard/logs?search=${encodeURIComponent(globalSearchQuery.trim())}`,
              group: 'Search',
              keywords: [],
            },
          ]
        : [];

    return [...directSearchItems, ...matches.map((item) => ({ ...item, href: buildSearchHref(item.href, globalSearchQuery) }))].slice(0, 10);
  }, [globalSearchQuery]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const runGlobalSearch = (href: string) => {
    router.push(href);
    setShowGlobalSearch(false);
    setGlobalSearchQuery('');
  };

  const handleGlobalSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstResult = globalSearchResults[0];
    if (firstResult) runGlobalSearch(firstResult.href);
  };

  const themeOptions: Array<{ mode: DashboardThemeMode; label: string }> = [
    { mode: 'light', label: 'Light' },
    { mode: 'dark', label: 'Dark' },
    { mode: 'system', label: 'System' },
  ];

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
            <ThemeIcon name="menu" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--shell-text)] sm:text-lg">
              {resolveConsoleTitle(role, consoleTitle)}
            </h2>
            <p className="truncate text-xs text-[var(--shell-muted)] sm:text-sm">
              Signed in as {resolvedName}
            </p>
          </div>
        </div>

        {isSuperAdmin ? (
          <div ref={desktopSearchRef} className="relative hidden min-w-0 flex-1 justify-center px-2 lg:flex">
            <form onSubmit={handleGlobalSearchSubmit} className="w-full max-w-xl">
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--shell-muted)]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                </span>
                <input
                  value={globalSearchQuery}
                  onChange={(event) => {
                    setGlobalSearchQuery(event.target.value);
                    setShowGlobalSearch(true);
                  }}
                  onFocus={() => setShowGlobalSearch(true)}
                  placeholder="Search pages, schools, users, tickets..."
                  className="h-10 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] pl-10 pr-24 text-sm font-medium text-[var(--shell-text)] outline-none placeholder:text-[var(--shell-muted)] focus:border-[var(--shell-accent)] focus:ring-4 focus:ring-blue-500/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--shell-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--shell-muted)]">
                  Enter
                </span>
              </label>
            </form>
            {showGlobalSearch ? (
              <div className="absolute left-2 right-2 top-12 z-40 mx-auto max-w-xl overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] text-sm text-[var(--shell-text)] shadow-2xl">
                <div className="border-b border-[var(--shell-border)] px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--shell-muted)]">
                  Super Admin Search
                </div>
                <div className="max-h-96 overflow-y-auto p-2">
                  {globalSearchResults.length ? (
                    globalSearchResults.map((item) => (
                      <button
                        key={`${item.group}-${item.title}-${item.href}`}
                        type="button"
                        onClick={() => runGlobalSearch(item.href)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--shell-hover)]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-[var(--shell-text)]">{item.title}</span>
                          <span className="block truncate text-xs text-[var(--shell-muted)]">{item.description}</span>
                        </span>
                        <span className="shrink-0 rounded-full border border-[var(--shell-border)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--shell-muted)]">
                          {item.group}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--shell-border)] p-4 text-center text-xs text-[var(--shell-muted)]">
                      No matching Super Admin function found.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setShowGlobalSearch((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)] lg:hidden"
              aria-label="Open global search"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
          ) : null}
          <div
            className="inline-flex h-10 items-center rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-1"
            role="group"
            aria-label="Theme mode"
            title={themeMode === 'system' ? `System theme: ${resolvedThemeMode}` : undefined}
          >
            {themeOptions.map((option) => {
              const active = themeMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => onThemeModeChange(option.mode)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-bold transition-colors sm:px-3 ${
                    active
                      ? 'bg-[var(--shell-accent)] text-white shadow-sm'
                      : 'text-[var(--shell-muted)] hover:bg-[var(--shell-hover)] hover:text-[var(--shell-text)]'
                  }`}
                  aria-label={`Use ${option.label} theme`}
                  aria-pressed={active}
                >
                  <ThemeIcon name={option.mode} className="h-4 w-4" />
                  <span className="hidden md:inline">{option.label}</span>
                </button>
              );
            })}
          </div>

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
              <ThemeIcon name="bell" className="h-5 w-5" />
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
                    href="/dashboard/settings?tab=security"
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

      {isSuperAdmin && showGlobalSearch ? (
        <div ref={mobileSearchRef} className="relative mt-3 lg:hidden">
          <form onSubmit={handleGlobalSearchSubmit}>
            <input
              value={globalSearchQuery}
              onChange={(event) => setGlobalSearchQuery(event.target.value)}
              placeholder="Search Super Admin..."
              className="h-10 w-full rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-3 text-sm font-medium text-[var(--shell-text)] outline-none placeholder:text-[var(--shell-muted)] focus:border-[var(--shell-accent)]"
              autoFocus
            />
          </form>
          <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-2xl border border-[var(--shell-border)] bg-[var(--shell-card)] text-sm text-[var(--shell-text)] shadow-2xl">
            <div className="max-h-80 overflow-y-auto p-2">
              {globalSearchResults.map((item) => (
                <button
                  key={`${item.group}-${item.title}-${item.href}-mobile`}
                  type="button"
                  onClick={() => runGlobalSearch(item.href)}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-[var(--shell-hover)]"
                >
                  <span className="block font-bold">{item.title}</span>
                  <span className="block text-xs text-[var(--shell-muted)]">{item.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};
