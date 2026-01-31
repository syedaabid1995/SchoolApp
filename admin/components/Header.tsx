'use client';

import { useRouter } from 'next/navigation';
import { logout } from '../services/auth.service';

const resolveConsoleTitle = (role: string | null) => {
  if (role === 'SUPER_ADMIN') return 'Super Admin Console';
  if (role === 'SCHOOL_ADMIN') return 'School Admin Console';
  if (role === 'TEACHER') return 'Teacher Console';
  return 'Admin Console';
};

export const Header = ({ role, email }: { role: string | null; email: string | null }) => {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="theme-header flex items-center justify-between border-b border-slate/10 px-6 py-4 text-white">
      <div>
        <p className="text-sm text-white/80">{email ?? 'User'}</p>
        <h2 className="text-lg font-semibold text-white">{resolveConsoleTitle(role)}</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">{role ?? 'UNKNOWN'}</span>
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
