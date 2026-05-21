'use client';

import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listAcademicYears } from '../../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';
import {
  getStudentAttendanceReport,
  loadStudentAttendance,
  saveStudentAttendance,
  type AttendanceReportRow,
  type AttendanceStudentRow,
  type StudentAttendanceStatus,
} from '../../../../services/student-operations.service';

const statuses: StudentAttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY'];
const statusLabels: Record<StudentAttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
};

const statusClass: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-700 border-amber-200',
  ABSENT: 'bg-rose-50 text-rose-700 border-rose-200',
  HALF_DAY: 'bg-sky-50 text-sky-700 border-sky-200',
  HOLIDAY: 'bg-violet-50 text-violet-700 border-violet-200',
  UNMARKED: 'bg-slate-50 text-slate-500 border-slate-200',
};

const today = () => new Date().toISOString().slice(0, 10);

const exportCsv = (rows: AttendanceReportRow[]) => {
  const headers = ['Student Name', 'Admission No', 'Present', 'Late', 'Absent', 'Holiday', 'Half Day', 'Percentage'];
  const body = rows.map((row) =>
    [
      row.studentName,
      row.admissionNo,
      row.present,
      row.late,
      row.absent,
      row.holiday,
      row.halfDay,
      `${row.percentage}%`,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[headers.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'student-attendance-report.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const exportExcel = (rows: AttendanceReportRow[]) => {
  const headers = ['Student Name', 'Admission No', 'Present', 'Late', 'Absent', 'Holiday', 'Half Day', 'Percentage'];
  const body = rows
    .map((row) =>
      `<tr><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.admissionNo)}</td><td>${row.present}</td><td>${row.late}</td><td>${row.absent}</td><td>${row.holiday}</td><td>${row.halfDay}</td><td>${row.percentage}%</td></tr>`,
    )
    .join('');
  const html = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'student-attendance-report.xls';
  anchor.click();
  URL.revokeObjectURL(url);
};

const ShellButton = ({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) => {
  const cls =
    variant === 'primary'
      ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)] shadow-sm'
      : variant === 'danger'
        ? 'border border-rose-200 bg-rose-50 text-rose-700'
        : 'border border-slate-200 bg-white text-slate-700';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
};

export default function StudentAttendancePage() {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  const [criteria, setCriteria] = useState({
    academicSessionId: '',
    classId: '',
    sectionId: '',
    date: today(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [rows, setRows] = useState<AttendanceStudentRow[]>([]);
  const [holiday, setHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: isSchoolAdmin });
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: isSchoolAdmin });

  const sections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter((section) =>
        criteria.classId ? section.classSections?.some((link) => link.classId === criteria.classId) || section.classId === criteria.classId : true,
      ),
    [criteria.classId, sectionsQuery.data],
  );

  const canSearch = Boolean(criteria.academicSessionId && criteria.classId && criteria.sectionId);

  const attendanceQuery = useQuery({
    queryKey: ['student-attendance-load', criteria.academicSessionId, criteria.classId, criteria.sectionId, criteria.date],
    queryFn: () =>
      loadStudentAttendance({
        academicSessionId: criteria.academicSessionId,
        classId: criteria.classId,
        sectionId: criteria.sectionId,
        date: criteria.date,
      }),
    enabled: false,
  });

  const reportQuery = useQuery({
    queryKey: ['student-attendance-report', criteria.academicSessionId, criteria.classId, criteria.sectionId, criteria.month, criteria.year],
    queryFn: () =>
      getStudentAttendanceReport({
        academicSessionId: criteria.academicSessionId,
        classId: criteria.classId,
        sectionId: criteria.sectionId,
        month: criteria.month,
        year: criteria.year,
      }),
    enabled: false,
  });

  const loadRows = async () => {
    if (!canSearch) {
      notify.warning('Select criteria', 'Session, class, and section are required.');
      return;
    }
    const data = await attendanceQuery.refetch();
    if (data.data) {
      setRows(data.data.students);
      setHoliday(Boolean(data.data.holiday));
      setHolidayReason(data.data.holiday?.reason ?? '');
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveStudentAttendance({
        academicSessionId: criteria.academicSessionId,
        classId: criteria.classId,
        sectionId: criteria.sectionId,
        date: criteria.date,
        markHoliday: holiday,
        holidayReason,
        records: rows.map((row) => ({ studentId: row.id, status: row.status, note: row.note ?? '' })),
      }),
    onSuccess: () => notify.success('Attendance saved', holiday ? 'Holiday has been marked.' : 'Student attendance was saved.'),
    onError: (error: any) => notify.error('Unable to save attendance', error?.response?.data?.error?.message ?? 'Please try again.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking attendance access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="student attendance" />;

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Attendance"
          subtitle="Mark class-section attendance and inspect monthly attendance reports."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Attendance' }]}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          <ShellButton variant={activeTab === 'mark' ? 'primary' : 'secondary'} onClick={() => setActiveTab('mark')}>Mark Attendance</ShellButton>
          <ShellButton variant={activeTab === 'report' ? 'primary' : 'secondary'} onClick={() => setActiveTab('report')}>Attendance Report</ShellButton>
          <ShellButton variant="secondary" onClick={() => activeTab === 'report' && reportQuery.data ? exportCsv(reportQuery.data.rows) : window.print()}>Export / Print</ShellButton>
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <p className="text-sm text-slate-500">Choose session, class, section, and date or month.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <select value={criteria.academicSessionId} onChange={(event) => setCriteria({ ...criteria, academicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select Session</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={criteria.classId} onChange={(event) => setCriteria({ ...criteria, classId: event.target.value, sectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select Class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={criteria.sectionId} onChange={(event) => setCriteria({ ...criteria, sectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Select Section</option>
              {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {activeTab === 'mark' ? (
              <input type="date" value={criteria.date} onChange={(event) => setCriteria({ ...criteria, date: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            ) : (
              <>
                <select value={criteria.month} onChange={(event) => setCriteria({ ...criteria, month: Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {Array.from({ length: 12 }).map((_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' })}</option>)}
                </select>
                <input type="number" value={criteria.year} onChange={(event) => setCriteria({ ...criteria, year: Number(event.target.value) })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            {activeTab === 'mark' ? (
              <ShellButton onClick={loadRows} disabled={attendanceQuery.isFetching}>Load Students</ShellButton>
            ) : (
              <ShellButton onClick={() => reportQuery.refetch()} disabled={!canSearch || reportQuery.isFetching}>Search Report</ShellButton>
            )}
          </div>
        </section>

        {activeTab === 'mark' ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Mark Attendance</h2>
                <p className="text-sm text-slate-500">{rows.length ? `${rows.length} students loaded.` : 'Load students to start marking attendance.'}</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700">
                <input type="checkbox" checked={holiday} onChange={(event) => setHoliday(event.target.checked)} />
                Mark Holiday
              </label>
            </div>
            {holiday ? (
              <input value={holidayReason} onChange={(event) => setHolidayReason(event.target.value)} placeholder="Holiday note" className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Admission No</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceQuery.isFetching ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-3 rounded bg-slate-200" /></td>
                        <td className="px-4 py-4"><div className="h-3 rounded bg-slate-200" /></td>
                        <td className="px-4 py-4"><div className="h-3 rounded bg-slate-200" /></td>
                        <td className="px-4 py-4"><div className="h-3 rounded bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.admissionNo}</td>
                        <td className="px-4 py-3">{row.fullName || `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {statuses.map((status) => (
                              <button
                                type="button"
                                key={status}
                                disabled={holiday}
                                onClick={() => setRows((current) => current.map((item) => item.id === row.id ? { ...item, status } : item))}
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${row.status === status ? statusClass[status] : 'border-slate-200 bg-white text-slate-500'}`}
                              >
                                {statusLabels[status]}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input disabled={holiday} value={row.note ?? ''} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, note: event.target.value } : item))} className="w-full rounded-lg border border-slate-200 px-3 py-2" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-500">No students loaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <ShellButton onClick={() => saveMutation.mutate()} disabled={!rows.length && !holiday}>Save Attendance</ShellButton>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Monthly Attendance Report</h2>
                <p className="text-sm text-slate-500">Expand a row to inspect day-wise status.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShellButton variant="secondary" onClick={() => reportQuery.data && exportCsv(reportQuery.data.rows)}>Export CSV</ShellButton>
                <ShellButton variant="secondary" onClick={() => reportQuery.data && exportExcel(reportQuery.data.rows)}>Export Excel</ShellButton>
                <ShellButton variant="secondary" onClick={() => window.print()}>Print</ShellButton>
              </div>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Admission No</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Absent</th>
                    <th className="px-4 py-3">Holiday</th>
                    <th className="px-4 py-3">Half Day</th>
                    <th className="px-4 py-3">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportQuery.isFetching ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading report...</td></tr>
                  ) : reportQuery.data?.rows.length ? (
                    reportQuery.data.rows.map((row) => (
                      <Fragment key={row.studentId}>
                        <tr key={row.studentId}>
                          <td className="px-4 py-3"><button className="rounded-full border px-2 py-1 font-bold" onClick={() => setExpanded(expanded === row.studentId ? null : row.studentId)}>+</button></td>
                          <td className="px-4 py-3 font-semibold">{row.studentName}</td>
                          <td className="px-4 py-3">{row.admissionNo}</td>
                          <td className="px-4 py-3">{row.present}</td>
                          <td className="px-4 py-3">{row.late}</td>
                          <td className="px-4 py-3">{row.absent}</td>
                          <td className="px-4 py-3">{row.holiday}</td>
                          <td className="px-4 py-3">{row.halfDay}</td>
                          <td className="px-4 py-3 font-bold">{row.percentage}%</td>
                        </tr>
                        {expanded === row.studentId ? (
                          <tr>
                            <td colSpan={9} className="bg-slate-50 px-4 py-4">
                              <div className="grid grid-cols-7 gap-2">
                                {row.daily.map((day) => (
                                  <span key={day.day} className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusClass[day.status] ?? statusClass.UNMARKED}`}>
                                    {day.day}: {day.status.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))
                  ) : (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No attendance report found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
