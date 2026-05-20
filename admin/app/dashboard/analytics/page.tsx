'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getAnalytics } from '../../../services/analytics.service';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';
import FullPageLoader from '../../../components/FullPageLoader';
import PageHeader from '../../../components/PageHeader';
import Button from '../../../components/Button';

export default function AnalyticsPage() {
  const router = useRouter();
  const [schoolId, setSchoolId] = useState('');
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60_000,
  });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', effectiveSchoolId],
    queryFn: () => getAnalytics({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <FullPageLoader label="Loading analytics..." />;
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-[1500px] space-y-6 pb-12">
        <PageHeader title="Analytics Dashboard" subtitle="Key operational metrics across attendance and academics" />

        {/* School Selector for Super Admin */}
        {isSuperAdmin && (
          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">School Context</h2>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/schools')} icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} iconPosition="left">Add School</Button>
            </div>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Overview Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Attendance Rate */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-6 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  Live
                </div>
              </div>
              <p className="text-sm font-medium text-emerald-100">Attendance Rate</p>
              <p className="mt-2 text-4xl font-bold">{data?.attendanceRate ?? 0}%</p>
            </div>
          </div>

          {/* Students */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-blue-100">Total Students</p>
              <p className="mt-2 text-4xl font-bold">{data?.studentCount ?? 0}</p>
            </div>
          </div>

          {/* Attendance Sessions */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 p-6 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-purple-100">Attendance Sessions</p>
              <p className="mt-2 text-4xl font-bold">{data?.teacherActivity.sessions ?? 0}</p>
            </div>
          </div>

          {/* Active Teachers */}
          <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-medium text-orange-100">Active Teachers</p>
              <p className="mt-2 text-4xl font-bold">{data?.teacherActivity.activeTeachers ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Academic Summary */}
        <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-full bg-gradient-to-br from-purple-100 to-pink-100 p-3">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Academic Summary</h2>
              <p className="text-sm text-gray-500">Examination and assessment metrics</p>
            </div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Exams Created */}
            <div className="group rounded-xl border-2 border-gray-200 p-6 transition-all hover:border-purple-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-lg bg-purple-100 p-2">
                      <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Exams Created</p>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{data?.academicSummary.exams ?? 0}</p>
                </div>
                <div className="rounded-full bg-purple-50 p-4">
                  <svg className="h-12 w-12 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Marks Recorded */}
            <div className="group rounded-xl border-2 border-gray-200 p-6 transition-all hover:border-blue-300 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">Marks Recorded</p>
                  </div>
                  <p className="text-4xl font-bold text-gray-900">{data?.academicSummary.marks ?? 0}</p>
                </div>
                <div className="rounded-full bg-blue-50 p-4">
                  <svg className="h-12 w-12 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
