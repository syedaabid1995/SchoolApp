'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../../components/PageHeader';
import Button from '../../../../components/Button';
import { getSession } from '../../../../services/auth.service';
import { listTeacherSelfAttendance, markTeacherSelfAttendance, listLeaveRequests } from '../../../../services/attendanceP1.service';

type AttendanceMark = 'PRESENT' | 'ABSENT' | 'LOP' | 'CL' | 'SL';

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

const parseLeaveType = (text?: string | null): AttendanceMark => {
  const value = (text ?? '').toUpperCase();
  if (value.includes('LOP')) return 'LOP';
  if (value.includes('CL')) return 'CL';
  if (value.includes('SL')) return 'SL';
  if (value.includes('ABSENT')) return 'ABSENT';
  return 'ABSENT';
};

const statusStyles: Record<AttendanceMark, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
  LOP: 'bg-orange-100 text-orange-700 border-orange-200',
  CL: 'bg-sky-100 text-sky-700 border-sky-200',
  SL: 'bg-violet-100 text-violet-700 border-violet-200',
};

export default function MyAttendancePage() {
  const [role, setRole] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [statusByDate, setStatusByDate] = useState<Record<string, AttendanceMark>>({});
  const [message, setMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceMark>('PRESENT');
  const [isSaving, setIsSaving] = useState(false);

  const monthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthEnd = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), [monthCursor]);
  const monthLabel = monthCursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const load = async () => {
    try {
      setMessage('');
      const [attendanceRows, approvedLeaves] = await Promise.all([
        listTeacherSelfAttendance({ fromDate: formatDate(monthStart), toDate: formatDate(monthEnd) }),
        listLeaveRequests({ status: 'APPROVED' }),
      ]);

      const merged: Record<string, AttendanceMark> = {};
      for (const row of attendanceRows) {
        merged[row.date.slice(0, 10)] = row.status === 'PRESENT' ? 'PRESENT' : parseLeaveType(row.overrideReason);
      }

      for (const leave of approvedLeaves) {
        const start = new Date(leave.fromDate);
        const end = new Date(leave.toDate);
        const leaveType = parseLeaveType(leave.reason);
        for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          const key = formatDate(cursor);
          if (!merged[key]) merged[key] = leaveType;
        }
      }

      setStatusByDate(merged);
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to load attendance calendar');
    }
  };

  useEffect(() => {
    const init = async () => {
      const session = await getSession();
      setRole(session.role);
      if (session.role === 'TEACHER') await load();
    };
    void init();
  }, [monthCursor]);

  const days = useMemo(() => {
    const firstDayIndex = monthStart.getDay();
    const totalDays = monthEnd.getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstDayIndex; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthCursor, monthEnd, monthStart]);

  const saveMark = async () => {
    if (!selectedDate || role !== 'TEACHER') return;
    setIsSaving(true);
    setMessage('');
    try {
      await markTeacherSelfAttendance({
        status: selectedStatus === 'PRESENT' ? 'PRESENT' : 'LEAVE',
        date: selectedDate,
        overrideReason: selectedStatus === 'PRESENT' ? undefined : selectedStatus,
      });
      setSelectedDate(null);
      setMessage('Attendance updated');
      await load();
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to mark attendance');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="My Attendance"
          subtitle="Track your monthly attendance and mark each day from the calendar"
        />
        {role && role !== 'TEACHER' ? (
          <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-amber-900">
                This page is available for teacher self attendance only.
              </p>
            </div>
          </div>
        ) : null}

        {/* Calendar */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <div className="mb-6 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
              icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>}
              iconPosition="left"
            >
              Previous
            </Button>
            <h2 className="text-2xl font-bold text-gray-900">{monthLabel}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
              icon={<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>}
              iconPosition="right"
            >
              Next
            </Button>
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
              const key = formatDate(dateValue);
              const status = statusByDate[key];
              const isToday = formatDate(new Date()) === key;
              return (
                <button
                  key={key}
                  className={`h-20 rounded-xl border-2 p-3 text-left transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow-md ${
                    isToday ? 'border-purple-400 bg-purple-50' : 'border-gray-200'
                  }`}
                  onClick={() => {
                    setSelectedDate(key);
                    setSelectedStatus(status ?? 'PRESENT');
                  }}
                >
                  <div className={`text-sm font-bold ${isToday ? 'text-purple-700' : 'text-gray-900'}`}>
                    {dateValue.getDate()}
                  </div>
                  {status ? (
                    <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusStyles[status]}`}>
                      {status}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Legend</h3>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(statusStyles) as AttendanceMark[]).map((status) => (
              <span key={status} className={`rounded-full border px-4 py-2 text-sm font-semibold ${statusStyles[status]}`}>
                {status === 'LOP' ? 'Loss of Pay' : status === 'CL' ? 'Casual Leave' : status === 'SL' ? 'Sick Leave' : status}
              </span>
            ))}
          </div>
        </div>

        {message ? (
          <div className={`rounded-2xl p-4 shadow-sm ${
            message.includes('Failed') || message.includes('error') 
              ? 'bg-red-50 border border-red-200 text-red-700' 
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="font-medium">{message}</p>
            </div>
          </div>
        ) : null}

        {/* Modal */}
        {selectedDate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-full bg-purple-100 p-2">
                  <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Mark Attendance</h3>
                  <p className="text-sm text-gray-500">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['PRESENT', 'ABSENT', 'LOP', 'CL', 'SL'] as AttendanceMark[]).map((option) => (
                  <button
                    key={option}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                      selectedStatus === option 
                        ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md' 
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedStatus(option)}
                  >
                    {option === 'LOP' ? 'Loss of Pay' : option === 'CL' ? 'Casual Leave' : option === 'SL' ? 'Sick Leave' : option}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(null)} 
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary"
                  size="sm"
                  onClick={saveMark} 
                  disabled={role !== 'TEACHER'}
                  loading={isSaving}
                >
                  Save Attendance
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
