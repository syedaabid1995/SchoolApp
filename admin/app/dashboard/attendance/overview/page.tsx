'use client';

import { useState } from 'react';
import { getAttendanceSummary } from '../../../../services/attendanceP1.service';

export default function AttendanceOverviewPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Awaited<ReturnType<typeof getAttendanceSummary>> | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setMessage('');
    try {
      const result = await getAttendanceSummary({ date });
      setData(result);
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to load summary');
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Attendance Overview</h1>
      <div className="flex gap-3">
        <input className="rounded border px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={load}>
          Load
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <Stat label="Present" value={data.totals.present} />
            <Stat label="Absent" value={data.totals.absent} />
            <Stat label="Late" value={data.totals.late} />
            <Stat label="Half Day" value={data.totals.halfDay} />
            <Stat label="Sessions" value={data.totals.sessions} />
          </div>
          <div className="rounded border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Date</th>
                  <th className="p-2">Class</th>
                  <th className="p-2">Section</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Records</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.id} className="border-b last:border-none">
                    <td className="p-2">{new Date(session.date).toLocaleDateString()}</td>
                    <td className="p-2">{session.className}</td>
                    <td className="p-2">{session.sectionName}</td>
                    <td className="p-2">{session.status}</td>
                    <td className="p-2">{session.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
