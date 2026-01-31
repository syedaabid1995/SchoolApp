'use client';

import { useRouter } from 'next/navigation';
import { logout } from '../services/auth.service';

const resolveConsoleTitle = (role: string | null) => {
  if (role === 'SUPER_ADMIN') return 'Super Admin Console';
  if (role === 'SCHOOL_ADMIN') return 'School Admin Console';
  if (role === 'TEACHER') return 'Teacher Console';
  return 'Admin Console';
};

export const Header = ({
  role,
  email,
  displayName,
  onMenuToggle,
}: {
  role: string | null;
  email: string | null;
  displayName?: string | null;
  onMenuToggle?: () => void;
}) => {
  const router = useRouter();
  const resolvedName = displayName || email?.split('@')[0] || 'User';

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="theme-header sticky top-0 z-30 flex items-center justify-between border-b border-slate/10 px-4 py-4 text-white transition-all duration-200 sm:px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="rounded-md p-2 text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-semibold text-white transition-colors duration-200">
            Welcome, {resolvedName}
          </h2>
          <p className="text-sm text-white/80 transition-colors duration-200">{resolveConsoleTitle(role)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition-all duration-200 hover:bg-white/20 sm:inline-block">{role ?? 'UNKNOWN'}</span>
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-white/10 hover:border-white/50"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
