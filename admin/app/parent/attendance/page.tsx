'use client';

import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listParentAttendance } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusStyles: Record<string, string> = {
  Present: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Absent: 'bg-rose-100 text-rose-700 border-rose-200',
  Late: 'bg-amber-100 text-amber-700 border-amber-200',
  'Half Day': 'bg-sky-100 text-sky-700 border-sky-200',
};

export default function ParentAttendancePage() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild = useMemo(() => children?.find((child) => child.id === activeChildId), [children, activeChildId]);

  const monthLabel = monthCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const monthValue = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}`;

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', activeChild?.id, monthValue],
    queryFn: () => listParentAttendance(activeChild?.id, monthValue),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const monthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthEnd = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), [monthCursor]);

  const days = useMemo(() => {
    const firstDayIndex = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDayIndex; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor, monthEnd, monthStart]);

  const statusByDate = useMemo(() => {
    const map: Record<string, { status: string; remark?: string | null }> = {};
    (attendance?.calendar ?? []).forEach((day: { date: string; status: string; remark?: string | null }) => {
      map[day.date] = { status: day.status, remark: day.remark ?? null };
    });
    return map;
  }, [attendance]);

  const truncateRemark = (value?: string | null, maxLength = 14) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-pink-600 to-rose-700 px-6 py-12 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="rounded-full bg-white/20 p-3 backdrop-blur-sm">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
              <p className="text-purple-100">Monthly calendar and summary (view only).</p>
            </div>
          </div>
        </div>
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -bottom-5 -left-5 h-20 w-20 rounded-full bg-white/10 animate-bounce"></div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Summary */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Present Days</p>
                <p className="text-2xl font-bold text-gray-900">{attendance?.presentDays ?? '—'}</p>
              </div>
            </div>
            <div className="h-12 w-px bg-gray-200"></div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2">
                <svg className="h-5 w-5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">Absent Days</p>
                <p className="text-2xl font-bold text-gray-900">{attendance?.absentDays ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex items-center justify-between">
            <button
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <h2 className="text-2xl font-bold text-gray-900">{monthLabel}</h2>
            <button
              className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDays.map((day) => (
              <div key={day} className="py-3 text-center text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {days.map((dateValue, index) => {
              if (!dateValue) return <div key={`empty-${index}`} className="h-20 rounded-xl bg-gray-50/50" />;
              const dateKey = `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(
                dateValue.getDate(),
              ).padStart(2, '0')}`;
              const entry = statusByDate[dateKey];
              const status = entry?.status;
              const remark = entry?.remark ?? null;
              const remarkPreview = truncateRemark(remark);
              const isToday = new Date().toDateString() === dateValue.toDateString();
              return (
                <div
                  key={dateKey}
                  className={`group relative h-20 rounded-xl border-2 p-3 text-left transition-all ${
                    isToday ? 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50' : 'border-gray-200 bg-gradient-to-br from-white to-slate-50'
                  }`}
                >
                  <div className="absolute -right-6 -top-6 h-12 w-12 rounded-full bg-purple-100/70 blur-lg" />
                  <div className="absolute -left-6 -bottom-6 h-12 w-12 rounded-full bg-amber-100/60 blur-lg" />
                  <div className={`text-sm font-bold ${isToday ? 'text-purple-700' : 'text-gray-900'}`}>
                    {dateValue.getDate()}
                  </div>
                  {status ? (
                    <div className="mt-2 space-y-1">
                      <div
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                      >
                        {status}
                      </div>
                      {remarkPreview ? (
                        <div className="absolute right-2 top-2">
                          <div className="truncate rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-black shadow-sm ring-1 ring-slate-200/70 max-w-[60px]">
                            {remarkPreview}
                          </div>
                          {remark ? (
                            <div className="absolute right-0 top-6 z-50 w-56 whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-[10px] text-black opacity-0 shadow-xl ring-1 ring-gray-200 transition-opacity group-hover:opacity-100 pointer-events-none">
                              {remark}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Legend</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusStyles).map(([status, style]) => (
              <span key={status} className={`rounded-full border px-4 py-2 text-sm font-semibold ${style}`}>
                {status}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
