'use client';

import { useEffect, useState } from 'react';
import { createLeaveRequest, listLeaveRequests } from '../../../../services/attendanceP1.service';

export default function MyLeavePage() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Array<{ id: string; fromDate: string; toDate: string; status: string; reason: string }>>([]);

  const load = async () => {
    const data = await listLeaveRequests();
    setItems(data.map((d) => ({ id: d.id, fromDate: d.fromDate, toDate: d.toDate, status: d.status, reason: d.reason })));
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async () => {
    setMessage('');
    try {
      await createLeaveRequest({ fromDate, toDate, reason });
      setReason('');
      setMessage('Leave request submitted');
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to create leave request');
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">My Leave Requests</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <input className="rounded border px-3 py-2" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="rounded border px-3 py-2" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <input className="rounded border px-3 py-2" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={submit}>
          Apply
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">From</th>
              <th className="p-2">To</th>
              <th className="p-2">Status</th>
              <th className="p-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-none">
                <td className="p-2">{new Date(item.fromDate).toLocaleDateString()}</td>
                <td className="p-2">{new Date(item.toDate).toLocaleDateString()}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{item.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
