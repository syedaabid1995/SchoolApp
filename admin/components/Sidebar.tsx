'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useState } from 'react';
import { isSuperAdmin } from '../utils/roles';
import { ThemeContext } from './ThemeProvider';

const academicItems = [
  { href: '/dashboard/academics', label: 'Academic Setup' },
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
  const pathname = usePathname();
  const isTeacher = role === 'TEACHER';
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const renderLink = (item: { href: string; label: string }) => (
    <Link
      key={item.href}
      href={item.href}
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 flex-shrink-0 block ${
        isActive(item.href)
          ? 'bg-white/20 text-white shadow-sm'
          : 'text-white/90 hover:bg-white/10 hover:text-white hover:translate-x-1'
      }`}
      onClick={onClose}
    >
      {item.label}
    </Link>
  );
  const { logoUrl } = useContext(ThemeContext);
  const isExactActive = (href: string) => pathname === href;
  const isSectionActive = (itemsToCheck: { href: string }[]) =>
    itemsToCheck.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (isSectionActive(academicItems)) setIsAcademicOpen(true);
    if (isSectionActive(studentItems)) setIsStudentsOpen(true);
    if (isSectionActive(teacherItems)) setIsTeachersOpen(true);
  }, [pathname]);

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
          {isSuperAdmin(role) ? (
            <>
              {renderLink({ href: '/dashboard/analytics', label: 'Analytics' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/schools', label: 'Schools' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/subscriptions', label: 'Subscriptions' })}
              <div className="border-t border-white/10 my-2"></div>
              {/* Academic Section */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setIsAcademicOpen(!isAcademicOpen)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(academicItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(studentItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 my-2"></div>
              {/* Teachers Section */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setIsTeachersOpen(!isTeachersOpen)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(teacherItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/attendance', label: 'Attendance' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/support', label: 'Support' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/audit', label: 'Audit Logs' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/themes', label: 'Themes' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/settings', label: 'Settings' })}
              <div className="border-t border-white/10 my-2"></div>
            </>
          ) : null}

          {isTeacher ? (
            <>
              {renderLink({ href: '/dashboard', label: 'Overview' })}
              <div className="border-t border-white/10 my-2"></div>
              {/* Academic Section */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setIsAcademicOpen(!isAcademicOpen)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(academicItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(studentItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/attendance', label: 'Attendance' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/support', label: 'Support' })}
            </>
          ) : null}

          {isSchoolAdmin ? (
            <>
              {renderLink({ href: '/dashboard', label: 'Overview' })}
              <div className="border-t border-white/10 my-2"></div>
              {/* Teachers Section */}
              <div className="flex-shrink-0">
                <button
                  onClick={() => setIsTeachersOpen(!isTeachersOpen)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(teacherItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(academicItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
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
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    isSectionActive(studentItems)
                      ? 'bg-white/20 text-white'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
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
                        className={`rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                          isExactActive(item.href)
                            ? 'bg-white/20 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                        }`}
                        onClick={onClose}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/attendance', label: 'Attendance' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/support', label: 'Support' })}
              <div className="border-t border-white/10 my-2"></div>
              {renderLink({ href: '/dashboard/audit', label: 'Audit Logs' })}
            </>
          ) : null}

          <div className="border-t border-white/10 my-2"></div>
          <a
            href="/parent/login"
            className="rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 text-white/90 hover:bg-white/10 hover:text-white hover:translate-x-1"
            target="_blank"
            rel="noreferrer"
          >
            Parent Portal
          </a>
        </nav>
      </aside>
    </>
  );
};
