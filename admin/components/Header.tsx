'use client';

import { useRouter } from 'next/navigation';
import { logout } from '../services/auth.service';

export const Header = ({ role }: { role: string | null }) => {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="flex items-center justify-between border-b border-slate/10 bg-white px-6 py-4">
      <div>
        <p className="text-sm text-slate">TechStage IT</p>
        <h2 className="text-lg font-semibold text-ink">Admin Console</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-slate">{role ?? 'UNKNOWN'}</span>
        <button
          onClick={handleLogout}
          className="rounded-md border border-slate/20 px-3 py-2 text-sm font-medium text-ink hover:bg-sand"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
