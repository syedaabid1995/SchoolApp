'use client';

import { useEffect, useState } from 'react';
import { approveLeaveRequest, listLeaveRequests, rejectLeaveRequest } from '../../../../services/attendanceP1.service';

type LeaveItem = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  fromDate: string;
  toDate: string;
  reason: string;
  teacher?: { firstName: string; lastName: string };
};

export default function LeaveRequestsPage() {
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [message, setMessage] = useState('');

  const load = async () => {
    const data = await listLeaveRequests();
    setItems(data as LeaveItem[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, approve: boolean) => {
    setMessage('');
    try {
      if (approve) await approveLeaveRequest(id);
      else await rejectLeaveRequest(id);
      await load();
      setMessage(approve ? 'Leave approved' : 'Leave rejected');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Action failed');
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Leave Requests</h1>
      {message ? <p className="text-sm">{message}</p> : null}
      <div className="rounded border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Teacher</th>
              <th className="p-2">From</th>
              <th className="p-2">To</th>
              <th className="p-2">Reason</th>
              <th className="p-2">Status</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-none">
                <td className="p-2">{item.teacher ? `${item.teacher.firstName} ${item.teacher.lastName}` : '—'}</td>
                <td className="p-2">{new Date(item.fromDate).toLocaleDateString()}</td>
                <td className="p-2">{new Date(item.toDate).toLocaleDateString()}</td>
                <td className="p-2">{item.reason}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">
                  {item.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <button className="rounded bg-emerald-600 px-2 py-1 text-white" onClick={() => act(item.id, true)}>
                        Approve
                      </button>
                      <button className="rounded bg-rose-600 px-2 py-1 text-white" onClick={() => act(item.id, false)}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
