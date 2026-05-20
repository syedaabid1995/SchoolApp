'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useMemo, useState } from 'react';
import { EMPLOYEE_PERMISSION_CATALOG } from '../config/employee-permissions';
import { isSuperAdmin } from '../utils/roles';
import { ThemeContext } from './ThemeProvider';

type NavItem = {
  href: string;
  label: string;
  icon?: string;
  permissionPath?: string;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const academicItems: NavItem[] = [
  { href: '/dashboard/academics', label: 'Academic Setup', icon: 'AS' },
  { href: '/dashboard/academics/timetable', label: 'Timetable', icon: 'TT' },
  { href: '/dashboard/academics/exams', label: 'Exams', icon: 'EX' },
  { href: '/dashboard/academics/marks', label: 'Upload Marks', icon: 'MK' },
];

const studentItems: NavItem[] = [
  { href: '/dashboard/students/add', label: 'Add Student', icon: 'AD' },
  { href: '/dashboard/students', label: 'Student List', icon: 'SL' },
  { href: '/dashboard/id-cards', label: 'ID Cards', icon: 'ID' },
  { href: '/dashboard/students/transfers', label: 'Transfer Requests', icon: 'TR' },
];

const employeeItems: NavItem[] = [
  { href: '/dashboard/teachers/add', label: 'Add User', icon: 'AU' },
  { href: '/dashboard/teachers/assign', label: 'Assign Classes', icon: 'AC' },
  { href: '/dashboard/teachers', label: 'List Users', icon: 'LU' },
];

const platformSections: NavSection[] = [
  {
    id: 'platform-overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'DB' },
      { href: '/dashboard/analytics', label: 'Analytics', icon: 'AN' },
      { href: '/dashboard/reports', label: 'Reports', icon: 'RP' },
    ],
  },
  {
    id: 'platform-management',
    label: 'Management',
    items: [
      { href: '/dashboard/schools', label: 'Schools', icon: 'SC' },
      { href: '/dashboard/users', label: 'Users', icon: 'US' },
      { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: 'SB' },
      { href: '/dashboard/support', label: 'Support Tickets', icon: 'SP' },
      { href: '/dashboard/logs', label: 'Audit Logs', icon: 'LG' },
    ],
  },
  {
    id: 'platform-system',
    label: 'System',
    items: [
      { href: '/dashboard/themes', label: 'Themes', icon: 'TH' },
      { href: '/dashboard/settings/branding', label: 'Branding', icon: 'BR' },
      { href: '/dashboard/system-health', label: 'System Health', icon: 'SH' },
      { href: '/dashboard/backups', label: 'Backups', icon: 'BK' },
      { href: '/dashboard/compliance', label: 'Compliance', icon: 'CP' },
    ],
  },
  {
    id: 'platform-settings',
    label: 'Settings',
    items: [
      { href: '/dashboard/settings', label: 'Settings Home', icon: 'ST' },
      { href: '/dashboard/settings/security', label: 'Security', icon: 'SE' },
      { href: '/dashboard/settings/sms', label: 'SMS Settings', icon: 'SM' },
    ],
  },
];

const getCodeForPath = (href: string) =>
  EMPLOYEE_PERMISSION_CATALOG.find((permission) => permission.path === href)?.code;

export const Sidebar = ({
  role,
  isOpen,
  onClose,
  schoolName,
  permissionCodes = [],
}: {
  role: string | null;
  isOpen?: boolean;
  onClose?: () => void;
  schoolName?: string;
  permissionCodes?: string[];
}) => {
  const pathname = usePathname();
  const { logoUrl } = useContext(ThemeContext);
  const isPlatform = isSuperAdmin(role);
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const isEmployee = ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'].includes(role ?? '');
  const allowedCodes = useMemo(() => new Set(permissionCodes), [permissionCodes]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const sectionHasActiveItem = (section: NavSection) => section.items.some((item) => isActive(item.href));

  const isAllowedNavItem = (href: string) => {
    if (isPlatform) return true;
    if (!isEmployee && !isSchoolAdmin) return true;
    const code = getCodeForPath(href);
    if (!code) return isSchoolAdmin;
    return allowedCodes.has(code);
  };

  const filterItems = (items: NavItem[]) => items.filter((item) => isAllowedNavItem(item.permissionPath ?? item.href));

  const schoolSections = useMemo<NavSection[]>(() => {
    const sections: NavSection[] = [
      {
        id: 'school-overview',
        label: 'Overview',
        items: [
          { href: '/dashboard', label: 'Dashboard', icon: 'DB' },
          { href: '/dashboard/reports', label: 'Reports', icon: 'RP' },
          ...(isSchoolAdmin ? [{ href: '/dashboard/plans', label: 'Plans', icon: 'PL' }] : []),
        ],
      },
      ...(isSchoolAdmin
        ? [
            {
              id: 'people',
              label: 'People',
              items: [...employeeItems, ...studentItems],
            },
          ]
        : []),
      {
        id: 'academics',
        label: 'Academics',
        items: academicItems,
      },
      {
        id: 'operations',
        label: 'Operations',
        items: [
          { href: '/dashboard/attendance', label: 'Attendance', icon: 'AT' },
          { href: '/dashboard/support', label: 'Support', icon: 'SP' },
          ...(isSchoolAdmin ? [{ href: '/dashboard/audit', label: 'Audit Logs', icon: 'LG' }] : []),
        ],
      },
      {
        id: 'school-settings',
        label: 'Settings',
        items: [
          ...(isSchoolAdmin ? [{ href: '/dashboard/settings/access', label: 'Access Control', icon: 'AC' }] : []),
          ...(isSchoolAdmin ? [{ href: '/dashboard/settings/branding', label: 'Branding', icon: 'BR' }] : []),
          { href: '/dashboard/settings/security', label: 'Security', icon: 'SE' },
          ...(isSchoolAdmin ? [{ href: '/dashboard/settings/sms', label: 'SMS Settings', icon: 'SM' }] : []),
        ],
      },
    ];

    return sections
      .map((section) => ({ ...section, items: filterItems(section.items) }))
      .filter((section) => section.items.length > 0);
  }, [isSchoolAdmin, isEmployee, isPlatform, allowedCodes]);

  const sections = isPlatform ? platformSections : schoolSections;

  useEffect(() => {
    setOpenSections((current) => {
      const next = { ...current };
      sections.forEach((section) => {
        if (sectionHasActiveItem(section)) next[section.id] = true;
        if (next[section.id] === undefined) next[section.id] = isPlatform || section.items.length <= 4;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPlatform, sections.length]);

  const toggleSection = (id: string) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }));
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
          active
            ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-active-text)] shadow-sm'
            : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
        }`}
        onClick={onClose}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
            active
              ? 'bg-[var(--shell-sidebar-icon-active)] text-[var(--shell-sidebar-active-text)]'
              : 'bg-[var(--shell-sidebar-icon)] text-[var(--shell-sidebar-muted)] group-hover:text-[var(--shell-sidebar-text)]'
          }`}
        >
          {item.icon ?? item.label.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-300 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 transform flex-col border-r border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar)] px-4 py-4 text-[var(--shell-sidebar-text)] shadow-2xl shadow-slate-950/10 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex shrink-0 items-center gap-3 rounded-2xl border border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar-card)] p-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School logo" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icon.png" alt="SchoolApp" className="h-9 w-9 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{isPlatform ? 'SAAPT' : schoolName || 'School Console'}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--shell-sidebar-muted)]">
              {isPlatform ? 'Platform Admin' : 'School Workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)] lg:hidden"
            aria-label="Close navigation"
          >
            X
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {sections.map((section) => {
            const isOpenSection = openSections[section.id] ?? false;
            return (
              <div key={section.id} className="rounded-2xl">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] transition-colors ${
                    sectionHasActiveItem(section)
                      ? 'text-[var(--shell-sidebar-text)]'
                      : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
                  }`}
                >
                  <span>{section.label}</span>
                  <span className={`text-sm transition-transform ${isOpenSection ? 'rotate-90' : ''}`}>{'>'}</span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isOpenSection ? 'max-h-[720px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="mt-1 space-y-1 pl-1">
                    {section.items.map(renderItem)}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-auto border-t border-[var(--shell-sidebar-border)] pt-3">
            <a
              href="/parent/login"
              className="flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-semibold text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]"
              target="_blank"
              rel="noreferrer"
            >
              Parent Portal
            </a>
          </div>
        </nav>
      </aside>
    </>
  );
};
