'use client';

import { useQuery } from '@tanstack/react-query';
import { getAdminDashboardMetrics } from '../../services/adminDashboard.service';

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboardMetrics,
  });

  const cards = [
    { label: 'Students', value: data?.totalStudents },
    { label: 'Teachers', value: data?.totalTeachers },
    { label: 'Attendance Today', value: data?.attendanceRateToday ? `${data.attendanceRateToday}%` : 0 },
    { label: 'Pending Approvals', value: data?.pendingApprovals },
    { label: 'Active Classes', value: data?.activeClasses },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h1 className="text-2xl font-semibold text-ink">Dashboard Overview</h1>
        <p className="mt-2 text-sm text-slate">
          Track attendance health, academic performance, and operational status across your institution.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate/10 bg-white p-5">
            <p className="text-xs uppercase text-slate">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {isLoading ? 'Loading…' : isError ? 'Unavailable' : card.value ?? 0}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
