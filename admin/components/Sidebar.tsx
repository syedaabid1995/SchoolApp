'use client';
import Link from 'next/link';
import { useContext, useState } from 'react';
import { isSuperAdmin } from '../utils/roles';
import { ThemeContext } from './ThemeProvider';

const baseItems = [
  { href: '/dashboard', label: 'Overview' },
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

const studentItems = [
  { href: '/dashboard/students/add', label: 'Add' },
  { href: '/dashboard/students', label: 'List' },
  { href: '/dashboard/students/transfers', label: 'Incoming Transfer Requests' },
];

const teacherItems = [
  { href: '/dashboard/teachers/add', label: 'Add' },
  { href: '/dashboard/teachers', label: 'List' },
];

export const Sidebar = ({ role, isOpen, onClose, schoolName }: { role: string | null; isOpen?: boolean; onClose?: () => void; schoolName?: string }) => {
  const [isAcademicOpen, setIsAcademicOpen] = useState(false);
  const [isStudentsOpen, setIsStudentsOpen] = useState(false);
  const [isTeachersOpen, setIsTeachersOpen] = useState(false);
  const items = isSuperAdmin(role) ? [...superAdminItems, ...baseItems] : baseItems;
  const { logoUrl } = useContext(ThemeContext);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`theme-navbar fixed left-0 top-0 z-50 flex h-screen w-64 transform flex-col border-r border-slate/10 px-4 py-6 text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="mb-6 flex items-center gap-3 flex-shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="School Logo" className="h-9 w-9 rounded-md object-cover transition-transform duration-200 hover:scale-105" />
          ) : (
            <div className="h-9 w-9 rounded-md bg-white/10 transition-colors duration-200 hover:bg-white/20" />
          )}
          <p className="text-xs uppercase text-white/70 transition-colors duration-200">{schoolName?.toUpperCase() || 'NAVIGATION'}</p>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="ml-auto text-white/70 hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col gap-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {items.map((item, index) => (
            <div key={item.href}>
              <Link
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-all duration-200 hover:bg-white/10 hover:text-white hover:translate-x-1 flex-shrink-0 block"
                onClick={onClose}
              >
                {item.label}
              </Link>
              {index < items.length - 1 && <div className="border-t border-white/10 my-2"></div>}
            </div>
          ))}
          
          <div className="border-t border-white/10 my-2"></div>
          
          {/* Teachers Section */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsTeachersOpen(!isTeachersOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              Teachers
              <span className={`transform transition-all duration-300 ${isTeachersOpen ? 'rotate-90 text-white' : 'text-white/70'}`}>
                ▶
              </span>
            </button>
            <div className={`ml-4 overflow-hidden transition-all duration-300 ease-in-out ${
              isTeachersOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="mt-1 flex flex-col gap-1">
                {teacherItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white hover:translate-x-1"
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 my-2"></div>

          {/* Students Section */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsStudentsOpen(!isStudentsOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              Students
              <span className={`transform transition-all duration-300 ${isStudentsOpen ? 'rotate-90 text-white' : 'text-white/70'}`}>
                ▶
              </span>
            </button>
            <div className={`ml-4 overflow-hidden transition-all duration-300 ease-in-out ${
              isStudentsOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="mt-1 flex flex-col gap-1">
                {studentItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white hover:translate-x-1"
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          
          <div className="border-t border-white/10 my-2"></div>
          
          {/* Academic Section */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setIsAcademicOpen(!isAcademicOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition-all duration-200 hover:bg-white/10 hover:text-white"
            >
              Academic
              <span className={`transform transition-all duration-300 ${isAcademicOpen ? 'rotate-90 text-white' : 'text-white/70'}`}>
                ▶
              </span>
            </button>
            <div className={`ml-4 overflow-hidden transition-all duration-300 ease-in-out ${
              isAcademicOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              <div className="mt-1 flex flex-col gap-1">
                {academicItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2 text-sm text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white hover:translate-x-1"
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
};
