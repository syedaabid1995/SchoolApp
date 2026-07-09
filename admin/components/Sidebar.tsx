'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useContext, useEffect, useMemo, useState } from 'react';
import { getRequiredPermissionForPath } from '../config/employee-permissions';
import { isSuperAdmin } from '../utils/roles';
import { AppIcon, type AppIconName } from './AppIcon';
import { ThemeContext } from './ThemeProvider';

type NavItem = {
  href: string;
  label: string;
  icon?: AppIconName;
  permissionPath?: string;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const iconForSection = (label: string): AppIconName => {
  const key = label.toLowerCase();
  if (key.includes('overview')) return 'layoutDashboard';
  if (key === 'dashboard') return 'layoutDashboard';
  if (key.includes('admin')) return 'briefcase';
  if (key.includes('management')) return 'briefcase';
  if (key.includes('system')) return 'shield';
  if (key.includes('health')) return 'activity';
  if (key.includes('people')) return 'users';
  if (key.includes('student')) return 'users';
  if (key.includes('teacher') || key.includes('human')) return 'briefcase';
  if (key.includes('academic')) return 'book';
  if (key.includes('examination')) return 'clipboard';
  if (key.includes('leave')) return 'calendar';
  if (key.includes('account') || key.includes('fee')) return 'card';
  if (key.includes('communicate')) return 'message';
  if (key.includes('library') || key.includes('homework')) return 'book';
  if (key.includes('transport')) return 'transfer';
  if (key.includes('inventory') || key.includes('dormitory')) return 'building';
  if (key.includes('report')) return 'chart';
  if (key.includes('operation')) return 'clipboard';
  if (key.includes('setting')) return 'settings';
  return 'grid';
};

const iconForItem = (item: NavItem): AppIconName => {
  if (item.icon) return item.icon;

  const label = item.label.toLowerCase();
  const path = item.href.split('?')[0].toLowerCase();
  const key = `${label} ${path}`.toLowerCase();
  if (label === 'dashboard' || path === '/dashboard') return 'layoutDashboard';
  if (key.includes('system requirement') || key.includes('getting started') || key.includes('installation')) return 'activity';
  if (key.includes('admission') || key.includes('visitor') || key.includes('postal') || key.includes('phone call')) return 'clipboard';
  if (key.includes('complaint')) return 'headset';
  if (key.includes('certificate')) return 'file';
  if (key.includes('report')) return 'chart';
  if (key.includes('school')) return 'school';
  if (key.includes('user') || key.includes('teacher') || key.includes('parent') || key.includes('student')) return 'users';
  if (key.includes('billing')) return 'invoice';
  if (key.includes('catalog')) return 'package';
  if (key.includes('subscription') || key.includes('plan')) return 'refresh';
  if (key.includes('support')) return 'ticket';
  if (key.includes('audit') || key.includes('log')) return 'history';
  if (key.includes('theme')) return 'palette';
  if (key.includes('brand')) return 'brand';
  if (key.includes('health')) return 'activity';
  if (key.includes('backup')) return 'backup';
  if (key.includes('compliance')) return 'scale';
  if (key.includes('security') || key.includes('access') || key.includes('password')) return 'lock';
  if (key.includes('leave')) return 'calendar';
  if (key.includes('fee')) return 'wallet';
  if (key.includes('sms')) return 'message';
  if (key.includes('academic')) return 'book';
  if (key.includes('class room')) return 'building';
  if (key.includes('period') || key.includes('routine')) return 'calendar';
  if (key.includes('class') || key.includes('section') || key.includes('subject')) return 'book';
  if (key.includes('timetable')) return 'calendar';
  if (key.includes('exam') || key.includes('marks')) return 'clipboard';
  if (key.includes('id card')) return 'id';
  if (key.includes('transfer')) return 'transfer';
  if (key.includes('attendance')) return 'checkCircle';
  if (key.includes('assign')) return 'transfer';
  if (key.includes('portal')) return 'portal';
  if (key.includes('setting')) return 'settings';
  return 'file';
};

const feeNavItems: NavItem[] = [
  { href: '/dashboard/fees/overview', label: 'Fee Overview', icon: 'chart' },
  { href: '/dashboard/fees/groups', label: 'Fee Groups', icon: 'folder' },
  { href: '/dashboard/fees/types', label: 'Fee Types', icon: 'tag' },
  { href: '/dashboard/fees/masters', label: 'Fee Masters', icon: 'clipboard' },
  { href: '/dashboard/fees/collection', label: 'Fee Collection', icon: 'wallet' },
  { href: '/dashboard/fees/discounts', label: 'Fee Discounts', icon: 'percent' },
  { href: '/dashboard/fees/reports', label: 'Fee Reports', icon: 'chart' },
];

const platformSections: NavSection[] = [
  {
    id: 'platform-overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
      { href: '/dashboard/reports', label: 'Reports', icon: 'chart' },
      { href: '/dashboard/accounts/expenses', label: 'Expense Reports', icon: 'wallet' },
      { href: '/dashboard/imports', label: 'Bulk Imports', icon: 'file' },
    ],
  },
  {
    id: 'platform-schools',
    label: 'Schools & Users',
    items: [
      { href: '/dashboard/schools', label: 'Schools', icon: 'school' },
      { href: '/dashboard/users', label: 'Users', icon: 'users' },
    ],
  },
  {
    id: 'platform-subscriptions',
    label: 'Subscriptions',
    items: [
      { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: 'refresh' },
      { href: '/dashboard/billing', label: 'Billing', icon: 'invoice' },
      { href: '/dashboard/catalog', label: 'Catalog', icon: 'package' },
    ],
  },
  {
    id: 'platform-operations',
    label: 'Operations',
    items: [
      { href: '/dashboard/demo-requests', label: 'Demo Requests', icon: 'calendar' },
      { href: '/dashboard/support', label: 'Support Tickets', icon: 'ticket' },
      { href: '/dashboard/audit', label: 'Audit Logs', icon: 'history' },
      { href: '/dashboard/system-health', label: 'System Health', icon: 'monitor' },
    ],
  },
  {
    id: 'platform-settings',
    label: 'System Setup',
    items: [
      { href: '/dashboard/settings?tab=brand', label: 'Branding & Theme', icon: 'palette' },
      { href: '/dashboard/settings?tab=security', label: 'Security', icon: 'shield' },
      // { href: '/dashboard/settings?tab=features', label: 'Feature Flags', icon: 'activity' },
      // { href: '/dashboard/settings?tab=modules', label: 'Modules', icon: 'package' },
      { href: '/dashboard/settings?tab=access', label: 'Access', icon: 'lock' },
      { href: '/dashboard/settings?tab=compliance', label: 'Compliance', icon: 'scale' },
      { href: '/dashboard/backups', label: 'Backups', icon: 'backup' },
      // { href: '/dashboard/settings?tab=advanced', label: 'Advanced', icon: 'settings' },
      { href: '/change-password', label: 'Change Password', icon: 'lock' },
    ],
  },
  {
    id: 'platform-communication',
    label: 'Communicate',
    items: [
      { href: '/dashboard/settings?tab=messaging', label: 'Messaging', icon: 'message' },
      { href: '/dashboard/communication/send-push', label: 'Send Push', icon: 'message' },
      { href: '/dashboard/communication/logs', label: 'Logs', icon: 'history' },
      { href: '/dashboard/communication/push-templates', label: 'Push Templates', icon: 'message' },
    ],
  },
];

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
  const hasAnyRole = Boolean(role);
  const allowedCodes = useMemo(() => new Set(permissionCodes), [permissionCodes]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const hrefPath = (href: string) => href.split('?')[0];
  const hrefTab = (href: string) => new URLSearchParams(href.split('?')[1] ?? '').get('tab');

  const isActive = (href: string) => {
    const path = hrefPath(href);
    if (path === '/dashboard/settings') {
      const tab = hrefTab(href);
      if (tab) {
        return pathname === path && (searchParams.get('tab') || 'brand') === tab;
      }
      return (
        (pathname === path && !searchParams.get('tab')) ||
        (pathname.startsWith(`${path}/`) && !pathname.startsWith(`${path}/branding`))
      );
    }
    if (path === '/dashboard/academics') {
      const tab = hrefTab(href);
      if (tab) {
        return pathname === path && (searchParams.get('tab') || 'academic-years') === tab;
      }
      return pathname === path;
    }
    return path === '/dashboard' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  };

  const sectionHasActiveItem = (section: NavSection) => section.items.some((item) => isActive(item.href));

  const isAllowedNavItem = (href: string) => {
    if (href === '/change-password') return true;
    if (isPlatform) return true;
    if (!hasAnyRole) return false;
    const code = getRequiredPermissionForPath(hrefPath(href));
    if (!code) return false;
    return allowedCodes.has(code);
  };

  const filterItems = (items: NavItem[]) => items.filter((item) => isAllowedNavItem(item.permissionPath ?? item.href));

  const schoolSections = useMemo<NavSection[]>(() => {
    const sections: NavSection[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        items: [
          { href: '/dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
          { href: '/dashboard/onboarding', label: 'Onboarding Readiness', icon: 'checkCircle' },
          { href: '/dashboard/assistant', label: 'AI Assistant', icon: 'sparkles' },
          { href: '/dashboard/imports', label: 'Bulk Imports', icon: 'file' },
        ],
      },
      {
        id: 'academic-setup',
        label: 'Academic Setup',
        items: [
          { href: '/dashboard/academics', label: 'Setup', icon: 'book' },
          { href: '/dashboard/timetable', label: 'Timetable', icon: 'calendar' },
          { href: '/dashboard/attendance/settings', label: 'Attendance Settings', icon: 'checkCircle' },
        ],
      },
      {
        id: 'students',
        label: 'Students',
        items: [
          { href: '/dashboard/students', label: 'Student List', icon: 'users' },
          { href: '/dashboard/students/add', label: 'Add Student', icon: 'userPlus' },
          // { href: '/dashboard/students/groups', label: 'Groups & Categories', icon: 'folder' },
          { href: '/dashboard/students/promotion', label: 'Promotion', icon: 'transfer' },
          // { href: '/dashboard/students/disabled', label: 'Disabled Students', icon: 'ban' },
          // { href: '/dashboard/students/transfers', label: 'Transfer Requests', icon: 'transfer' },
          { href: '/dashboard/id-cards', label: 'ID Cards', icon: 'id' },
          // { href: '/dashboard/id-cards/editor', label: 'Generate ID Card', icon: 'id' },
        ],
      },
      {
        id: 'staff',
        label: 'Staff',
        items: [
          { href: '/dashboard/staff', label: 'Employee List', icon: 'briefcase' },
          { href: '/dashboard/teachers/onboarding', label: 'Teacher Onboarding', icon: 'userCheck' },
          { href: '/dashboard/staff/add?type=teacher', label: 'Add Teacher', icon: 'userPlus' },
        ],
      },
      {
        id: 'attendance',
        label: 'Attendance',
        items: [
          { href: '/dashboard/attendance/my', label: 'Mark Attendance', icon: 'check' },
          { href: '/dashboard/attendance/students/mark', label: 'Student Attendance', icon: 'userCheck' },
          { href: '/dashboard/staff/attendance', label: 'Staff Attendance', icon: 'briefcase' },
          { href: '/dashboard/leave/my', label: 'Apply Leave', icon: 'calendar' },
          { href: '/dashboard/leave/requests', label: 'Leave Management', icon: 'clipboard' },
        ],
      },
      {
        id: 'examinations',
        label: 'Examinations',
        items: [
          { href: '/dashboard/academics/exams', label: 'Exams', icon: 'clipboard' },
          { href: '/dashboard/academics/marks', label: 'Marks', icon: 'chart' },
          { href: '/dashboard/academics/exams/centers', label: 'Centers', icon: 'building' },
          { href: '/dashboard/academics/exams/rooms', label: 'Rooms', icon: 'building' },
          { href: '/dashboard/academics/exams/seating', label: 'Seating', icon: 'grid' },
          { href: '/dashboard/academics/exams/invigilators', label: 'Invigilators', icon: 'users' },
          { href: '/dashboard/academics/exams/hall-tickets', label: 'Hall Tickets', icon: 'ticket' },
        ],
      },
      {
        id: 'fees',
        label: 'Fees',
        items: [
          ...feeNavItems,
        ],
      },
      {
        id: 'homework',
        label: 'Homework',
        items: [
          { href: '/dashboard/homework', label: 'Homework', icon: 'book' },
        ],
      },
      {
        id: 'communication',
        label: 'Communicate',
        items: [
          { href: '/dashboard/communication/notice-board', label: 'Notice Board', icon: 'clipboard' },
          { href: '/dashboard/settings?tab=messaging', label: 'Messaging Providers', icon: 'message' },
          { href: '/dashboard/communication/send-email', label: 'Send Email', icon: 'mail' },
          { href: '/dashboard/communication/send-sms', label: 'Send SMS', icon: 'message' },
          { href: '/dashboard/communication/send-push', label: 'Send Push', icon: 'message' },
          { href: '/dashboard/communication/logs', label: 'Logs', icon: 'history' },
          { href: '/dashboard/communication/login-credentials', label: 'Login Credentials Send', icon: 'lock' },
          { href: '/dashboard/communication/email-templates', label: 'Email Template', icon: 'fileText' },
          { href: '/dashboard/communication/sms-templates', label: 'SMS Template', icon: 'message' },
          { href: '/dashboard/communication/push-templates', label: 'Push Template', icon: 'message' },
        ],
      },
      {
        id: 'transport',
        label: 'Transport',
        items: [
          { href: '/dashboard/transport', label: 'Transport', icon: 'bus' },
        ],
      },
      {
        id: 'library',
        label: 'Library',
        items: [
          { href: '/dashboard/library', label: 'Library', icon: 'book' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        items: [
          { href: '/dashboard/dormitory', label: 'Dormitory', icon: 'bed' },
        ],
      },
      {
        id: 'accounts',
        label: 'Accounts',
        items: [
          { href: '/dashboard/payroll', label: 'Payroll', icon: 'wallet' },
          { href: '/dashboard/payroll/report', label: 'Payroll Report', icon: 'chart' },
          { href: '/dashboard/accounts/expenses', label: 'Expenses', icon: 'wallet' },
          { href: '/dashboard/payment-methods', label: 'Payment Methods', icon: 'card' },
          { href: '/dashboard/fee-challan-details', label: 'Fee Challan', icon: 'invoice' },
        ],
      },
      {
        id: 'reports',
        label: 'Reports',
        items: [
          { href: '/dashboard/reports', label: 'Reports', icon: 'chart' },
          { href: '/dashboard/audit', label: 'Audit Logs', icon: 'history' },
        ],
      },
      {
        id: 'users-roles',
        label: 'Users & Roles',
        items: [
          { href: '/dashboard/users', label: 'Users', icon: 'users' },
          { href: '/dashboard/role-permissions', label: 'Role Permissions', icon: 'shield' },
        ],
      },
      {
        id: 'subscription',
        label: 'Subscription',
        items: [
          { href: '/dashboard/plans', label: 'Plans', icon: 'package' },
        ],
      },
      {
        id: 'settings',
        label: 'Settings',
        items: [
          { href: '/dashboard/settings/branding', label: 'Branding', icon: 'brand' },
          { href: '/dashboard/base-setup', label: 'Base Setup', icon: 'settings' },
          { href: '/change-password', label: 'Change Password', icon: 'lock' },
        ],
      },
    ];

    return sections
      .map((section) => ({ ...section, items: filterItems(section.items) }))
      .filter((section) => section.items.length > 0);
  }, [hasAnyRole, isPlatform, allowedCodes]);

  const sections = isPlatform ? platformSections : schoolSections;

  useEffect(() => {
    const activeSectionId = sections.find((section) => sectionHasActiveItem(section))?.id;
    setOpenSections(Object.fromEntries(sections.map((section) => [section.id, section.id === activeSectionId])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, isPlatform, sections.length]);

  const toggleSection = (id: string) => {
    const activeSectionId = sections.find((section) => sectionHasActiveItem(section))?.id;
    setOpenSections((current) =>
      Object.fromEntries(
        sections.map((section) => [
          section.id,
          section.id === id ? (id === activeSectionId ? true : !(current[id] ?? false)) : false,
        ]),
      ),
    );
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        className={`group relative flex min-h-9 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
          active
            ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-active-text)]'
            : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
        }`}
        onClick={onClose}
      >
        <span
          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-opacity ${
            active
              ? 'bg-[var(--shell-sidebar-active-text)] opacity-100'
              : 'bg-[var(--shell-sidebar-text)] opacity-0 group-hover:opacity-40'
          }`}
        />
        <span
          className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
            active
              ? 'bg-[var(--shell-sidebar-icon-active)] text-[var(--shell-sidebar-active-text)]'
              : 'bg-[var(--shell-sidebar-icon)] text-[var(--shell-sidebar-muted)] group-hover:text-[var(--shell-sidebar-text)]'
          }`}
        >
          <AppIcon name={iconForItem(item)} className="h-4 w-4" />
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
        className={`fixed left-0 top-0 z-50 flex h-screen w-[18rem] shrink-0 transform flex-col border-r border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar)] px-3 py-3 text-[var(--shell-sidebar-text)] shadow-xl shadow-slate-950/10 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-3 flex shrink-0 items-center gap-3 rounded-lg border border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar-card)] p-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School logo" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icon.png" alt="SchoolApp" className="h-10 w-10 rounded-md object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{isPlatform ? platformName : schoolName || 'School Console'}</p>
            <p className="text-xs text-[var(--shell-sidebar-muted)]">
              {isPlatform ? platformSubtitle : 'School Workspace'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)] lg:hidden"
            aria-label="Close navigation"
          >
            <AppIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
          {sections.map((section) => {
            const isOpenSection = openSections[section.id] ?? false;
            const activeSection = sectionHasActiveItem(section);
            return (
              <div
                key={section.id}
                className={`rounded-lg border transition-colors ${
                  activeSection
                    ? 'border-[var(--shell-sidebar-border)] bg-[var(--shell-sidebar-card)]'
                    : 'border-transparent'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold transition-colors ${
                    activeSection
                      ? 'text-[var(--shell-sidebar-text)]'
                      : 'text-[var(--shell-sidebar-muted)] hover:bg-[var(--shell-sidebar-hover)] hover:text-[var(--shell-sidebar-text)]'
                  }`}
                  aria-expanded={isOpenSection}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                      activeSection
                        ? 'bg-[var(--shell-sidebar-active)] text-[var(--shell-sidebar-active-text)]'
                        : 'bg-[var(--shell-sidebar-icon)] text-[var(--shell-sidebar-muted)]'
                    }`}
                  >
                    <AppIcon name={iconForSection(section.label)} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{section.label}</span>
                  <span className="rounded-md border border-[var(--shell-sidebar-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--shell-sidebar-muted)]">
                    {section.items.length}
                  </span>
                  <span className={`transition-transform ${isOpenSection ? 'rotate-90' : ''}`}>
                    <AppIcon name="chevron" className="h-4 w-4" />
                  </span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${isOpenSection ? 'max-h-[720px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="space-y-1 px-1 pb-2">
                    {section.items.map(renderItem)}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
