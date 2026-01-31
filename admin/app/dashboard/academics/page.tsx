'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAcademicYears,
  createAcademicYear,
  listClasses,
  createClass,
  listSections,
  createSection,
  listSubjects,
  createSubject,
} from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import { getSession } from '../../../services/auth.service';

export default function AcademicsPage() {
  const queryClient = useQueryClient();
  const [yearForm, setYearForm] = useState({ name: '', startDate: '', endDate: '' });
  const [className, setClassName] = useState('');
  const [classYearId, setClassYearId] = useState('');
  const [sectionForm, setSectionForm] = useState({ name: '', classId: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', classId: '', academicYearId: '' });

  const [schoolId, setSchoolId] = useState('');
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

  const createYearMutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      setYearForm({ name: '', startDate: '', endDate: '' });
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    },
  });

  const createClassMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      setClassName('');
      setClassYearId('');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: createSection,
    onSuccess: () => {
      setSectionForm({ name: '', classId: '' });
      queryClient.invalidateQueries({ queryKey: ['sections'] });
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      setSubjectForm({ name: '', classId: '', academicYearId: '' });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Academics</h1>
        <p className="text-sm text-slate">Configure academic years, classes, sections, and subjects.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        {isSuperAdmin ? (
          <div className="mb-4">
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            >
              <option value="">Select school</option>
              {schools?.items.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <h2 className="text-lg font-semibold">Academic Years</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={yearForm.name}
            onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
            placeholder="Year name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={yearForm.startDate}
            onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
            placeholder="Start date (YYYY-MM-DD)"
            type="date"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={yearForm.endDate}
            onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
            placeholder="End date (YYYY-MM-DD)"
            type="date"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createYearMutation.mutate({ ...yearForm, schoolId: effectiveSchoolId })}
          disabled={createYearMutation.isPending}
        >
          {createYearMutation.isPending ? 'Creating...' : 'Create Academic Year'}
        </button>
        <div className="mt-4 text-sm text-slate">
          {years?.map((year: { id: string; name: string }) => (
            <div key={year.id}>{year.name}</div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Classes</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={classYearId}
            onChange={(e) => setClassYearId(e.target.value)}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select academic year</option>
            {years?.map((year: { id: string; name: string }) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
            onClick={() =>
              createClassMutation.mutate({ name: className, academicYearId: classYearId, schoolId: effectiveSchoolId })
            }
            disabled={createClassMutation.isPending || !classYearId}
          >
            Add Class
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Title</th>
                <th>Academic Year</th>
              </tr>
            </thead>
            <tbody>
              {classes?.map((cls: { id: string; name: string; academicYear?: { id: string; name: string } | null }) => (
                <tr key={cls.id} className="border-t border-slate/10">
                  <td className="py-3">{cls.name}</td>
                  <td>{cls.academicYear?.name ?? '—'}</td>
                </tr>
              ))}
              {!classes?.length ? (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate">
                    No classes found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Sections</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={sectionForm.name}
            onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
            placeholder="Section name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={sectionForm.classId}
            onChange={(e) => setSectionForm({ ...sectionForm, classId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select class</option>
            {classes?.map((cls: { id: string; name: string }) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createSectionMutation.mutate({ name: sectionForm.name, classId: sectionForm.classId, schoolId: effectiveSchoolId })}
          disabled={createSectionMutation.isPending}
        >
          Add Section
        </button>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Title</th>
                <th>Class</th>
              </tr>
            </thead>
            <tbody>
              {sections?.map((section: { id: string; name: string; classId: string }) => {
                const className = classes?.find((cls: { id: string; name: string }) => cls.id === section.classId)?.name;
                return (
                  <tr key={section.id} className="border-t border-slate/10">
                    <td className="py-3">{section.name}</td>
                    <td>{className ?? 'All classes'}</td>
                  </tr>
                );
              })}
              {!sections?.length ? (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate">
                    No sections found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Subjects</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            placeholder="Subject name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={subjectForm.academicYearId}
            onChange={(e) => setSubjectForm({ ...subjectForm, academicYearId: e.target.value })}
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
            value={subjectForm.classId}
            onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Select class</option>
            {classes?.map((cls: { id: string; name: string }) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            createSubjectMutation.mutate({
              name: subjectForm.name,
              classId: subjectForm.classId || undefined,
              academicYearId: subjectForm.academicYearId || undefined,
              schoolId: effectiveSchoolId,
            })
          }
          disabled={createSubjectMutation.isPending}
        >
          Add Subject
        </button>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate">
              <tr>
                <th className="py-2">Title</th>
                <th>Class</th>
                <th>Academic Year</th>
              </tr>
            </thead>
            <tbody>
              {subjects?.map(
                (subject: {
                  id: string;
                  name: string;
                  classId?: string | null;
                  academicYear?: { id: string; name: string } | null;
                }) => {
                const className = subject.classId
                  ? classes?.find((cls: { id: string; name: string }) => cls.id === subject.classId)?.name
                  : null;
                return (
                  <tr key={subject.id} className="border-t border-slate/10">
                    <td className="py-3">{subject.name}</td>
                    <td>{className ?? '—'}</td>
                    <td>{subject.academicYear?.name ?? '—'}</td>
                  </tr>
                );
              })}
              {!subjects?.length ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate">
                    No subjects found.
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
