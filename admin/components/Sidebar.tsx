'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext, useEffect, useState } from 'react';
import { isSuperAdmin } from '../utils/roles';
import { ThemeContext } from './ThemeProvider';
import { EMPLOYEE_PERMISSION_CATALOG } from '../config/employee-permissions';

const academicItems = [
  { href: '/dashboard/academics', label: 'Academic Setup' },
  { href: '/dashboard/academics/timetable', label: 'Timetable' },
  { href: '/dashboard/academics/exams', label: 'Exams' },
  { href: '/dashboard/academics/marks', label: 'Upload Marks' },
];

const studentItems = [
  { href: '/dashboard/students/add', label: 'Add' },
  { href: '/dashboard/students', label: 'List' },
  { href: '/dashboard/id-cards', label: 'ID Cards' },
  { href: '/dashboard/students/transfers', label: 'Incoming Transfer Requests' },
];

const teacherItems = [
  { href: '/dashboard/teachers/add', label: 'Add' },
  { href: '/dashboard/teachers', label: 'List' },
];

const employeeItems = [
  { href: '/dashboard/teachers/add', label: 'Add User' },
  { href: '/dashboard/teachers/assign', label: 'Assign Classes' },
  { href: '/dashboard/teachers', label: 'List Users' },
];

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
  const [isAcademicOpen, setIsAcademicOpen] = useState(false);
  const [isStudentsOpen, setIsStudentsOpen] = useState(false);
  const [isTeachersOpen, setIsTeachersOpen] = useState(false);
  const pathname = usePathname();
  const isTeacher = ['TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'].includes(role ?? '');
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const allowedCodes = new Set(permissionCodes);
  const renderLink = (item: { href: string; label: string }) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch={false}
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
  const getCodeForPath = (href: string) =>
    EMPLOYEE_PERMISSION_CATALOG.find((permission) => permission.path === href)?.code;
  const isAllowedNavItem = (href: string) => {
    if (!isTeacher && !isSchoolAdmin) return true;
    const code = getCodeForPath(href);
    if (!code) return isSchoolAdmin;
    return allowedCodes.has(code);
  };
  const visibleAcademicItems = academicItems.filter((item) => isAllowedNavItem(item.href));
  const visibleStudentItems = studentItems.filter((item) => isAllowedNavItem(item.href));
  const visibleEmployeeItems = employeeItems.filter((item) => isAllowedNavItem(item.href));
  const superAdminItems = [
    { href: '/dashboard/analytics', label: 'Analytics' },
    { href: '/dashboard/schools', label: 'Schools' },
    { href: '/dashboard/subscriptions', label: 'Subscriptions' },
    { href: '/dashboard/support', label: 'Support' },
    { href: '/dashboard/audit', label: 'Logs' },
    { href: '/dashboard/themes', label: 'Themes' },
    { href: '/dashboard/settings', label: 'Settings' },
    { href: '/dashboard/settings/sms', label: 'SMS Settings' },
  ];

  useEffect(() => {
    if (isSectionActive(visibleAcademicItems)) setIsAcademicOpen(true);
    if (isSectionActive(visibleStudentItems)) setIsStudentsOpen(true);
    if (isSectionActive(teacherItems)) setIsTeachersOpen(true);
  }, [pathname, permissionCodes]);

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
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icon.png" alt="SchoolApp" className="h-9 w-9 rounded-md object-cover transition-transform duration-200 hover:scale-105" />
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
              {superAdminItems.map((item, index) => (
                <div key={item.href}>
                  {renderLink(item)}
                  {index < superAdminItems.length - 1 ? <div className="border-t border-white/10 my-2"></div> : null}
                </div>
              ))}
            </>
          ) : null}

{isTeacher ? (
            <>
              {isAllowedNavItem('/dashboard') ? renderLink({ href: '/dashboard', label: 'Overview' }) : null}
              {isAllowedNavItem('/dashboard') ? <div className="border-t border-white/10 my-2"></div> : null}
              {/* Academic Section */}
              {visibleAcademicItems.length > 0 ? (
                <>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsAcademicOpen(!isAcademicOpen)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isSectionActive(visibleAcademicItems)
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
                        {visibleAcademicItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
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
                </>
              ) : null}
              {/* Students Section */}
              {visibleStudentItems.length > 0 ? (
                <>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsStudentsOpen(!isStudentsOpen)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isSectionActive(visibleStudentItems)
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
                        {visibleStudentItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
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
                </>
              ) : null}
              {isAllowedNavItem('/dashboard/attendance')
                ? renderLink({ href: '/dashboard/attendance', label: 'Attendance' })
                : null}
              {isAllowedNavItem('/dashboard/attendance') ? <div className="border-t border-white/10 my-2"></div> : null}
              {isAllowedNavItem('/dashboard/support')
                ? renderLink({ href: '/dashboard/support', label: 'Support' })
                : null}
            </>
          ) : null}

          {isSchoolAdmin ? (
            <>
              {isAllowedNavItem('/dashboard') ? renderLink({ href: '/dashboard', label: 'Overview' }) : null}
              {isAllowedNavItem('/dashboard') ? <div className="border-t border-white/10 my-2"></div> : null}
              {isAllowedNavItem('/dashboard/plans') ? renderLink({ href: '/dashboard/plans', label: 'Plans' }) : null}
              {isAllowedNavItem('/dashboard/plans') ? <div className="border-t border-white/10 my-2"></div> : null}
              {/* Teachers Section */}
              {visibleEmployeeItems.length > 0 ? (
                <>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsTeachersOpen(!isTeachersOpen)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isSectionActive(visibleEmployeeItems)
                          ? 'bg-white/20 text-white'
                          : 'text-white/90 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      Employees
                      <span className={`transform transition-all duration-300 ${isTeachersOpen ? 'rotate-90 text-white' : 'text-white/70'}`}>
                        ▶
                      </span>
                    </button>
                    <div className={`ml-4 overflow-hidden transition-all duration-300 ease-in-out ${
                      isTeachersOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="mt-1 flex flex-col gap-1">
                        {visibleEmployeeItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
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
                </>
              ) : null}
              {/* Academic Section */}
              {visibleAcademicItems.length > 0 ? (
                <>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsAcademicOpen(!isAcademicOpen)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isSectionActive(visibleAcademicItems)
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
                        {visibleAcademicItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
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
                </>
              ) : null}
              {/* Students Section */}
              {visibleStudentItems.length > 0 ? (
                <>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsStudentsOpen(!isStudentsOpen)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                        isSectionActive(visibleStudentItems)
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
                        {visibleStudentItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
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
                </>
              ) : null}
              {isAllowedNavItem('/dashboard/attendance')
                ? renderLink({ href: '/dashboard/attendance', label: 'Attendance' })
                : null}
              {isAllowedNavItem('/dashboard/attendance') ? <div className="border-t border-white/10 my-2"></div> : null}
              {isAllowedNavItem('/dashboard/support')
                ? renderLink({ href: '/dashboard/support', label: 'Support' })
                : null}
              {isAllowedNavItem('/dashboard/support') ? <div className="border-t border-white/10 my-2"></div> : null}
              {isAllowedNavItem('/dashboard/audit')
                ? renderLink({ href: '/dashboard/audit', label: 'Audit Logs' })
                : null}
              {isAllowedNavItem('/dashboard/audit') ? <div className="border-t border-white/10 my-2"></div> : null}
              {isAllowedNavItem('/dashboard/settings/access')
                ? renderLink({ href: '/dashboard/settings/access', label: 'Access Control' })
                : null}
              {isAllowedNavItem('/dashboard/settings/access') ? <div className="border-t border-white/10 my-2"></div> : null}
              {renderLink({ href: '/dashboard/settings/sms', label: 'SMS Settings' })}
            </>
          ) : null}

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
