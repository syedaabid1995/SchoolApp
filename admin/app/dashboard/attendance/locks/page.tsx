'use client';

import { useState } from 'react';
import { lockStudentAttendanceSession, updateStudentAttendanceSession } from '../../../../services/attendanceP1.service';

export default function AttendanceLocksPage() {
  const [sessionId, setSessionId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const lock = async () => {
    try {
      await lockStudentAttendanceSession(sessionId, reason);
      setMessage('Session locked');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to lock');
    }
  };

  const unlock = async () => {
    try {
      await updateStudentAttendanceSession(sessionId, { unlock: true, reason, records: [] });
      setMessage('Session unlocked');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to unlock');
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Attendance Locks</h1>
      <input className="w-full rounded border px-3 py-2" placeholder="Session ID" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
      <input className="w-full rounded border px-3 py-2" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <button className="rounded bg-slate-800 px-3 py-2 text-white" onClick={lock}>
          Lock
        </button>
        <button className="rounded bg-amber-600 px-3 py-2 text-white" onClick={unlock}>
          Unlock
        </button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
