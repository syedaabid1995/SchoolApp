'use client';

import { useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getParentDashboard, type ParentChild } from '../../../services/parentPortal.service';
import { ParentChildContext } from '../../../components/ParentPortalLayout';

export default function ParentDashboardPage() {
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

  if (!activeChild) {
    return (
      <div className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">No linked children</h2>
        <p className="mt-2 text-sm text-slate">Ask your school admin to link your account to a student.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-slate">Child-specific summary for {activeChild.name}.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate">Child Summary</h3>
          <p className="mt-2 text-lg font-semibold">{activeChild.name}</p>
          <p className="text-sm text-slate">{activeChild.classLabel}</p>
          <p className="mt-3 text-sm text-slate">Roll No: {activeChild.rollNo || '—'}</p>
          <p className="text-sm text-slate">Attendance: {dashboard?.attendancePercent ?? '—'}%</p>
          <p className="text-sm text-slate">Current Exam: {dashboard?.currentExam || '—'}</p>
        </div>

        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate">Latest Exam Result</h3>
          {dashboard?.latestResult ? (
            <div className="mt-3 space-y-1 text-sm text-slate">
              <p>Exam: {dashboard.latestResult.examName}</p>
              <p>Total: {dashboard.latestResult.total}</p>
              <p>Status: {dashboard.latestResult.status}</p>
              <button className="mt-3 rounded-lg border border-slate/20 px-3 py-2 text-xs font-semibold">
                View Full Report
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">No results published yet.</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate">Attendance Snapshot</h3>
          {dashboard?.attendanceSnapshot ? (
            <div className="mt-3 text-sm text-slate">
              <p>Present Days: {dashboard.attendanceSnapshot.presentDays}</p>
              <p>Absent Days: {dashboard.attendanceSnapshot.absentDays}</p>
              <p>Monthly %: {dashboard.attendanceSnapshot.monthlyPercent}%</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">Attendance data will appear here.</p>
          )}
        </div>
        <div className="rounded-2xl border border-slate/10 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate">Announcements & Notices</h3>
          <div className="mt-3 space-y-2 text-sm text-slate">
            {(dashboard?.notices ?? []).length ? (
              dashboard?.notices?.map((notice) => (
                <div key={notice.id} className="rounded-lg border border-slate/10 px-3 py-2">
                  <p className="font-medium text-ink">{notice.title}</p>
                  <p className="text-xs text-slate">{notice.date}</p>
                </div>
              ))
            ) : (
              <p>No notices yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
