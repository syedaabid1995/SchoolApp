'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { listTeachers } from '../../../../../services/teacher.service';
import { assignExamInvigilator, listExamInvigilators, listExamRooms, listExams, removeExamInvigilator } from '../../../../../services/report.service';

export default function ExamInvigilatorsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [examId, setExamId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [roomId, setRoomId] = useState('');
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => listExams() });
  const { data: rooms = [] } = useQuery({ queryKey: ['exam-rooms'], queryFn: () => listExamRooms() });
  const { data: teachers } = useQuery({ queryKey: ['teachers', 'active'], queryFn: () => listTeachers({ limit: 200, isActive: true }) });
  const { data: assignments = [], isLoading } = useQuery({ queryKey: ['exam-invigilators', examId], queryFn: () => listExamInvigilators(examId), enabled: Boolean(examId) });

  const assignMutation = useMutation({
    mutationFn: () => assignExamInvigilator(examId, { teacherId, roomId }),
    onSuccess: () => {
      setTeacherId('');
      setRoomId('');
      queryClient.invalidateQueries({ queryKey: ['exam-invigilators', examId] });
      notify.success('Assigned', 'Invigilator assigned successfully.');
    },
    onError: (error: any) => notify.error('Assignment failed', error?.response?.data?.error?.message || 'Unable to assign invigilator.'),
  });

  const removeMutation = useMutation({
    mutationFn: (assignmentId: string) => removeExamInvigilator(examId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exam-invigilators', examId] });
      notify.success('Removed', 'Invigilator assignment removed.');
    },
    onError: (error: any) => notify.error('Remove failed', error?.response?.data?.error?.message || 'Unable to remove assignment.'),
  });

  const handleAssign = () => {
    if (!examId || !teacherId || !roomId) {
      notify.error('Missing selection', 'Select exam, invigilator, and room.');
      return;
    }
    assignMutation.mutate();
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Exam Invigilators" subtitle="Assign active employees to exam rooms and prevent double booking." />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border px-3 py-2 text-sm" value={examId} onChange={(e) => setExamId(e.target.value)}>
              <option value="">Select exam</option>
              {exams.map((exam: any) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Select invigilator</option>
              {teachers?.items.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Select room</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.center?.name} · {room.name}</option>)}
            </select>
            <Button onClick={handleAssign} loading={assignMutation.isPending}>Assign</Button>
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Invigilator</th><th className="p-3">Center</th><th className="p-3">Room</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={4}>Loading assignments...</td></tr> : null}
              {!examId ? <tr><td className="p-4 text-gray-500" colSpan={4}>Select an exam to view invigilators.</td></tr> : null}
              {examId && !isLoading && !assignments.length ? <tr><td className="p-4 text-gray-500" colSpan={4}>No invigilators assigned.</td></tr> : null}
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-t">
                  <td className="p-3"><div className="font-medium">{assignment.teacher.firstName} {assignment.teacher.lastName}</div><div className="text-xs text-gray-500">{assignment.teacher.employeeNo || assignment.teacher.user?.email || '-'}</div></td>
                  <td className="p-3">{assignment.center.name}</td>
                  <td className="p-3">{assignment.room.name}</td>
                  <td className="p-3 text-right"><Button size="sm" variant="danger" onClick={() => removeMutation.mutate(assignment.id)}>Remove</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
