'use client';

import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getParentDashboard, listParentAttendance, type ParentChild } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentDashboardPage() {
  const [month, setMonth] = useState('');
  const { activeChildId, children } = useContext(ParentChildContext);
  const activeChild: ParentChild | undefined = useMemo(
    () => children?.find((child) => child.id === activeChildId),
    [children, activeChildId],
  );

  const { data: dashboard } = useQuery({
    queryKey: ['parent-dashboard', activeChild?.id],
    queryFn: () => getParentDashboard(activeChild?.id),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: attendance } = useQuery({
    queryKey: ['parent-attendance', activeChild?.id, month],
    queryFn: () => listParentAttendance(activeChild?.id, month || undefined),
    enabled: Boolean(activeChild?.id),
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  if (!activeChild) {
    return (
      <div className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">No linked children</h2>
        <p className="mt-2 text-sm text-slate">Ask your school admin to link your account to a student.</p>
      </div>
    );
  }

  const stats = [
    { 
      label: 'Roll Number', 
      value: activeChild.rollNo || '—',
      icon: '🎓',
      color: 'bg-blue-500'
    },
    { 
      label: 'Attendance', 
      value: dashboard?.attendancePercent ? `${dashboard.attendancePercent}%` : '—',
      icon: '📊',
      color: 'bg-green-500'
    },
    { 
      label: 'Current Exam', 
      value: dashboard?.currentExam || '—',
      icon: '📝',
      color: 'bg-purple-500'
    },
    { 
      label: 'Class', 
      value: activeChild.classLabel,
      icon: '🏫',
      color: 'bg-orange-500'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 p-8 text-white">
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-blue-100 text-lg">
            Child-specific summary for {activeChild.name}
          </p>
        </div>
        <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 animate-pulse"></div>
        <div className="absolute -left-8 -bottom-8 h-40 w-40 rounded-full bg-white/5 animate-bounce"></div>
        <div className="absolute right-1/4 top-1/2 h-16 w-16 rounded-full bg-white/5 animate-ping"></div>
        <div className="absolute left-1/3 top-1/4 h-20 w-20 rounded-full bg-white/10 animate-pulse" style={{animationDelay: '1s'}}></div>
      </section>

      {/* Stats Grid */}
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate/10 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color} text-white text-xl`}>
                {stat.icon}
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        ))}
      </section>

      {/* Main Content Grid */}
      <section className="grid gap-8 lg:grid-cols-2">
        {/* Latest Exam Result */}
        <div className="bg-white rounded-2xl border border-slate/10 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Latest Exam Result</h2>
          {dashboard?.latestResult ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate/10 p-4">
                <p className="text-xs uppercase text-slate">Exam</p>
                <p className="mt-2 text-lg font-semibold">{dashboard.latestResult.examName}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate/10 p-4">
                  <p className="text-xs uppercase text-slate">Total</p>
                  <p className="mt-2 text-lg font-semibold">{dashboard.latestResult.total}</p>
                </div>
                <div className="rounded-xl border border-slate/10 p-4">
                  <p className="text-xs uppercase text-slate">Status</p>
                  <p className="mt-2 text-lg font-semibold">{dashboard.latestResult.status}</p>
                </div>
              </div>
              <button className="w-full rounded-lg border border-slate/20 px-4 py-3 text-sm font-semibold hover:bg-slate-50 transition-colors">
                View Full Report
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate">No results published yet.</p>
          )}
        </div>

        {/* Attendance */}
        <div className="bg-white rounded-2xl border border-slate/10 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Attendance</h2>
          <p className="text-sm text-gray-600 mb-4">Monthly calendar and summary (view only).</p>
          <div className="flex flex-wrap items-center gap-3 mb-4">
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
          <div className="grid gap-2 grid-cols-7">
            {(attendance?.calendar ?? []).length ? (
              attendance.calendar.map((day: { date: string; status: string }) => (
                <div key={day.date} className="rounded-lg border border-slate/10 px-2 py-3 text-xs">
                  <p className="font-semibold">{day.date}</p>
                  <p
                    className={
                      day.status === 'Present'
                        ? 'text-emerald-600'
                        : day.status === 'Late'
                          ? 'text-amber-600'
                          : day.status === 'Half Day'
                            ? 'text-sky-600'
                            : 'text-rose-600'
                    }
                  >
                    {day.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate col-span-7">No attendance records found.</p>
            )}
          </div>
        </div>
      </section>

      {/* Announcements & Notices */}
      <section className="bg-white rounded-2xl border border-slate/10 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Announcements & Notices</h2>
        <div className="space-y-4">
          {(dashboard?.notices ?? []).length ? (
            dashboard?.notices?.map((notice) => (
              <div key={notice.id} className="flex items-center space-x-3 rounded-xl border border-slate/10 p-4 hover:border-blue-200 hover:shadow-md transition-all duration-300">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{notice.title}</p>
                  <p className="text-xs text-gray-500">{notice.date}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate">No notices yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
