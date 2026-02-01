'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserById } from '../../../../services/user.service';

export default function UserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = use(params).id;
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId) });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">User Details</h1>
        <p className="text-sm text-slate">Profile overview and linked roles.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 text-sm text-slate md:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate">Name</p>
            <p className="mt-1 text-ink">{user?.displayName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Email</p>
            <p className="mt-1 text-ink">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Role</p>
            <p className="mt-1 text-ink">{user?.role ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate">Created</p>
            <p className="mt-1 text-ink">{user?.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</p>
          </div>
        </div>
      </section>

      {user?.teacherProfile ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Teacher Profile</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate">Name</p>
              <p className="mt-1 text-ink">
                {user.teacherProfile.firstName} {user.teacherProfile.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate">Phone</p>
              <p className="mt-1 text-ink">{user.teacherProfile.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate">Address</p>
              <p className="mt-1 text-ink">{user.teacherProfile.address ?? '—'}</p>
            </div>
          </div>
        </section>
      ) : null}

      {user?.parentProfiles?.length ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Parent Profiles</h2>
          <div className="mt-4 space-y-3 text-sm text-slate">
            {user.parentProfiles.map((profile) => (
              <div key={`${profile.phone ?? profile.firstName}`} className="rounded-xl border border-slate/10 p-4">
                <p className="text-xs uppercase text-slate">Name</p>
                <p className="mt-1 text-ink">{profile.firstName} {profile.lastName}</p>
                <p className="mt-1">Phone: {profile.phone ?? '—'}</p>
                <p className="mt-1">Email: {profile.email ?? '—'}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
