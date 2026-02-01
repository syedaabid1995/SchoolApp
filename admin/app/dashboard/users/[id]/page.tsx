'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserById } from '../../../../services/user.service';

export default function UserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = use(params).id;
  const { data: user } = useQuery({ queryKey: ['user', userId], queryFn: () => getUserById(userId) });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-red-100 text-red-800';
      case 'SCHOOL_ADMIN': return 'bg-blue-100 text-blue-800';
      case 'TEACHER': return 'bg-purple-100 text-purple-800';
      case 'PARENT': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/40">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-700 px-6 py-16 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
                User Profile
              </div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                User Details
              </h1>
              <p className="max-w-2xl text-lg text-indigo-100">
                Comprehensive user profile overview with linked roles and account information.
              </p>
            </div>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-bounce"></div>
        <div className="absolute top-1/2 left-1/3 h-6 w-6 rounded-full bg-white/20 animate-ping"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* User Profile Card */}
        <section className="mb-8 rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-start gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-3xl font-bold text-white">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  {user?.displayName || 'Unknown User'}
                </h2>
                {user?.role && (
                  <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getRoleColor(user.role)}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                )}
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Email Address</p>
                  <p className="mt-1 text-lg text-gray-900">{user?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Account Created</p>
                  <p className="mt-1 text-lg text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Teacher Profile */}
        {user?.teacherProfile && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Teacher Profile</h3>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Full Name</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {user.teacherProfile.firstName} {user.teacherProfile.lastName}
                </p>
              </div>
              
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Phone Number</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {user.teacherProfile.phone || '—'}
                </p>
              </div>
              
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Address</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">
                  {user.teacherProfile.address || '—'}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Parent Profiles */}
        {user?.parentProfiles?.length ? (
          <section className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Parent Profiles</h3>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              {user.parentProfiles.map((profile, index) => (
                <div key={`${profile.phone ?? profile.firstName}-${index}`} className="rounded-xl border border-gray-200 p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-lg font-bold text-white">
                      {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {profile.firstName} {profile.lastName}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                      <p className="mt-1 text-gray-900">{profile.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Email</p>
                      <p className="mt-1 text-gray-900">{profile.email || '—'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Empty State */}
        {!user?.teacherProfile && !user?.parentProfiles?.length && (
          <section className="rounded-2xl bg-white p-12 text-center shadow-lg">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No additional profiles</h3>
            <p className="text-gray-600">
              This user account doesn't have any linked teacher or parent profiles.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
