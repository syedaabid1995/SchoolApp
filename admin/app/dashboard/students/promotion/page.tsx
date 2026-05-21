'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import FullPageLoader from '../../../../components/FullPageLoader';
import PageHeader from '../../../../components/PageHeader';
import { useNotify } from '../../../../components/NotificationProvider';
import { getSession } from '../../../../services/auth.service';
import { listAcademicYears } from '../../../../services/academic.service';
import { listSetupClasses, listSetupSections } from '../../../../services/academic-setup.service';
import { previewStudentPromotion, promoteStudents, type StudentPromotionResult } from '../../../../services/student-operations.service';
import { SchoolAdminOnly } from '../_components/SchoolAdminOnly';

export default function StudentPromotionPage() {
  const notify = useNotify();
  const [form, setForm] = useState({
    fromAcademicSessionId: '',
    toAcademicSessionId: '',
    fromClassId: '',
    toClassId: '',
    fromSectionId: '',
    toSectionId: '',
    note: '',
  });
  const [results, setResults] = useState<Record<string, StudentPromotionResult>>({});

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: () => listAcademicYears(), enabled: isSchoolAdmin });
  const classesQuery = useQuery({ queryKey: ['setup-classes'], queryFn: () => listSetupClasses(), enabled: isSchoolAdmin });
  const sectionsQuery = useQuery({ queryKey: ['setup-sections'], queryFn: () => listSetupSections(), enabled: isSchoolAdmin });

  const fromSections = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => (form.fromClassId ? section.classSections?.some((link) => link.classId === form.fromClassId) || section.classId === form.fromClassId : true)),
    [form.fromClassId, sectionsQuery.data],
  );
  const toSections = useMemo(
    () => (sectionsQuery.data ?? []).filter((section) => (form.toClassId ? section.classSections?.some((link) => link.classId === form.toClassId) || section.classId === form.toClassId : true)),
    [form.toClassId, sectionsQuery.data],
  );

  const previewQuery = useQuery({
    queryKey: ['student-promotion-preview', form.fromAcademicSessionId, form.fromClassId, form.fromSectionId],
    queryFn: () => previewStudentPromotion({ academicSessionId: form.fromAcademicSessionId, classId: form.fromClassId, sectionId: form.fromSectionId }),
    enabled: false,
  });

  const loadStudents = async () => {
    if (!form.fromAcademicSessionId || !form.fromClassId || !form.fromSectionId) {
      notify.warning('Select criteria', 'Current session, class, and section are required.');
      return;
    }
    const data = await previewQuery.refetch();
    if (data.data) {
      setResults(Object.fromEntries(data.data.students.map((student) => [student.id, 'PASS'])));
      if (!form.toAcademicSessionId && data.data.suggestedPromoteSession?.id) {
        setForm((current) => ({ ...current, toAcademicSessionId: data.data?.suggestedPromoteSession?.id ?? '' }));
      }
    }
  };

  const promoteMutation = useMutation({
    mutationFn: () => {
      if (!form.toAcademicSessionId || !form.toClassId || !form.toSectionId) throw new Error('Promote session, class, and section are required.');
      const selected = Object.entries(results).map(([studentId, result]) => ({ studentId, result }));
      if (!selected.length) throw new Error('Load students before promoting.');
      return promoteStudents({
        fromAcademicSessionId: form.fromAcademicSessionId,
        toAcademicSessionId: form.toAcademicSessionId,
        fromClassId: form.fromClassId,
        toClassId: form.toClassId,
        fromSectionId: form.fromSectionId,
        toSectionId: form.toSectionId,
        note: form.note,
        results: selected,
      });
    },
    onSuccess: () => notify.success('Students promoted', 'Promotion history was saved and passed students were moved.'),
    onError: (error: any) => notify.error('Promotion failed', error?.response?.data?.error?.message ?? error.message ?? 'Unable to promote students.'),
  });

  if (sessionLoading || !session?.role) return <FullPageLoader label="Checking promotion access..." />;
  if (!isSchoolAdmin) return <SchoolAdminOnly moduleName="student promotion" />;

  const students = previewQuery.data?.students ?? [];

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 lg:px-8">
        <PageHeader
          title="Student Promotion"
          subtitle="Promote passed students to the next academic session and keep promotion history."
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Students', href: '/dashboard/students' }, { label: 'Promotion' }]}
        />

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <select value={form.fromAcademicSessionId} onChange={(event) => setForm({ ...form, fromAcademicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Session</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={form.fromClassId} onChange={(event) => setForm({ ...form, fromClassId: event.target.value, fromSectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.fromSectionId} onChange={(event) => setForm({ ...form, fromSectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Current Section</option>
              {fromSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.toAcademicSessionId} onChange={(event) => setForm({ ...form, toAcademicSessionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Session</option>
              {(yearsQuery.data ?? []).map((year: any) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
            <select value={form.toClassId} onChange={(event) => setForm({ ...form, toClassId: event.target.value, toSectionId: '' })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Class</option>
              {(classesQuery.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={form.toSectionId} onChange={(event) => setForm({ ...form, toSectionId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <option value="">Promote Section</option>
              {toSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={loadStudents} className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm">Search Students</button>
            <button onClick={() => window.print()} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">Print</button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Promotion Students</h2>
              <p className="text-sm text-slate-500">{students.length ? `${students.length} students loaded.` : 'Search current session and class to load students.'}</p>
            </div>
            <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Promotion note" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admission No</th>
                  <th className="px-4 py-3">Roll No</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Academic Performance</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewQuery.isFetching ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading students...</td></tr>
                ) : students.length ? (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-4 py-3 font-semibold">{student.admissionNo}</td>
                      <td className="px-4 py-3">{student.rollNo ?? '-'}</td>
                      <td className="px-4 py-3">{student.fullName || `${student.firstName} ${student.lastName}`.trim()}</td>
                      <td className="px-4 py-3">
                        <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => alert('Academic performance summary will use exam results when configured.')}>View</button>
                      </td>
                      <td className="px-4 py-3">
                        <select value={results[student.id] ?? 'PASS'} onChange={(event) => setResults({ ...results, [student.id]: event.target.value as StudentPromotionResult })} className="rounded-lg border border-slate-200 px-3 py-2">
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={!students.length || promoteMutation.isPending} onClick={() => window.confirm('Promote selected students?') && promoteMutation.mutate()} className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-2 text-sm font-bold text-[var(--theme-button-text)] shadow-sm disabled:opacity-50">
              Promote Students
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
