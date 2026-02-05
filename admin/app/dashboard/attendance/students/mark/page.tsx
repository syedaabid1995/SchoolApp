'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createStudentAttendanceSession, type StudentAttendanceStatus, updateStudentAttendanceSession } from '../../../../../services/attendanceP1.service';
import { listClasses, listSections } from '../../../../../services/academic.service';
import { getSession } from '../../../../../services/auth.service';
import { listStudents } from '../../../../../services/student.service';

type Row = { studentId: string; name: string; admissionNo: string; status: StudentAttendanceStatus; remarks: string };

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
  const sectionOptions = (sections ?? []).filter((section: { classId: string }) => section.classId === classId);
  const sectionRequired = sectionOptions.length > 0;
  const filteredStudents = (students ?? []).filter(
    (student: { id: string; classId: string | null; sectionId: string | null }) =>
      student.classId === classId && (sectionRequired ? student.sectionId === sectionId : true),
  );

  const upsertSession = async () => {
    setLoading(true);
    setMessage('');
    try {
      const session = await createStudentAttendanceSession({
        classId,
        sectionId: sectionRequired ? sectionId : undefined,
        date,
      });
      setSessionId(session.id);
      setRows(
        filteredStudents.map((student: { id: string; fullName?: string; firstName: string; lastName: string; admissionNo: string }) => ({
          studentId: student.id,
          name: student.fullName ?? `${student.firstName} ${student.lastName}`.trim(),
          admissionNo: student.admissionNo,
          status: 'PRESENT',
          remarks: '',
        })),
      );
      setMessage(`Session ready: ${session.id}`);
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to create session');
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
        records: rows.map((r) => ({ studentId: r.studentId, status: r.status, remarks: r.remarks || undefined })),
        submit,
      });
      setMessage(submit ? 'Attendance submitted and locked' : 'Draft saved');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to update session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Student Attendance</h1>
      <div className="grid gap-3 md:grid-cols-4">
        <select
          className="rounded border px-3 py-2"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSectionId('');
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
          className="rounded border px-3 py-2"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
          disabled={!classId || !sectionRequired}
        >
          <option value="">
            {!classId ? 'Select class first' : sectionRequired ? 'Select section' : 'No sections for class'}
          </option>
          {sectionOptions.map((item: { id: string; name: string }) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input className="rounded border px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
          onClick={upsertSession}
          disabled={loading || !classId || (sectionRequired && !sectionId)}
        >
          Load Students
        </button>
      </div>

      {sessionId ? (
        <div className="space-y-2 rounded border">
          <div className="grid grid-cols-12 border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <div className="col-span-3">Admission No</div>
            <div className="col-span-3">Name</div>
            <div className="col-span-4">Status</div>
            <div className="col-span-2">Remarks</div>
          </div>
          {rows.map((row, idx) => (
            <div key={row.studentId} className="grid grid-cols-12 items-center gap-2 border-b px-3 py-2 last:border-b-0">
              <div className="col-span-3 text-sm">{row.admissionNo}</div>
              <div className="col-span-3 text-sm">{row.name}</div>
              <div className="col-span-4 flex flex-wrap gap-3 text-sm">
                {(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'] as StudentAttendanceStatus[]).map((option) => (
                  <label key={option} className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name={`attendance-${row.studentId}`}
                      checked={row.status === option}
                      onChange={() => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: option } : r)))}
                    />
                    {option}
                  </label>
                ))}
              </div>
              <div className="col-span-2">
                <input
                  className="w-full rounded border px-2 py-1 text-sm"
                  placeholder="Remarks"
                  value={row.remarks}
                  onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, remarks: e.target.value } : r)))}
                />
              </div>
            </div>
          ))}
          {!rows.length ? <p className="px-3 py-4 text-sm text-slate-500">No students found for selected class/section.</p> : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button className="rounded bg-slate-800 px-3 py-2 text-white disabled:opacity-50" onClick={() => save(false)} disabled={loading || !sessionId}>
          Save Draft
        </button>
        <button className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50" onClick={() => save(true)} disabled={loading || !sessionId}>
          Submit & Lock
        </button>
      </div>

      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}
