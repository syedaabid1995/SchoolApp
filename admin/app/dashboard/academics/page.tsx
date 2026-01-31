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
  const [sectionForm, setSectionForm] = useState({ name: '', classId: '' });
  const [subjectForm, setSubjectForm] = useState({ name: '', classId: '' });

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
      setSubjectForm({ name: '', classId: '' });
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
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={yearForm.endDate}
            onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
            placeholder="End date (YYYY-MM-DD)"
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
        <div className="mt-4 flex gap-3">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="Class name"
            className="flex-1 rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <button
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createClassMutation.mutate({ name: className, schoolId: effectiveSchoolId })}
          disabled={createClassMutation.isPending}
        >
            Add Class
          </button>
        </div>
        <div className="mt-4 text-sm text-slate">
          {classes?.map((cls: { id: string; name: string }) => (
            <div key={cls.id}>{cls.name}</div>
          ))}
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
          onClick={() => createSectionMutation.mutate({ ...sectionForm, schoolId: effectiveSchoolId })}
          disabled={createSectionMutation.isPending}
        >
          Add Section
        </button>
        <div className="mt-4 text-sm text-slate">
          {sections?.map((section: { id: string; name: string }) => (
            <div key={section.id}>{section.name}</div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Subjects</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={subjectForm.name}
            onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            placeholder="Subject name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <select
            value={subjectForm.classId}
            onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Optional class</option>
            {classes?.map((cls: { id: string; name: string }) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => createSubjectMutation.mutate({ ...subjectForm, schoolId: effectiveSchoolId })}
          disabled={createSubjectMutation.isPending}
        >
          Add Subject
        </button>
        <div className="mt-4 text-sm text-slate">
          {subjects?.map((subject: { id: string; name: string }) => (
            <div key={subject.id}>{subject.name}</div>
          ))}
        </div>
      </section>
    </div>
  );
}
