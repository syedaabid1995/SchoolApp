'use client';

import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentAttendance } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentAttendancePage() {
  const [month, setMonth] = useState('');
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', activeChild?.id, month],
    queryFn: () => listParentAttendance(activeChild?.id, month || undefined),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Attendance</h1>
        <p className="text-sm text-slate">Monthly calendar and summary (view only).</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <div className="text-sm text-slate">
            Present: {attendance?.presentDays ?? '—'} | Absent: {attendance?.absentDays ?? '—'}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-7">
          {(attendance?.calendar ?? []).length ? (
            attendance.calendar.map((day: { date: string; status: string }) => (
              <div key={day.date} className="rounded-lg border border-slate/10 px-2 py-3 text-xs">
                <p className="font-semibold">{day.date}</p>
                <p className={day.status === 'Present' ? 'text-emerald-600' : 'text-rose-600'}>{day.status}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate">No attendance records found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
