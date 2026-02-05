'use client';

import { useEffect, useState } from 'react';
import { listTeacherSelfAttendance, markTeacherSelfAttendance } from '../../../../services/attendanceP1.service';

export default function MyAttendancePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'PRESENT' | 'LEAVE'>('PRESENT');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Array<{ id: string; date: string; status: string }>>([]);

  const load = async () => {
    const data = await listTeacherSelfAttendance();
    setItems(data.map((d) => ({ id: d.id, date: d.date, status: d.status })));
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    setMessage('');
    try {
      await markTeacherSelfAttendance({ status, date });
      setMessage('Attendance marked');
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to mark attendance');
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">My Attendance</h1>
      <div className="flex flex-wrap gap-3">
        <input className="rounded border px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="rounded border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as 'PRESENT' | 'LEAVE')}>
          <option value="PRESENT">PRESENT</option>
          <option value="LEAVE">LEAVE</option>
        </select>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={submit}>
          Mark
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Date</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-none">
                <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                <td className="p-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
