'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { downloadHallTicket, listExams, listHallTickets } from '../../../../../services/report.service';

const saveBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default function ExamHallTicketsPage() {
  const notify = useNotify();
  const [examId, setExamId] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => listExams() });
  const { data: students = [], isLoading } = useQuery({ queryKey: ['exam-hall-tickets', examId], queryFn: () => listHallTickets(examId), enabled: Boolean(examId) });

  const downloadOne = async (studentId: string, name: string) => {
    try {
      setDownloadingId(studentId);
      const blob = await downloadHallTicket(examId, studentId);
      saveBlob(blob, `hall-ticket-${name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      notify.success('Downloaded', 'Hall ticket PDF downloaded.');
    } catch (error: any) {
      notify.error('Download failed', error?.response?.data?.error?.message || 'Unable to download hall ticket.');
    } finally {
      setDownloadingId('');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader
          title="Hall Tickets"
          subtitle="View seating readiness and download student hall ticket PDFs."
        />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <select className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((exam: any) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
          </select>
        </section>
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Student</th><th className="p-3">Class</th><th className="p-3">Center</th><th className="p-3">Room / Seat</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={5}>Loading students...</td></tr> : null}
              {!examId ? <tr><td className="p-4 text-gray-500" colSpan={5}>Select an exam to view hall tickets.</td></tr> : null}
              {examId && !isLoading && !students.length ? <tr><td className="p-4 text-gray-500" colSpan={5}>No students found for this exam.</td></tr> : null}
              {students.map((student) => {
                const allocation = student.examSeatingAllocations[0];
                return (
                  <tr key={student.id} className="border-t">
                    <td className="p-3"><div className="font-medium">{student.fullName}</div><div className="text-xs text-gray-500">{student.admissionNo} · Roll {student.rollNo || '-'}</div></td>
                    <td className="p-3">{student.class?.name ?? '-'} / {student.section?.name ?? '-'}</td>
                    <td className="p-3">{allocation?.center.name ?? 'Not allocated'}</td>
                    <td className="p-3">{allocation ? `${allocation.room.name} / ${allocation.seatNumber}` : '-'}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" onClick={() => downloadOne(student.id, student.fullName)} disabled={!allocation || Boolean(downloadingId)} loading={downloadingId === student.id}>Download</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
