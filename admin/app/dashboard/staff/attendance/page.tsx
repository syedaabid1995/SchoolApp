'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import {
  getStaffAttendanceReport,
  listStaff,
  loadStaffAttendance,
  saveStaffAttendance,
  type AttendanceStaffRow,
  type StaffAttendanceReportRow,
  type StaffAttendanceStatus,
} from '../../../../services/staff.service';

const roles = ['SCHOOL_ADMIN', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'STAFF'];
const statuses: StaffAttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'HOLIDAY', 'HALF_DAY', 'LEAVE'];

const statusLabels: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HOLIDAY: 'Holiday',
  HALF_DAY: 'Half Day',
  LEAVE: 'Leave',
  UNMARKED: 'Unmarked',
};

const statusClass: Record<string, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LATE: 'bg-amber-50 text-amber-700 border-amber-200',
  ABSENT: 'bg-rose-50 text-rose-700 border-rose-200',
  HOLIDAY: 'bg-violet-50 text-violet-700 border-violet-200',
  HALF_DAY: 'bg-sky-50 text-sky-700 border-sky-200',
  LEAVE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  UNMARKED: 'bg-slate-50 text-slate-500 border-slate-200',
};

const today = () => new Date().toISOString().slice(0, 10);

const staffName = (row: AttendanceStaffRow | StaffAttendanceReportRow['staff']) => row.fullName ?? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();

const exportCsv = (rows: StaffAttendanceReportRow[]) => {
  const headers = ['Staff name', 'Staff no', 'Present', 'Late', 'Absent', 'Holiday', 'Half day', 'Leave', 'Percentage'];
  const body = rows.map((row) => [staffName(row.staff), row.staff.employeeNo ?? row.staff.staffNo ?? '', row.present, row.late, row.absent, row.holiday, row.halfDay, row.leave, `${row.percentage}%`]);
  const csv = [headers, ...body].map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'staff-attendance-report.csv';
  anchor.click();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const exportExcel = (rows: StaffAttendanceReportRow[]) => {
  const headers = ['Staff name', 'Staff no', 'Present', 'Late', 'Absent', 'Holiday', 'Half day', 'Leave', 'Percentage'];
  const body = rows
    .map((row) => `<tr><td>${escapeHtml(staffName(row.staff))}</td><td>${escapeHtml(row.staff.employeeNo ?? row.staff.staffNo ?? '')}</td><td>${row.present}</td><td>${row.late}</td><td>${row.absent}</td><td>${row.holiday}</td><td>${row.halfDay}</td><td>${row.leave}</td><td>${row.percentage}%</td></tr>`)
    .join('');
  const html = `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'staff-attendance-report.xls';
  anchor.click();
  URL.revokeObjectURL(url);
};

const ShellButton = ({ children, onClick, disabled, active }: { children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm disabled:opacity-50 ${active ? 'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)]' : 'border border-slate-200 bg-white text-slate-700'}`}
  >
    {children}
  </button>
);

export default function StaffAttendancePage() {
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<'mark' | 'report'>('mark');
  const [criteria, setCriteria] = useState({
    role: '',
    staffId: '',
    date: today(),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [rows, setRows] = useState<AttendanceStaffRow[]>([]);
  const [holiday, setHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const hasPermission = (code: string) => isSchoolAdmin || permissionCodes.includes(code);
  const canViewAttendance = hasPermission('staff.attendance.view') || hasPermission('staff.attendance.report') || hasPermission('staff.attendance.create') || hasPermission('staff.attendance.edit');
  const canMarkAttendance = hasPermission('staff.attendance.create') || hasPermission('staff.attendance.edit');
  const canViewReport = hasPermission('staff.attendance.report') || hasPermission('staff.attendance.view');
  const staffQuery = useQuery({ queryKey: ['staff-options', criteria.role], queryFn: () => listStaff({ limit: 100, role: criteria.role || undefined }), enabled: canViewAttendance });

  const attendanceQuery = useQuery({
    queryKey: ['staff-attendance', criteria.role, criteria.staffId, criteria.date],
    queryFn: () => loadStaffAttendance({ role: criteria.role || undefined, staffId: criteria.staffId || undefined, date: criteria.date }),
    enabled: false,
  });

  const reportQuery = useQuery({
    queryKey: ['staff-attendance-report', criteria.role, criteria.staffId, criteria.month, criteria.year],
    queryFn: () => getStaffAttendanceReport({ role: criteria.role || undefined, staffId: criteria.staffId || undefined, month: criteria.month, year: criteria.year }),
    enabled: false,
  });

  const staffOptions = useMemo(() => staffQuery.data?.items ?? [], [staffQuery.data]);

  const loadRows = async () => {
    const data = await attendanceQuery.refetch();
    if (data.data) {
      setRows(data.data.staff);
      setHoliday(Boolean(data.data.holiday));
      setHolidayReason((data.data.holiday as any)?.reason ?? '');
    }
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveStaffAttendance({
        role: criteria.role || null,
        date: criteria.date,
        markHoliday: holiday,
        holidayReason,
        records: rows.map((row) => ({ staffId: row.id, status: row.status, note: row.note ?? '' })),
      }),
    onSuccess: () => notify.success('Attendance saved', holiday ? 'Holiday was marked for the selected staff group.' : 'Staff attendance was saved.'),
    onError: (error: any) => notify.error('Unable to save attendance', error?.response?.data?.error?.message ?? 'Please try again.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking attendance access..." />;
  if (!canViewAttendance) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Staff attendance is not enabled for your role. Ask a School Admin to update Role Permissions.
      </section>
    );
  }
  const visibleTab = canMarkAttendance ? activeTab : 'report';

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Staff Attendance"
          subtitle="Mark staff attendance and inspect monthly attendance reports."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Staff', href: '/dashboard/staff' }, { label: 'Attendance' }]}
          actions={<ShellButton onClick={() => visibleTab === 'report' && reportQuery.data ? exportCsv(reportQuery.data.rows) : window.print()}>Export / Print</ShellButton>}
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {canMarkAttendance ? <ShellButton active={visibleTab === 'mark'} onClick={() => setActiveTab('mark')}>Mark Attendance</ShellButton> : null}
          {canViewReport ? <ShellButton active={visibleTab === 'report'} onClick={() => setActiveTab('report')}>Attendance Report</ShellButton> : null}
        </div>

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <p className="text-sm text-slate-500">Search by role or specific staff member and date/month.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <select value={criteria.role} onChange={(event) => setCriteria({ ...criteria, role: event.target.value, staffId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Roles</option>
              {roles.map((role) => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
            </select>
            <select value={criteria.staffId} onChange={(event) => setCriteria({ ...criteria, staffId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">All Staff</option>
              {staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staffName(staff)} ({staff.employeeNo ?? '-'})</option>)}
            </select>
            {visibleTab === 'mark' ? (
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
          <div className="mt-4 flex flex-wrap gap-2">
            {visibleTab === 'mark' ? (
              <ShellButton active onClick={loadRows} disabled={attendanceQuery.isFetching}>Load Staff</ShellButton>
            ) : (
              <>
                <ShellButton active onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>Search Report</ShellButton>
                {reportQuery.data ? <ShellButton onClick={() => exportExcel(reportQuery.data.rows)}>Excel</ShellButton> : null}
              </>
            )}
          </div>
        </section>

        {visibleTab === 'mark' && canMarkAttendance ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Mark Attendance</h2>
                <p className="text-sm text-slate-500">{rows.length ? `${rows.length} staff loaded` : 'Load staff to mark attendance.'}</p>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                <input type="checkbox" checked={holiday} onChange={(event) => setHoliday(event.target.checked)} disabled={!canMarkAttendance} />
                Mark Holiday
              </label>
            </div>
            {holiday ? (
              <input value={holidayReason} onChange={(event) => setHolidayReason(event.target.value)} placeholder="Holiday reason" className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            ) : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Staff No</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceQuery.isFetching ? (
                    Array.from({ length: 6 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={5} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                  ) : rows.length ? (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold">{staffName(row)}</td>
                        <td className="px-4 py-3">{row.employeeNo ?? row.staffNo ?? '-'}</td>
                        <td className="px-4 py-3">{String(row.role ?? row.roleName ?? '').replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <select disabled={holiday || !canMarkAttendance} value={row.status} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: event.target.value as StaffAttendanceStatus } : item))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                            {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input disabled={holiday || !canMarkAttendance} value={row.note ?? ''} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, note: event.target.value } : item))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50" />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No staff loaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <ShellButton active onClick={() => saveMutation.mutate()} disabled={!canMarkAttendance || saveMutation.isPending || (!holiday && !rows.length)}>Save Attendance</ShellButton>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">Monthly Report</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{reportQuery.data?.rows.length ?? 0} records</span>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3">Staff name</th>
                    <th className="px-4 py-3">Staff no</th>
                    <th className="px-4 py-3">Present</th>
                    <th className="px-4 py-3">Late</th>
                    <th className="px-4 py-3">Absent</th>
                    <th className="px-4 py-3">Holiday</th>
                    <th className="px-4 py-3">Half/Leave</th>
                    <th className="px-4 py-3">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportQuery.isFetching ? (
                    Array.from({ length: 6 }).map((_, index) => <tr key={index} className="animate-pulse"><td colSpan={9} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td></tr>)
                  ) : reportQuery.data?.rows.length ? (
                    reportQuery.data.rows.map((row) => (
                      <Fragment key={row.staff.id}>
                        <tr>
                          <td className="px-4 py-3"><button onClick={() => setExpanded(expanded === row.staff.id ? null : row.staff.id)} className="rounded border px-2 font-bold">+</button></td>
                          <td className="px-4 py-3 font-semibold">{staffName(row.staff)}</td>
                          <td className="px-4 py-3">{row.staff.employeeNo ?? row.staff.staffNo ?? '-'}</td>
                          <td className="px-4 py-3">{row.present}</td>
                          <td className="px-4 py-3">{row.late}</td>
                          <td className="px-4 py-3">{row.absent}</td>
                          <td className="px-4 py-3">{row.holiday}</td>
                          <td className="px-4 py-3">{row.halfDay + row.leave}</td>
                          <td className="px-4 py-3 font-bold">{row.percentage}%</td>
                        </tr>
                        {expanded === row.staff.id ? (
                          <tr>
                            <td colSpan={9} className="bg-slate-50 px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                {row.daily.map((day) => (
                                  <span key={day.day} title={day.note ?? ''} className={`rounded-lg border px-2 py-1 text-xs font-bold ${statusClass[day.status] ?? statusClass.UNMARKED}`}>
                                    {day.day}: {statusLabels[day.status] ?? day.status}
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
