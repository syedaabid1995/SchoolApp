'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSchools } from '../../../services/school.service';
import { getSubscriptionMetrics } from '../../../services/subscription.service';

export default function SubscriptionsPage() {
  const [schoolId, setSchoolId] = useState('');
  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
  });

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['subscription-metrics', schoolId],
    queryFn: () => getSubscriptionMetrics(schoolId),
    enabled: Boolean(schoolId),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Subscriptions</h1>
        <p className="text-sm text-slate">Review tenant subscription plans and usage limits.</p>
      </header>
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Usage Snapshot</h2>
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select a school</option>
            {schools?.items.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name} ({school.code})
              </option>
            ))}
          </select>
        </div>
        {!schoolId ? (
          <p className="mt-4 text-sm text-slate">Select a school to view usage.</p>
        ) : isLoading ? (
          <p className="mt-4 text-sm text-slate">Loading metrics...</p>
        ) : metrics ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Plan</p>
              <p className="mt-2 text-lg font-semibold">{metrics.plan?.name ?? 'No Plan'}</p>
              <p className="text-sm text-slate">{metrics.plan?.status ?? 'N/A'}</p>
            </div>
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Students</p>
              <p className="mt-2 text-lg font-semibold">{metrics.usage.students}</p>
              <p className="text-sm text-slate">Limit: {metrics.plan?.studentLimit ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate/10 p-4">
              <p className="text-xs uppercase text-slate">Teachers</p>
              <p className="mt-2 text-lg font-semibold">{metrics.usage.teachers}</p>
              <p className="text-sm text-slate">Limit: {metrics.plan?.teacherLimit ?? 0}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate">No subscription data.</p>
        )}
      </section>
    </div>
  );
}
