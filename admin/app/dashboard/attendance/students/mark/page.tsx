'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createStudentAttendanceSession, type StudentAttendanceStatus, updateStudentAttendanceSession } from '../../../../../services/attendanceP1.service';
import { listClasses, listSections } from '../../../../../services/academic.service';
import { getSession } from '../../../../../services/auth.service';
import { listStudents } from '../../../../../services/student.service';

type Row = { studentId: string; name: string; admissionNo: string; status: StudentAttendanceStatus; remarks: string };

const statusStyles: Record<StudentAttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  ABSENT: 'bg-rose-50 border-rose-300 text-rose-700',
  LATE: 'bg-amber-50 border-amber-300 text-amber-700',
  HALF_DAY: 'bg-sky-50 border-sky-300 text-sky-700',
};

export default function StudentAttendanceMarkPage() {
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;
  const { data: classes } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => listClasses({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const { data: sections } = useQuery({
    queryKey: ['sections', schoolId],
    queryFn: () => listSections({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const { data: students } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => listStudents({ schoolId }),
    enabled: Boolean(schoolId),
  });

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionId, setSessionId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const sectionOptions = useMemo(
    () => (sections ?? []).filter((section: { classId: string }) => section.classId === classId),
    [sections, classId],
  );
  const sectionRequired = sectionOptions.length > 0;
  const filteredStudents = useMemo(
    () =>
      (students ?? []).filter(
        (student: { classId: string | null; sectionId: string | null }) =>
          student.classId === classId && (sectionRequired ? student.sectionId === sectionId : true),
      ),
    [students, classId, sectionId, sectionRequired],
  );

  const upsertSession = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await createStudentAttendanceSession({
        classId,
        sectionId: sectionRequired ? sectionId : undefined,
        date,
      });
      setSessionId(result.id);
      setRows(
        filteredStudents.map((student: { id: string; fullName?: string; firstName: string; lastName: string; admissionNo: string }) => ({
          studentId: student.id,
          name: student.fullName ?? `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo,
          status: 'PRESENT',
          remarks: '',
        })),
      );
      setMessage('Session loaded. Mark attendance and save.');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const save = async (submit: boolean) => {
    if (!sessionId) return;
    setLoading(true);
    setMessage('');
    try {
      await updateStudentAttendanceSession(sessionId, {
        records: rows.map((row) => ({ studentId: row.studentId, status: row.status, remarks: row.remarks || undefined })),
        submit,
      });
      setMessage(submit ? 'Attendance submitted and locked.' : 'Draft saved successfully.');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 p-5 text-white shadow">
        <h1 className="text-2xl font-semibold">Student Attendance</h1>
        <p className="mt-1 text-sm text-blue-100">Select class and date, then mark each student quickly.</p>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setSectionId('');
              setRows([]);
              setSessionId('');
            }}
          >
            <option value="">Select class</option>
            {(classes ?? []).map((item: { id: string; name: string }) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              setRows([]);
              setSessionId('');
            }}
            disabled={!classId || !sectionRequired}
          >
            <option value="">{!classId ? 'Select class first' : sectionRequired ? 'Select section' : 'No section needed'}</option>
            {sectionOptions.map((item: { id: string; name: string }) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} />
          <button
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={upsertSession}
            disabled={loading || !classId || (sectionRequired && !sectionId)}
          >
            {loading ? 'Loading...' : 'Load Students'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'] as StudentAttendanceStatus[]).map((status) => (
          <span key={status} className={`rounded-full border px-3 py-1 ${statusStyles[status]}`}>
            {status}
          </span>
        ))}
      </div>

      {sessionId ? (
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-12 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <div className="col-span-2">Admission No</div>
            <div className="col-span-3">Name</div>
            <div className="col-span-5">Status</div>
            <div className="col-span-2">Remarks</div>
          </div>
          {rows.map((row, index) => (
            <div key={row.studentId} className="grid grid-cols-12 items-center gap-2 border-b px-4 py-3 last:border-b-0">
              <div className="col-span-2 text-sm font-medium text-slate-700">{row.admissionNo}</div>
              <div className="col-span-3 text-sm">{row.name}</div>
              <div className="col-span-5 flex flex-wrap gap-2">
                {(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'] as StudentAttendanceStatus[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      row.status === option ? statusStyles[option] : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: option } : item)))}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <div className="col-span-2">
                <input
                  className="w-full rounded border px-2 py-1 text-sm"
                  placeholder="Remarks"
                  value={row.remarks}
                  onChange={(event) => setRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, remarks: event.target.value } : item)))}
                />
              </div>
            </div>
          ))}
          {!rows.length ? <p className="px-4 py-5 text-sm text-slate-500">No students found for selected class/section.</p> : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => save(false)} disabled={loading || !sessionId}>
          Save Draft
        </button>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => save(true)} disabled={loading || !sessionId}>
          Submit & Lock
        </button>
      </div>

      {message ? <p className="rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
