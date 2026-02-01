'use client';

import { useQuery } from '@tanstack/react-query';
import { getParentProfile } from '../../../services/parentPortal.service';

export default function ParentProfilePage() {
  const { data: profile } = useQuery({
    queryKey: ['parent-profile'],
    queryFn: getParentProfile,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Profile</h1>
        <p className="text-sm text-slate">Parent account information (read-only).</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate">Parent Name</p>
            <p className="mt-1 text-ink">{profile?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Mobile Number</p>
            <p className="mt-1 text-ink">{profile?.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Email</p>
            <p className="mt-1 text-ink">{profile?.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Linked Children</p>
            <div className="mt-1 space-y-1 text-ink">
              {(profile?.children ?? []).length ? (
                profile?.children?.map((child) => <p key={child.id}>{child.name}</p>)
              ) : (
                <p>—</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
