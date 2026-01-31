import Link from 'next/link';
import { isSuperAdmin } from '../utils/roles';

const baseItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/teachers', label: 'Teachers' },
  { href: '/dashboard/students', label: 'Students' },
  { href: '/dashboard/academics', label: 'Academics' },
  { href: '/dashboard/attendance', label: 'Attendance' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/themes', label: 'Themes' },
  { href: '/dashboard/audit', label: 'Audit Logs' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/support', label: 'Support' },
];

const superAdminItems = [
  { href: '/dashboard/schools', label: 'Schools' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions' },
];

export const Sidebar = ({ role }: { role: string | null }) => {
  const items = isSuperAdmin(role) ? [...superAdminItems, ...baseItems] : baseItems;

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate/10 bg-white px-4 py-6">
      <div className="mb-6">
        <p className="text-xs uppercase text-slate">Navigation</p>
      </div>
      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-sand"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
};
