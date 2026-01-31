'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listExams, createExam, uploadMarks, downloadTermReport, downloadAnnualReport, downloadRankCard } from '../../../services/report.service';

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
  const [examForm, setExamForm] = useState({ name: '', type: 'MIDTERM', academicYearId: '', termId: '' });
  const [marksForm, setMarksForm] = useState({ examPaperId: '', studentId: '', score: '' });
  const [reportForm, setReportForm] = useState({ studentId: '', termId: '', academicYearId: '' });

  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: listExams });

  const examMutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      setExamForm({ name: '', type: 'MIDTERM', academicYearId: '', termId: '' });
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
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={examForm.name}
            onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
            placeholder="Exam name"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
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
          <input
            value={examForm.academicYearId}
            onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })}
            placeholder="Academic Year ID"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
          <input
            value={examForm.termId}
            onChange={(e) => setExamForm({ ...examForm, termId: e.target.value })}
            placeholder="Term ID (optional)"
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          />
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={() =>
            examMutation.mutate({
              name: examForm.name,
              type: examForm.type,
              academicYearId: examForm.academicYearId,
              termId: examForm.termId || null,
            })
          }
          disabled={examMutation.isPending}
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
