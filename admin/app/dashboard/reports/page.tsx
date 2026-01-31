'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listExams, createExam, uploadMarks, downloadTermReport, downloadAnnualReport, downloadRankCard } from '../../../services/report.service';
import { listSubjects } from '../../../services/academic.service';
import { getSession } from '../../../services/auth.service';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [examForm, setExamForm] = useState({
    name: '',
    type: 'MIDTERM',
    subjectIds: [] as string[],
    useCustomName: false,
  });
  const subjectSelectRef = useRef<HTMLSelectElement | null>(null);
  const [marksForm, setMarksForm] = useState({ examPaperId: '', studentId: '', score: '' });
  const [reportForm, setReportForm] = useState({ studentId: '', termId: '', academicYearId: '' });

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: listExams });
  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const effectiveSchoolId = session?.schoolId ?? undefined;
  const { data: subjects } = useQuery({
    queryKey: ['subjects', effectiveSchoolId],
    queryFn: () => listSubjects({ schoolId: effectiveSchoolId }),
    enabled: Boolean(effectiveSchoolId),
  });

  const subjectOptions = useMemo(
    () =>
      subjects?.map(
        (subject: {
          id: string;
          name: string;
          class?: { name: string } | null;
          academicYear?: { name: string } | null;
        }) => ({
          value: subject.id,
          label: `${subject.name} (${subject.class?.name ?? '—'}/${subject.academicYear?.name ?? '—'})`,
        }),
      ) ?? [],
    [subjects],
  );

  useEffect(() => {
    if (!subjectSelectRef.current) return;
    let $: any;
    let destroyed = false;
    const init = async () => {
      if (typeof window === 'undefined') return;
      const jqueryModule = await import('jquery');
      $ = jqueryModule.default ?? jqueryModule;
      (window as any).jQuery = $;
      (window as any).$ = $;
      await import('multiple-select/dist/multiple-select.min.js');
      if (destroyed || !subjectSelectRef.current) return;
      const $el = $(subjectSelectRef.current);
      try {
        $el.multipleSelect('destroy');
      } catch {
        // ignore
      }
      $el.multipleSelect({
        selectAll: false,
        filter: true,
        filterPlaceholder: 'Search subjects',
        placeholder: 'Select subjects',
        keepOpen: true,
        width: '100%',
      });
      $el.off('change').on('change', () => {
        const values = $el.multipleSelect('getSelects') as string[];
        setExamForm((prev) => ({ ...prev, subjectIds: values }));
      });
      $el.multipleSelect('setSelects', examForm.subjectIds);
    };
    init();
    return () => {
      destroyed = true;
      if ($ && subjectSelectRef.current) {
        $(subjectSelectRef.current).multipleSelect('destroy');
      }
    };
  }, [subjectOptions, examForm.subjectIds]);

  const closeSubjectDropdown = () => {
    if (typeof window === 'undefined' || !subjectSelectRef.current) return;
    const $ = (window as any).jQuery || (window as any).$;
    if ($) {
      $(subjectSelectRef.current).multipleSelect('close');
    }
  };

  const examMutation = useMutation({
    mutationFn: () =>
      createExam({
        name: examForm.useCustomName ? examForm.name.trim() : undefined,
        type: examForm.type,
        subjectIds: examForm.subjectIds,
      }),
    onSuccess: () => {
      setExamForm({ name: '', type: 'MIDTERM', subjectIds: [], useCustomName: false });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });

  const marksMutation = useMutation({
    mutationFn: uploadMarks,
  });

  const termReportMutation = useMutation({
    mutationFn: () => downloadTermReport({ studentId: reportForm.studentId, termId: reportForm.termId }),
    onSuccess: (blob) => downloadBlob(blob, 'term-report.pdf'),
  });

  const annualReportMutation = useMutation({
    mutationFn: () => downloadAnnualReport({ studentId: reportForm.studentId, academicYearId: reportForm.academicYearId }),
    onSuccess: (blob) => downloadBlob(blob, 'annual-report.pdf'),
  });

  const rankCardMutation = useMutation({
    mutationFn: () => downloadRankCard({ studentId: reportForm.studentId, termId: reportForm.termId }),
    onSuccess: (blob) => downloadBlob(blob, 'rank-card.pdf'),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Reports</h1>
        <p className="text-sm text-slate">Generate report cards and performance summaries.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Create Exam</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={examForm.name}
            onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
            placeholder="Custom exam name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            disabled={!examForm.useCustomName}
          />
          <select
            value={examForm.type}
            onChange={(e) => setExamForm({ ...examForm, type: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="MIDTERM">Midterm</option>
            <option value="FINAL">Final</option>
            <option value="QUIZ">Quiz</option>
            <option value="ASSIGNMENT">Assignment</option>
          </select>
        </div>
        <div className="mt-4 rounded-xl border border-slate/10 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Subjects</h3>
            <label className="flex items-center gap-2 text-sm text-slate">
              <input
                type="checkbox"
                checked={examForm.useCustomName}
                onChange={(e) => setExamForm({ ...examForm, useCustomName: e.target.checked })}
              />
              Other (custom exam name)
            </label>
          </div>
          {subjectOptions.length ? (
            <div className="mt-3">
              <select ref={subjectSelectRef} multiple className="w-full">
                {subjectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={closeSubjectDropdown}
                  className="rounded-md border border-slate/20 px-3 py-1.5 text-xs font-semibold text-slate hover:bg-slate/10"
                >
                  OK
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate">No subjects found.</p>
          )}
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() => examMutation.mutate()}
          disabled={examMutation.isPending || examForm.subjectIds.length === 0 || (examForm.useCustomName && !examForm.name.trim())}
        >
          {examMutation.isPending ? 'Creating...' : 'Create Exam'}
        </button>
        <div className="mt-4 text-sm text-slate">
          {exams?.map((exam: { id: string; name: string }) => (
            <div key={exam.id}>{exam.name}</div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Upload Marks</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={marksForm.examPaperId}
            onChange={(e) => setMarksForm({ ...marksForm, examPaperId: e.target.value })}
            placeholder="Exam Paper ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={marksForm.studentId}
            onChange={(e) => setMarksForm({ ...marksForm, studentId: e.target.value })}
            placeholder="Student ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={marksForm.score}
            onChange={(e) => setMarksForm({ ...marksForm, score: e.target.value })}
            placeholder="Score"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            marksMutation.mutate({
              examPaperId: marksForm.examPaperId,
              marks: [{ studentId: marksForm.studentId, score: Number(marksForm.score) }],
            })
          }
          disabled={marksMutation.isPending}
        >
          Upload Marks
        </button>
      </section>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Download Reports</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={reportForm.studentId}
            onChange={(e) => setReportForm({ ...reportForm, studentId: e.target.value })}
            placeholder="Student ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={reportForm.termId}
            onChange={(e) => setReportForm({ ...reportForm, termId: e.target.value })}
            placeholder="Term ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={reportForm.academicYearId}
            onChange={(e) => setReportForm({ ...reportForm, academicYearId: e.target.value })}
            placeholder="Academic Year ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
            onClick={() => termReportMutation.mutate()}
          >
            Download Term Report
          </button>
          <button
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
            onClick={() => annualReportMutation.mutate()}
          >
            Download Annual Report
          </button>
          <button
            className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
            onClick={() => rankCardMutation.mutate()}
          >
            Download Rank Card
          </button>
        </div>
      </section>
    </div>
  );
}
