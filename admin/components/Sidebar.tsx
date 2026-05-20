'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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

type IconName =
  | 'activity'
  | 'analytics'
  | 'backup'
  | 'book'
  | 'brand'
  | 'briefcase'
  | 'building'
  | 'calendar'
  | 'card'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'clipboard'
  | 'close'
  | 'file'
  | 'grid'
  | 'id'
  | 'lock'
  | 'message'
  | 'palette'
  | 'portal'
  | 'scale'
  | 'settings'
  | 'shield'
  | 'support'
  | 'transfer'
  | 'users';

const Icon = ({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) => {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'activity':
      return <svg {...common}><path d="M4 13h4l2-7 4 12 2-5h4" /></svg>;
    case 'analytics':
      return <svg {...common}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></svg>;
    case 'backup':
      return <svg {...common}><path d="M7 19h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 9.5 4.5 4.5 0 0 0 7 19Z" /><path d="M12 13v4" /><path d="m9.5 15.5 2.5 2.5 2.5-2.5" /></svg>;
    case 'book':
      return <svg {...common}><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 0-3 3v-18Z" /><path d="M5 18.5A3 3 0 0 1 8 16h10" /></svg>;
    case 'brand':
      return <svg {...common}><path d="M12 3 4.5 7v10L12 21l7.5-4V7L12 3Z" /><path d="M12 8v8" /><path d="m8.5 10 3.5-2 3.5 2" /></svg>;
    case 'briefcase':
      return <svg {...common}><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" /><path d="M9 12h6" /></svg>;
    case 'building':
      return <svg {...common}><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" /><path d="M3 21h18" /><path d="M9 7h3" /><path d="M9 11h3" /><path d="M9 15h3" /></svg>;
    case 'calendar':
      return <svg {...common}><path d="M7 3v3" /><path d="M17 3v3" /><path d="M4 8h16" /><path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5Z" /></svg>;
    case 'card':
      return <svg {...common}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 10h16" /><path d="M7 15h4" /></svg>;
    case 'chart':
      return <svg {...common}><path d="M5 19V5" /><path d="M5 19h14" /><path d="m8 14 3-3 3 2 4-6" /></svg>;
    case 'check':
      return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
    case 'clipboard':
      return <svg {...common}><path d="M9 5h6" /><path d="M9 3.5h6A1.5 1.5 0 0 1 16.5 5v1A1.5 1.5 0 0 1 15 7.5H9A1.5 1.5 0 0 1 7.5 6V5A1.5 1.5 0 0 1 9 3.5Z" /><path d="M7.5 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5" /></svg>;
    case 'close':
      return <svg {...common}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>;
    case 'file':
      return <svg {...common}><path d="M7 3.5h7l4 4V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>;
    case 'grid':
      return <svg {...common}><path d="M4 4h7v7H4z" /><path d="M13 4h7v7h-7z" /><path d="M4 13h7v7H4z" /><path d="M13 13h7v7h-7z" /></svg>;
    case 'id':
      return <svg {...common}><path d="M5.5 6h13A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-9A1.5 1.5 0 0 1 5.5 6Z" /><path d="M8 10h4" /><path d="M8 14h3" /><path d="M15.5 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" /></svg>;
    case 'lock':
      return <svg {...common}><path d="M7 10V8a5 5 0 0 1 10 0v2" /><path d="M6.5 10h11A1.5 1.5 0 0 1 19 11.5v7A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5v-7A1.5 1.5 0 0 1 6.5 10Z" /></svg>;
    case 'message':
      return <svg {...common}><path d="M5 5.5h14v9H8l-3 3v-12Z" /><path d="M8 9h8" /><path d="M8 12h5" /></svg>;
    case 'palette':
      return <svg {...common}><path d="M12 4a8 8 0 0 0 0 16h1.2a1.8 1.8 0 0 0 1.2-3.15 1.8 1.8 0 0 1 1.2-3.15H17a3 3 0 0 0 3-3A6.7 6.7 0 0 0 12 4Z" /><path d="M7.8 11h.1" /><path d="M10.3 8h.1" /><path d="M14 8h.1" /></svg>;
    case 'portal':
      return <svg {...common}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" /><path d="M9 12h6" /><path d="m13 9 3 3-3 3" /></svg>;
    case 'scale':
      return <svg {...common}><path d="M12 3v18" /><path d="M6 6h12" /><path d="m6 6-3 7h6L6 6Z" /><path d="m18 6-3 7h6l-3-7Z" /></svg>;
    case 'settings':
      return <svg {...common}><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.3 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" /></svg>;
    case 'shield':
      return <svg {...common}><path d="M12 3.5 5.5 6v5.5c0 4.1 2.6 7.5 6.5 9 3.9-1.5 6.5-4.9 6.5-9V6L12 3.5Z" /><path d="m9 12 2 2 4-5" /></svg>;
    case 'support':
      return <svg {...common}><path d="M5 12a7 7 0 0 1 14 0" /><path d="M5 12v3a2 2 0 0 0 2 2h1v-6H7a2 2 0 0 0-2 2Z" /><path d="M19 12v3a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" /><path d="M12 19h3" /></svg>;
    case 'transfer':
      return <svg {...common}><path d="M7 7h12" /><path d="m16 4 3 3-3 3" /><path d="M17 17H5" /><path d="m8 14-3 3 3 3" /></svg>;
    case 'users':
      return <svg {...common}><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M15.5 10a2.5 2.5 0 1 0 0-5" /><path d="M4 19a5 5 0 0 1 10 0" /><path d="M14 17.5a4 4 0 0 1 6 1.5" /></svg>;
    default:
      return <svg {...common}><path d="M4 4h16v16H4z" /></svg>;
  }
};

const iconForSection = (label: string): IconName => {
  const key = label.toLowerCase();
  if (key.includes('overview')) return 'grid';
  if (key.includes('management')) return 'briefcase';
  if (key.includes('system')) return 'shield';
  if (key.includes('health')) return 'activity';
  if (key.includes('people')) return 'users';
  if (key.includes('academic')) return 'book';
  if (key.includes('operation')) return 'clipboard';
  if (key.includes('setting')) return 'settings';
  return 'grid';
};

const iconForItem = (item: NavItem): IconName => {
  const key = `${item.label} ${item.href}`.toLowerCase();
  if (key.includes('dashboard')) return 'grid';
  if (key.includes('analytics')) return 'analytics';
  if (key.includes('report')) return 'file';
  if (key.includes('school')) return 'building';
  if (key.includes('user') || key.includes('teacher') || key.includes('parent') || key.includes('student')) return 'users';
  if (key.includes('subscription') || key.includes('plan')) return 'card';
  if (key.includes('support')) return 'support';
  if (key.includes('audit') || key.includes('log')) return 'shield';
  if (key.includes('theme')) return 'palette';
  if (key.includes('brand')) return 'brand';
  if (key.includes('health')) return 'activity';
  if (key.includes('backup')) return 'backup';
  if (key.includes('compliance')) return 'scale';
  if (key.includes('security') || key.includes('access')) return 'lock';
  if (key.includes('sms')) return 'message';
  if (key.includes('academic')) return 'book';
  if (key.includes('timetable')) return 'calendar';
  if (key.includes('exam') || key.includes('marks')) return 'clipboard';
  if (key.includes('id card')) return 'id';
  if (key.includes('transfer')) return 'transfer';
  if (key.includes('attendance')) return 'check';
  if (key.includes('assign')) return 'transfer';
  if (key.includes('portal')) return 'portal';
  if (key.includes('setting')) return 'settings';
  return 'file';
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
    id: 'platform-health',
    label: 'Health',
    items: [
      { href: '/dashboard/system-health', label: 'System Health', icon: 'SH' },
    ],
  },
  {
    id: 'platform-settings',
    label: 'Settings',
    items: [
      { href: '/dashboard/settings', label: 'Settings', icon: 'ST' },
      { href: '/dashboard/settings?tab=backups', label: 'Backups', icon: 'BK' },
      { href: '/dashboard/settings?tab=compliance', label: 'Compliance', icon: 'CP' },
    ],
  },
];

const getCodeForPath = (href: string) =>
  EMPLOYEE_PERMISSION_CATALOG.find((permission) => permission.path === href.split('?')[0])?.code;

export const Sidebar = ({
  role,
  isOpen,
  onClose,
  schoolName,
  permissionCodes = [],
  platformName = 'SAAPT',
  platformSubtitle = 'Platform Admin',
}: {
  role: string | null;
  isOpen?: boolean;
  onClose?: () => void;
  schoolName?: string;
  permissionCodes?: string[];
  platformName?: string;
  platformSubtitle?: string;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logoUrl } = useContext(ThemeContext);
  const isPlatform = isSuperAdmin(role);
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const isEmployee = ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'].includes(role ?? '');
  const allowedCodes = useMemo(() => new Set(permissionCodes), [permissionCodes]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const hrefPath = (href: string) => href.split('?')[0];
  const hrefTab = (href: string) => new URLSearchParams(href.split('?')[1] ?? '').get('tab');

  const isActive = (href: string) => {
    const path = hrefPath(href);
    if (path === '/dashboard/settings') {
      const tab = hrefTab(href);
      if (tab) {
        return pathname === path && (searchParams.get('tab') || 'general') === tab;
      }
      return (pathname === path && !searchParams.get('tab')) || pathname.startsWith(`${path}/`);
    }
    return path === '/dashboard' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  };

  const sectionHasActiveItem = (section: NavSection) => section.items.some((item) => isActive(item.href));

  const isAllowedNavItem = (href: string) => {
    if (isPlatform) return true;
    if (href === '/dashboard/settings') return true;
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
          { href: '/dashboard/settings', label: 'Settings', icon: 'ST' },
        ],
      },
    ];

    return sections
      .map((section) => ({ ...section, items: filterItems(section.items) }))
      .filter((section) => section.items.length > 0);
  }, [isSchoolAdmin, isEmployee, isPlatform, allowedCodes]);

  const sections = isPlatform ? platformSections : schoolSections;

  useEffect(() => {
    const activeSection = sections.find((section) => sectionHasActiveItem(section));
    setOpenSections(
      Object.fromEntries(sections.map((section) => [section.id, activeSection ? section.id === activeSection.id : false])),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPlatform, sections.length]);

  const toggleSection = (id: string) => {
    setOpenSections((current) =>
      Object.fromEntries(sections.map((section) => [section.id, section.id === id ? !current[id] : false])),
    );
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        className={`group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
          active
            ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-active-text)] shadow-sm'
            : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
        }`}
        onClick={onClose}
      >
        <span
          className={`absolute -left-[17px] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full border ${
            active
              ? 'border-[var(--shell-sidebar-active)] bg-[var(--shell-sidebar-active)]'
              : 'border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar)] group-hover:border-[var(--shell-sidebar-text)]'
          }`}
        />
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            active
              ? 'bg-[var(--shell-sidebar-icon-active)] text-[var(--shell-sidebar-active-text)]'
              : 'bg-[var(--shell-sidebar-icon)] text-[var(--shell-sidebar-muted)] group-hover:text-[var(--shell-sidebar-text)]'
          }`}
        >
          <Icon name={iconForItem(item)} className="h-4 w-4" />
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
            <p className="truncate text-sm font-bold">{isPlatform ? platformName : schoolName || 'School Console'}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--shell-sidebar-muted)]">
              {isPlatform ? platformSubtitle : 'School Workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)] lg:hidden"
            aria-label="Close navigation"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {sections.map((section) => {
            const isOpenSection = openSections[section.id] ?? false;
            const activeSection = sectionHasActiveItem(section);
            return (
              <div
                key={section.id}
                className={`rounded-2xl border transition-colors ${
                  activeSection
                    ? 'border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar-card)]'
                    : 'border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
                    activeSection
                      ? 'text-[var(--shell-sidebar-text)]'
                      : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
                  }`}
                  aria-expanded={isOpenSection}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      activeSection
                        ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-active-text)]'
                        : 'bg-[var(--shell-sidebar-icon)] text-[var(--shell-sidebar-muted)]'
                    }`}
                  >
                    <Icon name={iconForSection(section.label)} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
                  <span className="rounded-full border border-[var(--shell-sidebar-border)] px-2 py-0.5 text-[10px] tracking-normal text-[var(--shell-sidebar-muted)]">
                    {section.items.length}
                  </span>
                  <span className={`transition-transform ${isOpenSection ? 'rotate-90' : ''}`}>
                    <Icon name="chevron" className="h-4 w-4" />
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isOpenSection ? 'max-h-[720px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="relative ml-7 mt-1 space-y-1 border-l border-[var(--shell-sidebar-border)] py-1 pl-4 pr-1">
                    {section.items.map(renderItem)}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-auto border-t border-[var(--shell-sidebar-border)] pt-3">
            <a
              href="/parent/login"
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]"
              target="_blank"
              rel="noreferrer"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--shell-sidebar-icon)]">
                <Icon name="portal" className="h-4 w-4" />
              </span>
              Parent Portal
            </a>
          </div>
        </nav>
      </aside>
    </>
  );
};
