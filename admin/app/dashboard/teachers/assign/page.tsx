'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSession } from '../../../../services/auth.service';
import { listSchools } from '../../../../services/school.service';
import { listAcademicYears, listClasses, listSections, listSubjects } from '../../../../services/academic.service';
import {
  assignClass,
  assignSubject,
  listTeachers,
  unassignClass,
  unassignSubject,
} from '../../../../services/teacher.service';
import {
  createAttendanceSubstitution,
  listAttendanceSubstitutions,
  cancelAttendanceSubstitution,
} from '../../../../services/attendanceSubstitution.service';
import PageHeader from '../../../../components/PageHeader';
import DashboardPageContainer from '../../../../components/DashboardPageContainer';
import Button from '../../../../components/Button';

export default function AssignTeacherPage() {
  const queryClient = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [substitutionForm, setSubstitutionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    academicYearId: '',
    classId: '',
    sectionId: '',
    originalTeacherId: '',
    substituteTeacherId: '',
    reason: '',
  });

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const effectiveSchoolId = isSuperAdmin ? schoolId : session?.schoolId ?? undefined;

  const { data: schools } = useQuery({
    queryKey: ['schools', 'all'],
    queryFn: () => listSchools({ limit: 100 }),
    enabled: isSuperAdmin,
  });

  const { data: teachers } = useQuery({
    queryKey: ['teachers', effectiveSchoolId],
    queryFn: () => listTeachers({ limit: 100, schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: academicYears } = useQuery({
    queryKey: ['academic-years', effectiveSchoolId],
    queryFn: () => listAcademicYears({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: classes } = useQuery({
    queryKey: ['classes', effectiveSchoolId],
    queryFn: () => listClasses({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => listSubjects({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const { data: sections } = useQuery({
    queryKey: ['sections', effectiveSchoolId],
    queryFn: () => listSections({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const availableSections = useMemo(() => {
    if (!classId) return [];
    return (sections ?? []).filter((section: any) => section.classId === classId);
  }, [sections, classId]);

  const sectionRequired = Boolean(classId) && availableSections.length > 0;

  const substitutionSections = useMemo(() => {
    if (!substitutionForm.classId) return [];
    return (sections ?? []).filter((section: any) => section.classId === substitutionForm.classId);
  }, [sections, substitutionForm.classId]);

  const substitutionSectionRequired = Boolean(substitutionForm.classId) && substitutionSections.length > 0;

  const { data: substitutions } = useQuery({
    queryKey: ['attendance-substitutions', effectiveSchoolId, substitutionForm.date],
    queryFn: () =>
      listAttendanceSubstitutions({
        schoolId: effectiveSchoolId,
        date: substitutionForm.date,
      }),
    enabled: Boolean(effectiveSchoolId && substitutionForm.date),
  });

  const selectedTeacher = useMemo(() => {
    return teachers?.items.find((teacher) => teacher.id === teacherId);
  }, [teachers, teacherId]);

  const assignClassMutation = useMutation({
    mutationFn: assignClass,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const unassignClassMutation = useMutation({
    mutationFn: unassignClass,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const assignSubjectMutation = useMutation({
    mutationFn: assignSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const unassignSubjectMutation = useMutation({
    mutationFn: unassignSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const createSubstitutionMutation = useMutation({
    mutationFn: createAttendanceSubstitution,
    onSuccess: () => {
      setSubstitutionForm((prev) => ({
        ...prev,
        classId: '',
        sectionId: '',
        originalTeacherId: '',
        substituteTeacherId: '',
        reason: '',
      }));
      queryClient.invalidateQueries({ queryKey: ['attendance-substitutions'] });
    },
  });

  const cancelSubstitutionMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => cancelAttendanceSubstitution(id, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance-substitutions'] }),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/40">
      <DashboardPageContainer maxWidthClassName="max-w-7xl">
        <PageHeader
          title="Assign Teachers"
          subtitle="Assign classes and subjects to teachers. This controls who can submit attendance and marks."
        />
        <div className="mx-auto mt-8 max-w-6xl rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-slate-200">

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {isSuperAdmin && (
              <div className="md:col-span-1">
                <label className="text-xs font-semibold text-slate-600">School</label>
                <select
                  value={schoolId}
                  onChange={(e) => {
                    setSchoolId(e.target.value);
                    setTeacherId('');
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">Select school</option>
                  {schools?.items.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} ({school.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={isSuperAdmin ? 'md:col-span-2' : 'md:col-span-3'}>
              <label className="text-xs font-semibold text-slate-600">Teacher</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                disabled={!effectiveSchoolId}
              >
                <option value="">Select teacher</option>
                {teachers?.items.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName} · {teacher.user.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

      

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Class Assignments</h2>
              <p className="text-xs text-slate-500">Assign classes for attendance submission.</p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId('');
                  }}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  disabled={!teacherId}
                >
                  <option value="">Select class</option>
                  {(classes ?? []).map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  disabled={!teacherId || !sectionRequired}
                >
                  <option value="">{sectionRequired ? 'Select section' : 'No sections'}</option>
                  {availableSections.map((section: any) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!teacherId || !classId) return;
                    if (sectionRequired && !sectionId) return;
                    assignClassMutation.mutate({ teacherId, classId, sectionId: sectionId || undefined });
                    setClassId('');
                    setSectionId('');
                  }}
                >
                  Assign
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {(selectedTeacher?.classAssignments ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                    No classes assigned yet.
                  </div>
                ) : (
                  selectedTeacher?.classAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2"
                    >
                      <span className="text-sm text-slate-700">
                        {assignment.class.name}
                        {assignment.section?.name ? ` · ${assignment.section.name}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          unassignClassMutation.mutate({
                            teacherId,
                            classId: assignment.class.id,
                            sectionId: assignment.section?.id,
                          })
                        }
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Subject Assignments</h2>
              <p className="text-xs text-slate-500">Assign subjects for marks entry.</p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  disabled={!teacherId}
                >
                  <option value="">Select subject</option>
                  {(subjects ?? []).map((subject: any) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!teacherId || !subjectId) return;
                    assignSubjectMutation.mutate({ teacherId, subjectId });
                    setSubjectId('');
                  }}
                >
                  Assign
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {(selectedTeacher?.subjectAssignments ?? []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
                    No subjects assigned yet.
                  </div>
                ) : (
                  selectedTeacher?.subjectAssignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2"
                    >
                      <span className="text-sm text-slate-700">{assignment.subject.name}</span>
                      <button
                        type="button"
                        onClick={() => unassignSubjectMutation.mutate({ teacherId, subjectId: assignment.subject.id })}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Temporary Teacher Reassignment</h2>
                <p className="text-sm text-slate-500">Assign a substitute teacher for a single day without changing permanent assignments.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Date-specific override
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-6">
              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Date</label>
                <input
                  type="date"
                  value={substitutionForm.date}
                  onChange={(e) => setSubstitutionForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Academic Year</label>
                <select
                  value={substitutionForm.academicYearId}
                  onChange={(e) =>
                    setSubstitutionForm((prev) => ({
                      ...prev,
                      academicYearId: e.target.value,
                      classId: '',
                      sectionId: '',
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">Select academic year</option>
                  {(academicYears ?? []).map((year: any) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Class</label>
                <select
                  value={substitutionForm.classId}
                  onChange={(e) =>
                    setSubstitutionForm((prev) => ({
                      ...prev,
                      classId: e.target.value,
                      sectionId: '',
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">Select class</option>
                  {(classes ?? [])
                    .filter((cls: any) =>
                      substitutionForm.academicYearId ? cls.academicYearId === substitutionForm.academicYearId : true,
                    )
                    .map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Section {substitutionSectionRequired ? '(required)' : '(optional)'}</label>
                <select
                  value={substitutionForm.sectionId}
                  onChange={(e) => setSubstitutionForm((prev) => ({ ...prev, sectionId: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  disabled={!substitutionSectionRequired}
                >
                  <option value="">{substitutionSectionRequired ? 'Select section' : 'No sections'}</option>
                  {substitutionSections.map((section: any) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-1">
                <label className="text-xs font-semibold text-slate-600">Absent Teacher (optional)</label>
                <select
                  value={substitutionForm.originalTeacherId}
                  onChange={(e) => setSubstitutionForm((prev) => ({ ...prev, originalTeacherId: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">Select teacher</option>
                  {(teachers?.items ?? []).map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Substitute Teacher</label>
                <select
                  value={substitutionForm.substituteTeacherId}
                  onChange={(e) => setSubstitutionForm((prev) => ({ ...prev, substituteTeacherId: e.target.value }))}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                >
                  <option value="">Select substitute</option>
                  {(teachers?.items ?? []).map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <input
                value={substitutionForm.reason}
                onChange={(e) => setSubstitutionForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason (optional)"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!effectiveSchoolId || !substitutionForm.classId || !substitutionForm.substituteTeacherId || !substitutionForm.date) {
                    return;
                  }
                  if (substitutionSectionRequired && !substitutionForm.sectionId) {
                    return;
                  }
                  createSubstitutionMutation.mutate({
                    schoolId: isSuperAdmin ? effectiveSchoolId : undefined,
                    classId: substitutionForm.classId,
                    sectionId: substitutionForm.sectionId || undefined,
                    date: substitutionForm.date,
                    originalTeacherId: substitutionForm.originalTeacherId || undefined,
                    substituteTeacherId: substitutionForm.substituteTeacherId,
                    reason: substitutionForm.reason || undefined,
                  });
                }}
              >
                Assign Substitute
              </Button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Substitutions for {substitutionForm.date}</h3>
                <span className="text-xs text-slate-500">{substitutions?.length ?? 0} entries</span>
              </div>
              <div className="mt-3 space-y-3">
                {(substitutions ?? []).length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No substitutions scheduled for this date.
                  </div>
                ) : (
                  (substitutions ?? []).map((entry) => (
                    <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          {entry.class?.name} {entry.section?.name ? `· ${entry.section.name}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          Substitute: {entry.substituteTeacher?.firstName} {entry.substituteTeacher?.lastName}
                          {entry.originalTeacher ? ` · Original: ${entry.originalTeacher.firstName} ${entry.originalTeacher.lastName}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${entry.canceledAt ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {entry.canceledAt ? 'Canceled' : 'Active'}
                        </span>
                        {!entry.canceledAt && (
                          <button
                            type="button"
                            onClick={() => cancelSubstitutionMutation.mutate({ id: entry.id })}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-600"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </DashboardPageContainer>
    </div>
  );
}
