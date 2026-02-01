'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listSections, listSubjects } from '../../../../services/academic.service';
import { listSchools } from '../../../../services/school.service';
import { getSession } from '../../../../services/auth.service';
import { createExam, listExams } from '../../../../services/report.service';
import { useNotify } from '../../../../components/NotificationProvider';

type SubjectRow = {
  id: string;
  name: string;
  class?: { id: string; name: string } | null;
  academicYear?: { id: string; name: string } | null;
};

type SubjectSelection = {
  include: boolean;
  maxMarks: string;
  passMarks: string;
};

const defaultMarks = { maxMarks: '100', passMarks: '35' };

export default function ExamsPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [schoolId, setSchoolId] = useState('');
  const [examBasics, setExamBasics] = useState({
    name: '',
    type: 'MIDTERM',
    academicYearId: '',
    classId: '',
    sectionId: '',
    resultPublishDate: '',
    examMode: 'MARKS',
  });
  const [structure, setStructure] = useState({
    sameMarks: false,
    internalExternal: false,
    practical: false,
    internalMarks: '',
    externalMarks: '',
    practicalMarks: '',
  });
  const [subjectMap, setSubjectMap] = useState<Record<string, SubjectSelection>>({});
  const [stepError, setStepError] = useState('');

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
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
  const { data: exams } = useQuery({
    queryKey: ['exams', effectiveSchoolId],
    queryFn: () => listExams(),
    enabled: Boolean(effectiveSchoolId),
  });

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    classes?.forEach((cls: { id: string; name: string }) => map.set(cls.id, cls.name));
    return map;
  }, [classes]);
  const yearLookup = useMemo(() => {
    const map = new Map<string, string>();
    years?.forEach((year: { id: string; name: string }) => map.set(year.id, year.name));
    return map;
  }, [years]);

  const filteredSubjects = useMemo(() => {
    const rows = (subjects ?? []) as SubjectRow[];
    if (!examBasics.classId || !examBasics.academicYearId) return [];
    return rows.filter(
      (subject) =>
        subject.class?.id === examBasics.classId &&
        subject.academicYear?.id === examBasics.academicYearId,
    );
  }, [subjects, examBasics.classId, examBasics.academicYearId]);

  const selectedSubjectIds = useMemo(
    () => Object.entries(subjectMap).filter(([, value]) => value.include).map(([id]) => id),
    [subjectMap],
  );

  const createExamMutation = useMutation({
    mutationFn: (payload: { status: 'DRAFT' | 'PUBLISHED' }) =>
      createExam({
        name: examBasics.name.trim() || undefined,
        type: examBasics.type,
        subjectIds: selectedSubjectIds,
        academicYearId: examBasics.academicYearId,
        classId: examBasics.classId,
        sectionId: examBasics.sectionId || undefined,
        scheduledAt: examBasics.resultPublishDate || undefined,
        status: payload.status,
      }),
    onSuccess: (data, variables) => {
      setStep(1);
      setExamBasics({
        name: '',
        type: 'MIDTERM',
        academicYearId: '',
        classId: '',
        sectionId: '',
        resultPublishDate: '',
        examMode: 'MARKS',
      });
      setStructure({
        sameMarks: false,
        internalExternal: false,
        practical: false,
        internalMarks: '',
        externalMarks: '',
        practicalMarks: '',
      });
      setSubjectMap({});
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      
      const status = variables.status === 'DRAFT' ? 'saved as draft' : 'published';
      notify.success(`Exam ${status}!`, `${examBasics.name} has been ${status} successfully`);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to create exam';
      notify.error('Exam creation failed', message);
    },
  });

  const syncSubjectMap = () => {
    const next: Record<string, SubjectSelection> = {};
    filteredSubjects.forEach((subject) => {
      const existing = subjectMap[subject.id];
      next[subject.id] = existing ?? { include: true, ...defaultMarks };
    });
    setSubjectMap(next);
  };

  const handleContinueFromBasics = () => {
    let error = '';
    if (!examBasics.academicYearId) error = 'Select academic year.';
    else if (!examBasics.classId) error = 'Select class.';
    setStepError(error);
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    syncSubjectMap();
    setStep(2);
    notify.success('Step saved', 'Exam details saved. Continue to subjects.');
  };

  const handleToggleSubject = (id: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: {
        include: !prev[id]?.include,
        maxMarks: prev[id]?.maxMarks ?? defaultMarks.maxMarks,
        passMarks: prev[id]?.passMarks ?? defaultMarks.passMarks,
      },
    }));
  };

  const handleMarkChange = (id: string, field: 'maxMarks' | 'passMarks', value: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: {
        include: prev[id]?.include ?? true,
        maxMarks: field === 'maxMarks' ? value : prev[id]?.maxMarks ?? defaultMarks.maxMarks,
        passMarks: field === 'passMarks' ? value : prev[id]?.passMarks ?? defaultMarks.passMarks,
      },
    }));
  };

  const resetSubjectMarks = (id: string) => {
    setSubjectMap((prev) => ({
      ...prev,
      [id]: { include: prev[id]?.include ?? true, ...defaultMarks },
    }));
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Exams</h1>
        <p className="text-sm text-slate">Create exams and map subjects from your academic setup.</p>
      </header>

      {isSuperAdmin ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <h2 className="text-sm font-semibold text-ink">School Context</h2>
          <div className="mt-3">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 1, label: 'Details' },
            { id: 2, label: 'Subjects' },
            { id: 3, label: 'Structure' },
          ].map((item) => (
            <span
              key={item.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === item.id ? 'bg-ink text-white' : 'bg-sand text-slate'
              }`}
            >
              {item.id}. {item.label}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create Exam</h2>

        {step === 1 ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={examBasics.name}
                onChange={(e) => setExamBasics({ ...examBasics, name: e.target.value })}
                placeholder="Exam name"
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
              <select
                value={examBasics.type}
                onChange={(e) => setExamBasics({ ...examBasics, type: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="MIDTERM">Mid Term</option>
                <option value="QUIZ">Unit Test</option>
                <option value="ASSIGNMENT">Monthly</option>
                <option value="FINAL">Final</option>
              </select>
              <select
                value={examBasics.academicYearId}
                onChange={(e) => setExamBasics({ ...examBasics, academicYearId: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select academic year</option>
                {years?.map((year: { id: string; name: string }) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
              <select
                value={examBasics.classId}
                onChange={(e) => setExamBasics({ ...examBasics, classId: e.target.value, sectionId: '' })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">Select class</option>
                {classes?.map((cls: { id: string; name: string }) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <select
                value={examBasics.sectionId}
                onChange={(e) => setExamBasics({ ...examBasics, sectionId: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="">All sections (optional)</option>
                {sections
                  ?.filter((section: { classId: string }) => section.classId === examBasics.classId)
                  .map((section: { id: string; name: string }) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
              </select>
              <select
                value={examBasics.examMode}
                onChange={(e) => setExamBasics({ ...examBasics, examMode: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              >
                <option value="MARKS">Marks</option>
                <option value="GRADES">Grades</option>
                <option value="MARKS_GRADES">Marks + Grades</option>
              </select>
              <input
                type="date"
                value={examBasics.resultPublishDate}
                onChange={(e) => setExamBasics({ ...examBasics, resultPublishDate: e.target.value })}
                className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={handleContinueFromBasics}
              >
                Save & Continue
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => setStep(1)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Assign Subjects to Exam</h3>
              <p className="text-xs text-slate">
                Subjects are auto-loaded from the selected class and academic year.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate">
                  <tr>
                    <th className="py-2">Subject</th>
                    <th>Include</th>
                    <th>Max Marks</th>
                    <th>Pass Marks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => {
                    const selection = subjectMap[subject.id] ?? { include: false, ...defaultMarks };
                    return (
                      <tr key={subject.id} className="border-t border-slate/10">
                        <td className="py-3">{subject.name}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={selection.include}
                            onChange={() => handleToggleSubject(subject.id)}
                          />
                        </td>
                        <td>
                          <input
                            className="w-24 rounded-md border border-slate/20 px-2 py-1 text-sm"
                            value={selection.maxMarks}
                            onChange={(e) => handleMarkChange(subject.id, 'maxMarks', e.target.value)}
                            disabled={!selection.include}
                          />
                        </td>
                        <td>
                          <input
                            className="w-24 rounded-md border border-slate/20 px-2 py-1 text-sm"
                            value={selection.passMarks}
                            onChange={(e) => handleMarkChange(subject.id, 'passMarks', e.target.value)}
                            disabled={!selection.include}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="text-xs font-semibold text-ink"
                            onClick={() => resetSubjectMarks(subject.id)}
                          >
                            Reset
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filteredSubjects.length ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate">
                        No subjects found for this class and academic year.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  if (!selectedSubjectIds.length) {
                    const message = 'Select at least one subject.';
                    setStepError(message);
                    notify.error('Validation error', message);
                    return;
                  }
                  setStepError('');
                  setStep(3);
                  notify.success('Step saved', 'Subject mapping saved. Continue to structure.');
                }}
              >
                Save & Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-4 space-y-4">
            <h3 className="text-sm font-semibold text-ink">Exam Structure (Optional)</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.sameMarks}
                  onChange={(e) => setStructure({ ...structure, sameMarks: e.target.checked })}
                />
                Same marks for all subjects
              </label>
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.internalExternal}
                  onChange={(e) => setStructure({ ...structure, internalExternal: e.target.checked })}
                />
                Internal + External marks
              </label>
              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  checked={structure.practical}
                  onChange={(e) => setStructure({ ...structure, practical: e.target.checked })}
                />
                Practical marks
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {structure.internalExternal ? (
                <>
                  <input
                    className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    placeholder="Internal marks"
                    value={structure.internalMarks}
                    onChange={(e) => setStructure({ ...structure, internalMarks: e.target.value })}
                  />
                  <input
                    className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                    placeholder="External marks"
                    value={structure.externalMarks}
                    onChange={(e) => setStructure({ ...structure, externalMarks: e.target.value })}
                  />
                </>
              ) : null}
              {structure.practical ? (
                <input
                  className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
                  placeholder="Practical marks"
                  value={structure.practicalMarks}
                  onChange={(e) => setStructure({ ...structure, practicalMarks: e.target.value })}
                />
              ) : null}
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => {
                  notify.info('Saving exam...', 'Creating exam as draft');
                  createExamMutation.mutate({ status: 'DRAFT' });
                }}
                disabled={createExamMutation.isPending}
              >
                Save Exam
              </button>
              <button
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  notify.info('Publishing exam...', 'Creating and publishing exam');
                  createExamMutation.mutate({ status: 'PUBLISHED' });
                }}
                disabled={createExamMutation.isPending}
              >
                Publish Exam
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Existing Exams</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Exam</th>
                <th>Type</th>
                <th>Class</th>
                <th>Academic Year</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(exams ?? []).map((exam: any) => (
                <tr key={exam.id} className="border-t border-slate/10">
                  <td className="py-3">{exam.name}</td>
                  <td>{exam.type}</td>
                  <td>{classLookup.get(exam.classId) ?? '—'}</td>
                  <td>{yearLookup.get(exam.academicYearId) ?? '—'}</td>
                  <td>{exam.status}</td>
                </tr>
              ))}
              {!exams?.length ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate">
                    No exams found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
