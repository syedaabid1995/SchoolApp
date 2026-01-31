'use client';
import Link from 'next/link';
import { useState } from 'react';
import { isSuperAdmin } from '../utils/roles';

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
        
        {/* Academic Section */}
        <div>
          <button
            onClick={() => setIsAcademicOpen(!isAcademicOpen)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-sand"
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
                  className="rounded-lg px-3 py-2 text-sm text-ink hover:bg-sand"
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
