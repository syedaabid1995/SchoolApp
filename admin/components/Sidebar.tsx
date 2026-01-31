'use client';
import Link from 'next/link';
import { useContext, useState } from 'react';
import { isSuperAdmin } from '../utils/roles';
import { ThemeContext } from './ThemeProvider';

const baseItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/teachers', label: 'Teachers' },
  { href: '/dashboard/students', label: 'Students' },
  { href: '/dashboard/attendance', label: 'Attendance' },
  { href: '/dashboard/themes', label: 'Themes' },
  { href: '/dashboard/audit', label: 'Audit Logs' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/support', label: 'Support' },
];

const superAdminItems = [
  { href: '/dashboard/schools', label: 'Schools' },
  { href: '/dashboard/subscriptions', label: 'Subscriptions' },
];

const academicItems = [
  { href: '/dashboard/academics/exams', label: 'Exams' },
  { href: '/dashboard/academics/marks', label: 'Upload Marks' },
];

export const Sidebar = ({ role }: { role: string | null }) => {
  const [isAcademicOpen, setIsAcademicOpen] = useState(false);
  const items = isSuperAdmin(role) ? [...superAdminItems, ...baseItems] : baseItems;
  const { logoUrl } = useContext(ThemeContext);

  return (
    <aside className="theme-navbar flex h-full w-64 flex-col border-r border-slate/10 px-4 py-6 text-white">
      <div className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="School Logo" className="h-9 w-9 rounded-md object-cover" />
        ) : (
          <div className="h-9 w-9 rounded-md bg-white/10" />
        )}
        <p className="text-xs uppercase text-white/70">Navigation</p>
      </div>
      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            {item.label}
          </Link>
        ))}
        
        {/* Academic Section */}
        <div>
          <button
            onClick={() => setIsAcademicOpen(!isAcademicOpen)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            Academic
            <span className={`transform transition-transform ${isAcademicOpen ? 'rotate-90' : ''}`}>
              ▶
            </span>
          </button>
          {isAcademicOpen && (
            <div className="ml-4 mt-1 flex flex-col gap-1">
              {academicItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};
