'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '../../../services/analytics.service';
import { getSession } from '../../../services/auth.service';
import { listSchools } from '../../../services/school.service';

export default function AnalyticsPage() {
  const [schoolId, setSchoolId] = useState('');
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', effectiveSchoolId],
    queryFn: () => getAnalytics({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Analytics</h1>
        <p className="text-sm text-slate">Key operational metrics across attendance and academics.</p>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">School Context</h2>
          <div className="mt-3">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Overview</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Attendance Rate</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : `${data?.attendanceRate ?? 0}%`}
            </p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Students</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : data?.studentCount ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Attendance Sessions</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : data?.teacherActivity.sessions ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Active Teachers</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : data?.teacherActivity.activeTeachers ?? 0}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Academic Summary</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Exams Created</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : data?.academicSummary.exams ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-slate/10 p-4">
            <p className="text-xs uppercase text-slate">Marks Recorded</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {isLoading ? '—' : data?.academicSummary.marks ?? 0}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
