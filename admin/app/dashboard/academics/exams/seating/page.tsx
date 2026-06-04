'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { listClasses, listSections } from '../../../../../services/academic.service';
import { generateExamSeating, getExamSeating, listExams } from '../../../../../services/report.service';

export default function ExamSeatingPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => listExams() });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() });
  const { data: sections = [] } = useQuery({ queryKey: ['sections'], queryFn: () => listSections() });
  const { data: seating, isLoading } = useQuery({ queryKey: ['exam-seating', examId], queryFn: () => getExamSeating(examId), enabled: Boolean(examId) });

  const selectedExam = useMemo(() => exams.find((exam: any) => exam.id === examId), [exams, examId]);

  const generateMutation = useMutation({
    mutationFn: (force: boolean) => generateExamSeating(examId, { classId: classId || selectedExam?.classId, sectionId: sectionId || selectedExam?.sectionId, force }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-seating', examId] });
      notify.success('Seating generated', 'Student seating allocation is ready.');
    },
    onError: (error: any) => notify.error('Generation failed', error?.response?.data?.error?.message || 'Unable to generate seating.'),
  });

  const handleGenerate = () => {
    if (!examId) {
      notify.error('Select exam', 'Choose an exam before generating seating.');
      return;
    }
    const hasAllocations = Boolean(seating?.allocations?.length);
    if (hasAllocations && !window.confirm('Regenerate seating? Existing allocation will be replaced after validation.')) return;
    generateMutation.mutate(hasAllocations);
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Exam Seating" subtitle="Generate and review deterministic room and seat allocation." />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2 text-sm" value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Select exam</option>
              {exams.map((exam: any) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Exam class</option>
              {classes.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              <option value="">Exam section</option>
              {sections.map((section: any) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
            <Button onClick={handleGenerate} loading={generateMutation.isPending}>Generate</Button>
          </div>
        </section>
        {examId ? (
          <section className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs uppercase text-gray-500">Allocated Students</div><div className="mt-1 text-2xl font-semibold">{seating?.summary.allocated ?? 0}</div></div>
            <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs uppercase text-gray-500">Active Capacity</div><div className="mt-1 text-2xl font-semibold">{seating?.summary.activeCapacity ?? 0}</div></div>
            <div className="rounded-lg border bg-white p-4 shadow-sm"><div className="text-xs uppercase text-gray-500">Rooms Used</div><div className="mt-1 text-2xl font-semibold">{seating?.summary.rooms.filter((room) => room.allocated > 0).length ?? 0}</div></div>
          </section>
        ) : null}
        {seating?.summary.rooms.length ? (
          <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-gray-900">Capacity Summary</h2>
            <div className="grid gap-2 md:grid-cols-3">
              {seating.summary.rooms.map((room) => (
                <div key={room.roomId} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{room.centerName} · {room.roomName}</div>
                  <div className="text-gray-500">{room.allocated} / {room.capacity} allocated</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Center</th><th className="p-3">Room</th><th className="p-3">Seat</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={5}>Loading seating...</td></tr> : null}
              {examId && !isLoading && !seating?.allocations.length ? <tr><td className="p-4 text-gray-500" colSpan={5}>No seating allocation found.</td></tr> : null}
              {!examId ? <tr><td className="p-4 text-gray-500" colSpan={5}>Select an exam to view seating.</td></tr> : null}
              {seating?.allocations.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="p-3"><div className="font-medium">{entry.student.fullName}</div><div className="text-xs text-gray-500">{entry.student.admissionNo} · Roll {entry.student.rollNo || '-'}</div></td>
                  <td className="p-3">{entry.student.class?.name ?? '-'} / {entry.student.section?.name ?? '-'}</td>
                  <td className="p-3">{entry.center.name}</td>
                  <td className="p-3">{entry.room.name}</td>
                  <td className="p-3">{entry.seatNumber} <span className="text-xs text-gray-500">R{entry.seatRow} C{entry.seatColumn}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
