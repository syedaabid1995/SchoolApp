'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../../components/PageHeader';
import Button from '../../../../components/Button';
import { getSession } from '../../../../services/auth.service';
import { listSchools } from '../../../../services/school.service';
import {
  createAttendancePeriodForAcademics,
  createTimetableVersion,
  deleteAttendancePeriodForAcademics,
  getAttendanceMode,
  listAttendancePeriodsForAcademics,
  listAcademicYears,
  listClasses,
  listSections,
  listSubjects,
  listTimetableEntries,
  listTimetableTeachers,
  listTimetableVersions,
  publishTimetableVersion,
  updateAttendanceMode,
  upsertTimetableEntries,
  getTeacherTimetable,
  type AttendanceMode,
} from '../../../../services/academic.service';

const weekDays: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function TimetableManagementPage() {
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [message, setMessage] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [mode, setMode] = useState<AttendanceMode>('DAILY');
  const [versionForm, setVersionForm] = useState({
    academicYearId: '',
    name: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });
  const [entryForm, setEntryForm] = useState({
    classId: '',
    sectionId: '',
    attendancePeriodId: '',
    dayOfWeek: 1,
    subjectId: '',
    teacherId: '',
    room: '',
  });
  const [periodForm, setPeriodForm] = useState({
    name: '',
    startTime: '',
    endTime: '',
    lateThresholdMinutes: 0,
    earlyThresholdMinutes: 0,
  });

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isTeacher = session?.role === 'TEACHER';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: years } = useQuery({
    queryKey: ['academic-years', effectiveSchoolId],
    queryFn: () => listAcademicYears({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => listClasses({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', effectiveSchoolId],
    queryFn: () => listSections({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => listSubjects({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: teachers } = useQuery({
    queryKey: ['timetable-teachers', effectiveSchoolId],
    queryFn: () => listTimetableTeachers({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: periods } = useQuery({
    queryKey: ['attendance-periods', effectiveSchoolId],
    queryFn: () => listAttendancePeriodsForAcademics({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: modeData } = useQuery({
    queryKey: ['attendance-mode', effectiveSchoolId],
    queryFn: () => getAttendanceMode({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: versions } = useQuery({
    queryKey: ['timetable-versions', effectiveSchoolId],
    queryFn: () => listTimetableVersions({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: entries } = useQuery({
    queryKey: ['timetable-entries', effectiveSchoolId, selectedVersionId],
    queryFn: () =>
      listTimetableEntries({
        schoolId: effectiveSchoolId,
        timetableVersionId: selectedVersionId,
      }),
    enabled: Boolean(effectiveSchoolId && selectedVersionId),
  });

  const { data: teacherSchedule } = useQuery({
    queryKey: ['teacher-timetable', effectiveSchoolId, session?.role],
    queryFn: () => getTeacherTimetable({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId && isTeacher),
  });

  useEffect(() => {
    if (modeData?.mode) setMode(modeData.mode);
  }, [modeData?.mode]);

  const sectionOptions = useMemo(() => {
    if (!entryForm.classId) return [];
    return (sections ?? []).filter((section: { classId: string }) => section.classId === entryForm.classId);
  }, [sections, entryForm.classId]);
  const sectionRequired = sectionOptions.length > 0;

  const saveModeMutation = useMutation({
    mutationFn: () => updateAttendanceMode({ mode, schoolId: effectiveSchoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-mode', effectiveSchoolId] });
      setMessage('Attendance mode updated successfully.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to update attendance mode'),
  });

  const createVersionMutation = useMutation({
    mutationFn: () =>
      createTimetableVersion({
        schoolId: effectiveSchoolId,
        academicYearId: versionForm.academicYearId,
        name: versionForm.name,
        effectiveFrom: versionForm.effectiveFrom,
        effectiveTo: versionForm.effectiveTo || null,
      }),
    onSuccess: (data) => {
      setSelectedVersionId(data.id);
      setVersionForm((prev) => ({ ...prev, name: '' }));
      queryClient.invalidateQueries({ queryKey: ['timetable-versions', effectiveSchoolId] });
      setMessage('Timetable version created.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to create timetable version'),
  });

  const createPeriodMutation = useMutation({
    mutationFn: () =>
      createAttendancePeriodForAcademics({
        schoolId: effectiveSchoolId,
        name: periodForm.name,
        startTime: periodForm.startTime,
        endTime: periodForm.endTime,
        lateThresholdMinutes: Number(periodForm.lateThresholdMinutes || 0),
        earlyThresholdMinutes: Number(periodForm.earlyThresholdMinutes || 0),
      }),
    onSuccess: () => {
      setPeriodForm({
        name: '',
        startTime: '',
        endTime: '',
        lateThresholdMinutes: 0,
        earlyThresholdMinutes: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['attendance-periods', effectiveSchoolId] });
      setMessage('Attendance period created.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to create attendance period'),
  });

  const deletePeriodMutation = useMutation({
    mutationFn: (id: string) => deleteAttendancePeriodForAcademics(id, { schoolId: effectiveSchoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-periods', effectiveSchoolId] });
      setMessage('Attendance period deleted.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to delete attendance period'),
  });

  const addEntryMutation = useMutation({
    mutationFn: () =>
      upsertTimetableEntries({
        schoolId: effectiveSchoolId,
        timetableVersionId: selectedVersionId,
        entries: [
          {
            classId: entryForm.classId,
            sectionId: sectionRequired ? entryForm.sectionId || null : null,
            attendancePeriodId: entryForm.attendancePeriodId,
            dayOfWeek: entryForm.dayOfWeek,
            subjectId: entryForm.subjectId,
            teacherId: entryForm.teacherId,
            room: entryForm.room || null,
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-entries', effectiveSchoolId, selectedVersionId] });
      setMessage('Timetable entry saved.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to save timetable entry'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishTimetableVersion(id, { schoolId: effectiveSchoolId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-versions', effectiveSchoolId] });
      setMessage('Timetable published.');
    },
    onError: (err: any) => setMessage(err?.response?.data?.error?.message ?? 'Failed to publish timetable'),
  });

  const requireSchool = isSuperAdmin && !effectiveSchoolId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12 space-y-6">
        <PageHeader
          title="Timetable & Attendance Mode"
          subtitle="Configure school attendance mode and manage class-wise weekly timetable."
        />

        {isSuperAdmin ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <label className="mb-2 block text-sm font-semibold text-gray-700">School</label>
            <select
              value={schoolId}
              onChange={(event) => setSchoolId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select school...</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {requireSchool ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Select a school to continue.
          </div>
        ) : null}

        {!requireSchool ? (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Attendance Mode</h2>
                  <p className="text-sm text-gray-500">This mode drives attendance entry and reporting flow.</p>
                </div>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Mode</label>
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value as AttendanceMode)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="DAILY">Daily (Full Day)</option>
                      <option value="PERIOD_WISE">Period-wise</option>
                      <option value="SHIFT_WISE">Shift-wise</option>
                    </select>
                  </div>
                  <Button variant="primary" size="sm" loading={saveModeMutation.isPending} onClick={() => saveModeMutation.mutate()}>
                    Save
                  </Button>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Active source: {modeData?.source ?? 'DEFAULT'} {modeData?.updatedAt ? `• Updated ${new Date(modeData.updatedAt).toLocaleString()}` : ''}
              </p>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Attendance Periods</h2>
                <p className="text-sm text-gray-500">Required for period-wise timetable and attendance.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Period Name</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Period name"
                    value={periodForm.name}
                    onChange={(event) => setPeriodForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Start Time</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={periodForm.startTime}
                    onChange={(event) => setPeriodForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">End Time</label>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={periodForm.endTime}
                    onChange={(event) => setPeriodForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Late Threshold</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Late (min)"
                    value={periodForm.lateThresholdMinutes}
                    onChange={(event) =>
                      setPeriodForm((prev) => ({ ...prev, lateThresholdMinutes: Number(event.target.value || 0) }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Early Threshold</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Early (min)"
                    value={periodForm.earlyThresholdMinutes}
                    onChange={(event) =>
                      setPeriodForm((prev) => ({ ...prev, earlyThresholdMinutes: Number(event.target.value || 0) }))
                    }
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={createPeriodMutation.isPending}
                  disabled={!periodForm.name.trim() || !periodForm.startTime || !periodForm.endTime}
                  onClick={() => createPeriodMutation.mutate()}
                >
                  Add Period
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Start</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">End</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Late</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Early</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(periods ?? []).map((period: any) => (
                      <tr key={period.id}>
                        <td className="px-4 py-3 text-sm text-gray-700">{period.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{period.startTime}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{period.endTime}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{period.lateThresholdMinutes ?? 0} min</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{period.earlyThresholdMinutes ?? 0} min</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            loading={deletePeriodMutation.isPending}
                            onClick={() => deletePeriodMutation.mutate(period.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!periods?.length ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                          No periods yet. Create one above.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Timetable Versions</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Academic Year</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={versionForm.academicYearId}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, academicYearId: event.target.value }))}
                  >
                    <option value="">Academic year</option>
                    {(years ?? []).map((year: { id: string; name: string }) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Version Name</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Version name"
                    value={versionForm.name}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Effective From</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={versionForm.effectiveFrom}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Effective To</label>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    value={versionForm.effectiveTo}
                    onChange={(event) => setVersionForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  loading={createVersionMutation.isPending}
                  disabled={!versionForm.academicYearId || !versionForm.name.trim() || !versionForm.effectiveFrom}
                  onClick={() => createVersionMutation.mutate()}
                >
                  Create Version
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Version</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Year</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Entries</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(versions ?? []).map((version) => (
                      <tr key={version.id} className={selectedVersionId === version.id ? 'bg-blue-50' : ''}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{version.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{version.academicYear?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{version.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{version._count?.entries ?? 0}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedVersionId(version.id)}>
                              Manage
                            </Button>
                            {version.status === 'DRAFT' ? (
                              <Button variant="primary" size="sm" loading={publishMutation.isPending} onClick={() => publishMutation.mutate(version.id)}>
                                Publish
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!versions?.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                          No timetable versions available.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedVersionId ? (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Add Timetable Entry</h2>
                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Class</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.classId}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, classId: event.target.value, sectionId: '' }))}
                    >
                      <option value="">Class</option>
                      {(classes ?? []).map((item: { id: string; name: string }) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Section</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.sectionId}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, sectionId: event.target.value }))}
                      disabled={!entryForm.classId || !sectionRequired}
                    >
                      <option value="">{sectionRequired ? 'Section' : 'No section required'}</option>
                      {sectionOptions.map((item: { id: string; name: string }) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Period</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.attendancePeriodId}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, attendancePeriodId: event.target.value }))}
                    >
                      <option value="">Period</option>
                      {(periods ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.startTime}-{item.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Day</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.dayOfWeek}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, dayOfWeek: Number(event.target.value) }))}
                    >
                      {weekDays.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Subject</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.subjectId}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, subjectId: event.target.value }))}
                    >
                      <option value="">Subject</option>
                      {(subjects ?? []).map((item: { id: string; name: string }) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Teacher</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={entryForm.teacherId}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, teacherId: event.target.value }))}
                    >
                      <option value="">Teacher</option>
                      {(teachers ?? []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.firstName} {item.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Room</label>
                    <input
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Room (optional)"
                      value={entryForm.room}
                      onChange={(event) => setEntryForm((prev) => ({ ...prev, room: event.target.value }))}
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={addEntryMutation.isPending}
                    disabled={
                      !entryForm.classId ||
                      (sectionRequired && !entryForm.sectionId) ||
                      !entryForm.attendancePeriodId ||
                      !entryForm.subjectId ||
                      !entryForm.teacherId
                    }
                    onClick={() => addEntryMutation.mutate()}
                  >
                    Save Entry
                  </Button>
                </div>
                {!periods?.length ? (
                  <p className="text-xs text-amber-700">
                    No attendance periods configured for this school. Create periods first to add timetable entries.
                  </p>
                ) : null}

                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Day</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Class</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Subject</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Teacher</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Room</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {(entries ?? []).map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-700">{weekDays.find((day) => day.value === item.dayOfWeek)?.label ?? item.dayOfWeek}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.period?.name} ({item.period?.startTime}-{item.period?.endTime})
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.class?.name} {item.section?.name ? `• ${item.section.name}` : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.subject?.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {item.teacher?.firstName} {item.teacher?.lastName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.room ?? '—'}</td>
                        </tr>
                      ))}
                      {!entries?.length ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                            No entries in this version.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {isTeacher ? (
              <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">My Schedule Today</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {teacherSchedule?.version ? `Version: ${teacherSchedule.version.name}` : 'No published timetable found for today.'}
                </p>
                <div className="mt-4 space-y-2">
                  {(teacherSchedule?.periods ?? []).map((period) => (
                    <div key={period.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-semibold text-slate-900">
                        {period.period.name} ({period.period.startTime}-{period.period.endTime})
                      </p>
                      <p className="text-slate-600">
                        {period.subject.name} • {period.class.name}
                        {period.section?.name ? `-${period.section.name}` : ''}
                        {period.room ? ` • Room ${period.room}` : ''}
                      </p>
                    </div>
                  ))}
                  {!teacherSchedule?.periods?.length ? (
                    <p className="text-sm text-slate-500">No periods assigned for today.</p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {message ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
