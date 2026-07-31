'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../../components/PageHeader';
import Button from '../../../../../components/Button';
import { useNotify } from '../../../../../components/NotificationProvider';
import { createStudentAttendanceSession, type StudentAttendanceStatus, updateStudentAttendanceSession } from '../../../../../services/attendanceP1.service';
import { getAttendanceMode, listAcademicYears, listClasses, listSections } from '../../../../../services/academic.service';
import { getSession } from '../../../../../services/auth.service';
import { listStudents } from '../../../../../services/student.service';
import { listAttendancePeriods } from '../../../../../services/attendance.service';
import {
  loadAttendanceSheet,
  lockAttendanceSheet,
  getStudentAttendanceReportView,
  resolveAttendanceConfiguration,
  resolveAttendanceUnits,
  saveAttendanceSheet,
  type AttendanceReportStatus,
  type AttendanceStatus,
  type AttendanceUnitType,
  type ResolvedAttendanceUnit,
  type StudentAttendanceReport,
} from '../../../../../services/attendanceV2.service';

type LegacyRow = { studentId: string; name: string; admissionNo: string; status: StudentAttendanceStatus; remarks: string };
type SheetRow = { studentId: string; name: string; admissionNo: string; rollNo?: string | null; status: AttendanceStatus; note: string };
type SectionOption = { id: string; name: string; classId?: string | null; classSections?: Array<{ classId: string }> };

const legacyStatusStyles: Record<StudentAttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  ABSENT: 'bg-rose-50 border-rose-300 text-rose-700',
  LATE: 'bg-amber-50 border-amber-300 text-amber-700',
  HALF_DAY: 'bg-sky-50 border-sky-300 text-sky-700',
};

const sheetStatuses: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
const sheetStatusStyles: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 border-emerald-300 text-emerald-700',
  LATE: 'bg-amber-50 border-amber-300 text-amber-700',
  ABSENT: 'bg-rose-50 border-rose-300 text-rose-700',
  EXCUSED: 'bg-sky-50 border-sky-300 text-sky-700',
};

const reportStatusStyles: Record<AttendanceReportStatus, string> = {
  PRESENT: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  LATE: 'border-amber-200 bg-amber-50 text-amber-700',
  ABSENT: 'border-rose-200 bg-rose-50 text-rose-700',
  EXCUSED: 'border-sky-200 bg-sky-50 text-sky-700',
  HOLIDAY: 'border-violet-200 bg-violet-50 text-violet-700',
  UNMARKED: 'border-slate-200 bg-slate-50 text-slate-500',
};

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};
const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error?.message ?? error?.response?.data?.message ?? fallback;

const unitKey = (unit: ResolvedAttendanceUnit) =>
  [unit.unitType, unit.slotId ?? unit.slotType ?? '', unit.periodId ?? '', unit.timetableEntryId ?? ''].join(':');

const buildUnitPayload = (unit: ResolvedAttendanceUnit) => ({
  unitType: unit.unitType as AttendanceUnitType,
  slotId: unit.slotId ?? undefined,
  slotType: unit.slotType ?? undefined,
  periodId: unit.periodId ?? undefined,
  timetableEntryId: unit.timetableEntryId ?? undefined,
});

const studentName = (student: { fullName?: string | null; firstName?: string | null; lastName?: string | null }) =>
  student.fullName || `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim() || 'Unnamed student';

const sectionsForClass = (sections: SectionOption[] | undefined, classId: string) =>
  (sections ?? []).filter((section) =>
    classId ? section.classId === classId || section.classSections?.some((link) => link.classId === classId) : true,
  );

function StudentAttendanceReportTable({ report }: { report: StudentAttendanceReport }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Date</th>
            <th className="px-4 py-3">Day</th>
            {report.columns.map((column) => (
              <th key={column.key} className="min-w-36 px-4 py-3">
                <span className="block font-black text-slate-600">{column.label}</span>
                {column.startTime ? <span className="mt-1 block text-[11px] normal-case text-slate-400">{column.startTime}-{column.endTime ?? ''}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {report.rows.map((row) => (
            <tr key={row.date} className="align-top">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 font-semibold text-slate-800">{formatDate(row.date)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{row.day}</td>
              {report.columns.map((column) => {
                const cell = row.cells[column.key] ?? { status: 'UNMARKED' as AttendanceReportStatus };
                return (
                  <td key={column.key} className="px-4 py-3">
                    <div className={`min-h-14 rounded-lg border px-3 py-2 ${reportStatusStyles[cell.status]}`}>
                      <p className="text-xs font-black">{cell.status}</p>
                      {cell.subject ? <p className="mt-1 text-xs">{cell.subject}</p> : null}
                      {cell.note ? <p className="mt-1 text-xs opacity-80">{cell.note}</p> : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LegacyStudentAttendanceMarkPage({ onUseV2 }: { onUseV2: () => void }) {
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
  const { data: attendanceMode } = useQuery({
    queryKey: ['attendance-mode', schoolId],
    queryFn: () => getAttendanceMode({ schoolId }),
    enabled: Boolean(schoolId),
  });
  const { data: periods } = useQuery({
    queryKey: ['attendance-periods', schoolId],
    queryFn: () => listAttendancePeriods({ schoolId }),
    enabled: Boolean(schoolId),
  });

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today());
  const [periodId, setPeriodId] = useState('');
  const [shiftKey, setShiftKey] = useState('MORNING');
  const [sessionId, setSessionId] = useState('');
  const [sessionMeta, setSessionMeta] = useState<{ status?: 'DRAFT' | 'LOCKED'; lockedAt?: string | null; lockedById?: string | null }>({});
  const [rows, setRows] = useState<LegacyRow[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const mode = attendanceMode?.mode ?? 'DAILY';
  const requiresPeriod = mode === 'PERIOD_WISE';
  const requiresShift = mode === 'SHIFT_WISE';

  const sectionOptions = useMemo(() => sectionsForClass(sections, classId), [sections, classId]);
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
        periodId: requiresPeriod ? periodId : undefined,
        shiftKey: requiresShift ? shiftKey : undefined,
        schoolId,
      });
      setSessionId(result.id);
      setSessionMeta({ status: result.status, lockedAt: result.lockedAt ?? null, lockedById: result.lockedById ?? null });
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
      setMessage(errorMessage(err, 'Failed to load students'));
    } finally {
      setLoading(false);
    }
  };

  const save = async (submit: boolean) => {
    if (!sessionId) return;
    setLoading(true);
    setMessage('');
    try {
      const updated = await updateStudentAttendanceSession(sessionId, {
        records: rows.map((row) => ({ studentId: row.studentId, status: row.status, remarks: row.remarks || undefined })),
        submit,
        schoolId,
      });
      setSessionMeta({ status: updated.status, lockedAt: updated.lockedAt ?? null, lockedById: updated.lockedById ?? null });
      setMessage(submit ? 'Attendance submitted and locked.' : 'Draft saved successfully.');
    } catch (err: any) {
      setMessage(errorMessage(err, 'Failed to save attendance'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Attendance"
          subtitle="Legacy attendance flow. Use this only while older daily attendance screens are being phased out."
          actions={<Button variant="outline" size="sm" onClick={onUseV2}>Use V2 Flow</Button>}
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2 text-sm" value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(''); setRows([]); setSessionId(''); }}>
              <option value="">Select class</option>
              {(classes ?? []).map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={sectionId} onChange={(event) => { setSectionId(event.target.value); setRows([]); setSessionId(''); }} disabled={!classId || !sectionRequired}>
              <option value="">{!classId ? 'Select class first' : sectionRequired ? 'Select section' : 'No section needed'}</option>
              {sectionOptions.map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input className="rounded-lg border px-3 py-2 text-sm" type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} />
            {requiresPeriod ? (
              <select className="rounded-lg border px-3 py-2 text-sm" value={periodId} onChange={(event) => setPeriodId(event.target.value)}>
                <option value="">Select period</option>
                {(periods ?? []).map((period) => <option key={period.id} value={period.id}>{period.name} ({period.startTime}-{period.endTime})</option>)}
              </select>
            ) : null}
            {requiresShift ? (
              <select className="rounded-lg border px-3 py-2 text-sm" value={shiftKey} onChange={(event) => setShiftKey(event.target.value)}>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
              </select>
            ) : null}
            <Button variant="primary" size="sm" onClick={upsertSession} disabled={!classId || (sectionRequired && !sectionId) || (requiresPeriod && !periodId)} loading={loading}>
              Load Students
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Attendance mode: <span className="font-semibold">{mode}</span></p>
        </div>

        {sessionId ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
            {sessionMeta.status === 'LOCKED' ? (
              <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">Attendance is locked.</div>
            ) : null}
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
                    <button key={option} type="button" className={`rounded-full border px-3 py-1 text-xs font-medium ${row.status === option ? legacyStatusStyles[option] : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} onClick={() => setRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: option } : item)))}>
                      {option}
                    </button>
                  ))}
                </div>
                <div className="col-span-2">
                  <input className="w-full rounded border px-2 py-1 text-sm" placeholder="Remarks" value={row.remarks} onChange={(event) => setRows((prev) => prev.map((item, idx) => (idx === index ? { ...item, remarks: event.target.value } : item)))} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => save(false)} disabled={!sessionId} loading={loading}>Save Draft</Button>
          <Button variant="primary" size="sm" onClick={() => save(true)} disabled={!sessionId} loading={loading}>Submit & Lock</Button>
        </div>
        {message ? <p className="mt-4 rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}

function StudentAttendanceMarkV2Page({ onUseLegacy }: { onUseLegacy?: () => void }) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const schoolId = session?.schoolId ?? undefined;
  const role = session?.role;
  const isSchoolAdmin = role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canView = role === 'SUPER_ADMIN' || hasPermission('attendance.view') || hasPermission('attendance.create') || hasPermission('attendance.edit');
  const canMark = role !== 'SUPER_ADMIN' && (hasPermission('attendance.create') || hasPermission('attendance.edit'));
  const canLock = role !== 'SUPER_ADMIN' && hasPermission('attendance.edit');

  const { data: years } = useQuery({ queryKey: ['academic-years', schoolId], queryFn: () => listAcademicYears({ schoolId }), enabled: Boolean(schoolId) });
  const { data: classes } = useQuery({ queryKey: ['classes', schoolId], queryFn: () => listClasses({ schoolId }), enabled: Boolean(schoolId) });
  const { data: sections } = useQuery({ queryKey: ['sections', schoolId], queryFn: () => listSections({ schoolId }), enabled: Boolean(schoolId) });

  const [criteria, setCriteria] = useState({ academicYearId: '', classId: '', sectionId: '', date: today() });
  const [selectedUnitKey, setSelectedUnitKey] = useState('');
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [loadedSessionId, setLoadedSessionId] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportCriteria, setReportCriteria] = useState({ academicYearId: '', classId: '', sectionId: '', studentId: '' });

  const activeYear = useMemo(
    () => (years ?? []).find((year: { isActive?: boolean }) => year.isActive) ?? (years ?? [])[0],
    [years],
  );
  const effectiveCriteria = { ...criteria, academicYearId: criteria.academicYearId || activeYear?.id || '' };
  const effectiveReportCriteria = { ...reportCriteria, academicYearId: reportCriteria.academicYearId || activeYear?.id || '' };
  const sectionOptions = useMemo(() => sectionsForClass(sections, effectiveCriteria.classId), [sections, effectiveCriteria.classId]);
  const sectionRequired = sectionOptions.length > 0;
  const reportSectionOptions = useMemo(() => sectionsForClass(sections, effectiveReportCriteria.classId), [sections, effectiveReportCriteria.classId]);
  const reportSectionRequired = reportSectionOptions.length > 0;
  const canResolve = Boolean(schoolId && effectiveCriteria.academicYearId && effectiveCriteria.classId && effectiveCriteria.date && (!sectionRequired || effectiveCriteria.sectionId));
  const canReport = role === 'SUPER_ADMIN' || hasPermission('attendance.report') || hasPermission('attendance.view') || hasPermission('attendance.edit') || hasPermission('attendance.create');
  const canLoadReportStudents = Boolean(showReport && schoolId && effectiveReportCriteria.academicYearId && effectiveReportCriteria.classId && (!reportSectionRequired || effectiveReportCriteria.sectionId));
  const resetSheetState = () => {
    setRows([]);
    setLoadedSessionId('');
    setSelectedUnitKey('');
  };
  const changeClass = (classId: string) => {
    const options = sectionsForClass(sections, classId);
    const sectionStillValid = Boolean(criteria.sectionId && options.some((section) => section.id === criteria.sectionId));
    setCriteria({ ...criteria, classId, sectionId: sectionStillValid ? criteria.sectionId : '' });
    resetSheetState();
  };
  const changeReportClass = (classId: string) => {
    const options = sectionsForClass(sections, classId);
    const sectionStillValid = Boolean(reportCriteria.sectionId && options.some((section) => section.id === reportCriteria.sectionId));
    setReportCriteria({ ...reportCriteria, classId, sectionId: sectionStillValid ? reportCriteria.sectionId : '', studentId: '' });
  };

  const reportStudentsQuery = useQuery({
    queryKey: ['attendance-report-students', schoolId, effectiveReportCriteria.academicYearId, effectiveReportCriteria.classId, effectiveReportCriteria.sectionId],
    queryFn: () => listStudents({
      schoolId,
      academicSessionId: effectiveReportCriteria.academicYearId,
      classId: effectiveReportCriteria.classId,
      sectionId: effectiveReportCriteria.sectionId || undefined,
    }),
    enabled: canReport && canLoadReportStudents,
  });

  const reportMutation = useMutation({
    mutationFn: () => getStudentAttendanceReportView({
      schoolId,
      academicYearId: effectiveReportCriteria.academicYearId,
      classId: effectiveReportCriteria.classId,
      sectionId: effectiveReportCriteria.sectionId || undefined,
      studentId: effectiveReportCriteria.studentId,
    }),
    onError: (error: any) => notify.error('Unable to load report', errorMessage(error, 'Please check the selected student and try again.')),
  });

  const resolutionQuery = useQuery({
    queryKey: ['attendance-v2-resolution', schoolId, effectiveCriteria],
    queryFn: () => resolveAttendanceConfiguration({ ...effectiveCriteria, schoolId }),
    enabled: canView && canResolve,
    retry: false,
  });

  const unitsQuery = useQuery({
    queryKey: ['attendance-v2-units', schoolId, effectiveCriteria],
    queryFn: () => resolveAttendanceUnits({ ...effectiveCriteria, schoolId }),
    enabled: canView && canResolve,
    retry: false,
  });

  const units = unitsQuery.data?.units ?? resolutionQuery.data?.units ?? [];
  const selectedUnit = units.find((unit) => unitKey(unit) === selectedUnitKey) ?? units[0];
  const mode = resolutionQuery.data?.mode ?? unitsQuery.data?.configuration.mode;

  const sheetQuery = useQuery({
    queryKey: ['attendance-v2-sheet', schoolId, effectiveCriteria, selectedUnit ? unitKey(selectedUnit) : 'none'],
    queryFn: () => loadAttendanceSheet({ ...effectiveCriteria, schoolId, ...buildUnitPayload(selectedUnit!) }),
    enabled: canView && canResolve && Boolean(selectedUnit),
    retry: false,
  });

  const sheet = sheetQuery.data;
  const isLocked = sheet?.session?.status === 'CLOSED' || Boolean(sheet?.session?.lockedAt);

  const loadRows = async () => {
    if (!selectedUnit) {
      notify.warning('No attendance unit', mode === 'PERIOD_WISE' ? 'No timetable entry or fallback period is configured.' : 'No attendance unit is available.');
      return;
    }
    const result = await sheetQuery.refetch();
    if (result.data) {
      setLoadedSessionId(result.data.session?.id ?? '');
      setRows(
        result.data.rows.map((row) => ({
          studentId: row.student.id,
          name: studentName(row.student),
          admissionNo: row.student.admissionNo,
          rollNo: row.student.rollNo,
          status: row.status ?? 'PRESENT',
          note: row.manualOverrideReason ?? '',
        })),
      );
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUnit) throw new Error('Select an attendance unit first.');
      return saveAttendanceSheet({
        ...effectiveCriteria,
        schoolId,
        ...buildUnitPayload(selectedUnit),
        records: rows.map((row) => ({ studentId: row.studentId, status: row.status, manualOverrideReason: row.note || undefined })),
      });
    },
    onSuccess: (data) => {
      setLoadedSessionId(data.session?.id ?? '');
      queryClient.invalidateQueries({ queryKey: ['attendance-v2-sheet'] });
      notify.success('Attendance saved', `${rows.length} records were saved for ${selectedUnit?.label ?? 'the selected unit'}.`);
    },
    onError: (error: any) => notify.error('Unable to save attendance', errorMessage(error, 'Please check the sheet and try again.')),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockAttendanceSheet(loadedSessionId || sheet?.session?.id || '', { schoolId, reason: 'Locked from admin attendance sheet' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-v2-sheet'] });
      notify.success('Attendance locked', 'This sheet can no longer be edited.');
    },
    onError: (error: any) => notify.error('Unable to lock attendance', errorMessage(error, 'Please try again.')),
  });

  if (!canView) {
    return (
      <section className="rounded-xl border border-rose-100 bg-rose-50 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-600">Permission not available</p>
        <h1 className="mt-2 text-2xl font-bold text-rose-950">Student attendance is not enabled for your role.</h1>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Attendance"
          subtitle="Resolve attendance configuration, choose the daily slot or period, and mark the canonical attendance sheet."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Attendance', href: '/dashboard/attendance/overview' }, { label: 'Students' }]}
          actions={onUseLegacy ? <Button variant="outline" size="sm" onClick={onUseLegacy}>Use Legacy Flow</Button> : null}
        />

        {canReport ? (
          <div className="mb-5 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowReport((current) => !current)}>
              {showReport ? 'Hide Report' : 'Show Report'}
            </Button>
          </div>
        ) : null}

        {showReport && canReport ? (
          <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Students Attendance Report</h2>
                <p className="text-sm text-slate-500">Select an academic year, class, section, and student to view unit-wise attendance for the full session.</p>
              </div>
              {reportMutation.data ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  {reportMutation.data.startDate} to {reportMutation.data.endDate}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <select
                value={effectiveReportCriteria.academicYearId}
                onChange={(event) => {
                  setReportCriteria({ ...reportCriteria, academicYearId: event.target.value, classId: '', sectionId: '', studentId: '' });
                  reportMutation.reset();
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select academic year</option>
                {(years ?? []).map((year: { id: string; name: string }) => <option key={year.id} value={year.id}>{year.name}</option>)}
              </select>
              <select
                value={effectiveReportCriteria.classId}
                onChange={(event) => {
                  changeReportClass(event.target.value);
                  reportMutation.reset();
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {(classes ?? []).map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                value={effectiveReportCriteria.sectionId}
                onChange={(event) => {
                  setReportCriteria({ ...reportCriteria, sectionId: event.target.value, studentId: '' });
                  reportMutation.reset();
                }}
                disabled={!effectiveReportCriteria.classId || !reportSectionRequired}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              >
                <option value="">{!effectiveReportCriteria.classId ? 'Select class first' : reportSectionRequired ? 'Select section' : 'No section needed'}</option>
                {reportSectionOptions.map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select
                value={effectiveReportCriteria.studentId}
                onChange={(event) => {
                  setReportCriteria({ ...reportCriteria, studentId: event.target.value });
                  reportMutation.reset();
                }}
                disabled={!canLoadReportStudents || reportStudentsQuery.isFetching}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
              >
                <option value="">{reportStudentsQuery.isFetching ? 'Loading students...' : 'Select student'}</option>
                {(reportStudentsQuery.data ?? []).map((student) => (
                  <option key={student.id} value={student.id}>
                    {studentName(student)} {student.admissionNo ? `(${student.admissionNo})` : ''}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => reportMutation.mutate()}
                disabled={!effectiveReportCriteria.academicYearId || !effectiveReportCriteria.classId || (reportSectionRequired && !effectiveReportCriteria.sectionId) || !effectiveReportCriteria.studentId || reportMutation.isPending}
                loading={reportMutation.isPending}
              >
                Load Reports
              </Button>
            </div>

            {!reportStudentsQuery.isFetching && canLoadReportStudents && !(reportStudentsQuery.data ?? []).length ? (
              <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">No students found for the selected class and section.</p>
            ) : null}

            {reportMutation.data ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
                  {[
                    ['Present', reportMutation.data.summary.present],
                    ['Late', reportMutation.data.summary.late],
                    ['Absent', reportMutation.data.summary.absent],
                    ['Excused', reportMutation.data.summary.excused],
                    ['Holiday', reportMutation.data.summary.holiday],
                    ['Unmarked', reportMutation.data.summary.unmarked],
                    ['Attendance %', `${reportMutation.data.summary.percentage}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-bold text-slate-900">{reportMutation.data.student.name}</span>
                  {' '}• Admission {reportMutation.data.student.admissionNo}
                  {' '}• Mode {reportMutation.data.mode}
                  {' '}• {reportMutation.data.columns.length} attendance unit{reportMutation.data.columns.length === 1 ? '' : 's'}
                </div>
                <StudentAttendanceReportTable report={reportMutation.data} />
              </>
            ) : null}
          </section>
        ) : null}

        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <select value={effectiveCriteria.academicYearId} onChange={(event) => { setCriteria({ ...criteria, academicYearId: event.target.value }); resetSheetState(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select academic year</option>
              {(years ?? []).map((year: { id: string; name: string }) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={effectiveCriteria.classId} onChange={(event) => changeClass(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select class</option>
              {(classes ?? []).map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={effectiveCriteria.sectionId} onChange={(event) => { setCriteria({ ...criteria, sectionId: event.target.value }); resetSheetState(); }} disabled={!effectiveCriteria.classId || !sectionRequired} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
              <option value="">{!effectiveCriteria.classId ? 'Select class first' : sectionRequired ? 'Select section' : 'No section needed'}</option>
              {sectionOptions.map((item: { id: string; name: string }) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input type="date" max={today()} value={effectiveCriteria.date} onChange={(event) => { setCriteria({ ...criteria, date: event.target.value }); resetSheetState(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_2fr_auto] lg:items-end">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resolved mode</p>
              <p className="mt-1 text-lg font-black text-slate-950">{mode ?? 'Select criteria'}</p>
              <p className="text-xs text-slate-500">Source: {resolutionQuery.data?.source ?? 'Not resolved'}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Attendance unit</label>
              <select value={selectedUnit ? unitKey(selectedUnit) : ''} onChange={(event) => { setSelectedUnitKey(event.target.value); setRows([]); }} disabled={!units.length} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                {!units.length ? <option value="">No units available</option> : null}
                {units.map((unit) => (
                  <option key={unitKey(unit)} value={unitKey(unit)}>
                    {unit.label}
                    {unit.source === 'PERIOD_FALLBACK' ? ' (period fallback)' : ''}
                    {unit.startTime ? ` ${unit.startTime}-${unit.endTime ?? ''}` : ''}
                  </option>
                ))}
              </select>
              {selectedUnit ? (
                <p className="mt-2 text-xs text-slate-500">
                  Unit: {selectedUnit.unitType}
                  {selectedUnit.subjectId ? ` • Subject ${selectedUnit.subjectId}` : ''}
                  {selectedUnit.teacherId ? ` • Teacher ${selectedUnit.teacherId}` : ''}
                </p>
              ) : null}
            </div>
            <Button variant="primary" size="sm" onClick={loadRows} disabled={!canResolve || !selectedUnit || sheetQuery.isFetching} loading={sheetQuery.isFetching}>
              Load Sheet
            </Button>
          </div>

          {resolutionQuery.isError ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage(resolutionQuery.error, 'Unable to resolve attendance configuration.')}</p> : null}
          {!units.length && canResolve && !unitsQuery.isFetching && !unitsQuery.isError ? <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">No attendance units are configured for the selected class, section, and date.</p> : null}
          {unitsQuery.isError ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage(unitsQuery.error, 'Unable to resolve attendance units.')}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Attendance Sheet</h2>
              <p className="text-sm text-slate-500">{rows.length ? `${rows.length} students loaded for ${selectedUnit?.label ?? 'selected unit'}.` : 'Load a sheet to start marking attendance.'}</p>
            </div>
            {isLocked ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Locked</span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.studentId}>
                      <td className="px-4 py-3 font-semibold text-slate-700">{row.admissionNo}</td>
                      <td className="px-4 py-3">{row.rollNo ?? '-'}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {sheetStatuses.map((status) => (
                            <button key={status} type="button" disabled={!canMark || isLocked} onClick={() => setRows((current) => current.map((item) => item.studentId === row.studentId ? { ...item, status } : item))} className={`rounded-full border px-3 py-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${row.status === status ? sheetStatusStyles[status] : 'border-slate-200 bg-white text-slate-500'}`}>
                              {status}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input disabled={!canMark || isLocked} value={row.note} onChange={(event) => setRows((current) => current.map((item) => item.studentId === row.studentId ? { ...item, note: event.target.value } : item))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No sheet loaded.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => sheetQuery.refetch()} disabled={!selectedUnit || sheetQuery.isFetching}>Refresh</Button>
            <Button variant="primary" size="sm" onClick={() => saveMutation.mutate()} disabled={!canMark || isLocked || !rows.length || saveMutation.isPending} loading={saveMutation.isPending}>Save Sheet</Button>
            <Button variant="danger" size="sm" onClick={() => lockMutation.mutate()} disabled={!canLock || isLocked || !(loadedSessionId || sheet?.session?.id) || lockMutation.isPending} loading={lockMutation.isPending}>Lock Sheet</Button>
          </div>
          {role === 'SUPER_ADMIN' ? <p className="mt-3 text-xs text-slate-500">Super Admin can view configuration resolution but cannot mark or lock school attendance.</p> : null}
        </section>
      </div>
    </div>
  );
}

export default function StudentAttendanceMarkPage() {
  const [flow] = useState<'v2' | 'legacy'>('v2');
  if (flow === 'legacy') return <LegacyStudentAttendanceMarkPage onUseV2={() => undefined} />;
  return <StudentAttendanceMarkV2Page />;
}
