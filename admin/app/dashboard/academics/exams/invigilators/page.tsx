'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../../../../../components/Button';
import PageHeader from '../../../../../components/PageHeader';
import { useNotify } from '../../../../../components/NotificationProvider';
import { listTimetableTeachers } from '../../../../../services/academic.service';
import {
  assignExamInvigilator,
  autoAssignExamInvigilators,
  getExam,
  listExamCenters,
  listExamInvigilators,
  listExamRooms,
  listExams,
  removeExamInvigilator,
  type AutoAssignInvigilatorsResult,
} from '../../../../../services/report.service';

const formatPaperDate = (value?: string | null) => {
  if (!value) return 'Date not set';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function ExamInvigilatorsPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [examId, setExamId] = useState('');
  const [examPaperId, setExamPaperId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [autoPreview, setAutoPreview] = useState<AutoAssignInvigilatorsResult | null>(null);
  const { data: exams = [] } = useQuery({ queryKey: ['exams'], queryFn: () => listExams() });
  const { data: selectedExam, isLoading: examLoading } = useQuery({
    queryKey: ['exam-detail', examId],
    queryFn: () => getExam(examId),
    enabled: Boolean(examId),
  });
  const { data: centers = [], isLoading: centersLoading } = useQuery({ queryKey: ['exam-centers'], queryFn: () => listExamCenters() });
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['exam-rooms', centerId],
    queryFn: () => listExamRooms({ centerId }),
    enabled: Boolean(centerId),
  });
  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ['exam-invigilator-teachers'],
    queryFn: () => listTimetableTeachers(),
  });
  const { data: assignments = [], isLoading } = useQuery({ queryKey: ['exam-invigilators', examId], queryFn: () => listExamInvigilators(examId), enabled: Boolean(examId) });
  const autoAssignScope = {
    examPaperIds: examPaperId ? [examPaperId] : undefined,
    centerIds: centerId ? [centerId] : undefined,
  };

  const assignMutation = useMutation({
    mutationFn: () => assignExamInvigilator(examId, { examPaperId, teacherId, roomId }),
    onSuccess: () => {
      setTeacherId('');
      setCenterId('');
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

  const autoPreviewMutation = useMutation({
    mutationFn: () => autoAssignExamInvigilators(examId, { ...autoAssignScope, dryRun: true }),
    onSuccess: (result) => {
      setAutoPreview(result);
      notify.success('Preview ready', `${result.summary.planned} invigilator assignments prepared.`);
    },
    onError: (error: any) => notify.error('Auto assign failed', error?.response?.data?.error?.message || 'Unable to prepare invigilators.'),
  });

  const autoSaveMutation = useMutation({
    mutationFn: () => autoAssignExamInvigilators(examId, { ...autoAssignScope, dryRun: false }),
    onSuccess: (result) => {
      setAutoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['exam-invigilators', examId] });
      notify.success('Invigilators assigned', `${result.summary.planned} assignments were saved.`);
    },
    onError: (error: any) => notify.error('Auto assign failed', error?.response?.data?.error?.message || 'Unable to save invigilators.'),
  });

  const handleAssign = () => {
    if (!examId || !examPaperId || !teacherId || !centerId || !roomId) {
      notify.error('Missing selection', 'Select exam, paper/date, invigilator, center, and room.');
      return;
    }
    assignMutation.mutate();
  };

  const handleAutoPreview = () => {
    if (!examId) {
      notify.error('Select exam', 'Choose an exam before auto assigning invigilators.');
      return;
    }
    setAutoPreview(null);
    autoPreviewMutation.mutate();
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <div className="mx-auto max-w-7xl pr-6">
        <PageHeader title="Exam Invigilators" subtitle="Assign active employees to exam rooms and prevent double booking." />
        <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-6">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setExamPaperId('');
                setTeacherId('');
                setCenterId('');
                setRoomId('');
                setAutoPreview(null);
              }}
            >
              <option value="">Select exam</option>
              {exams.map((exam: any) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={examPaperId}
              onChange={(e) => {
                setExamPaperId(e.target.value);
                setAutoPreview(null);
              }}
              disabled={!examId}
            >
              <option value="">{!examId ? 'Select exam first' : examLoading ? 'Loading papers...' : 'Select paper/date'}</option>
              {(selectedExam?.papers ?? []).map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.subject?.name ?? 'Subject'} - {formatPaperDate(paper.scheduledAt ?? selectedExam?.scheduledAt)}
                </option>
              ))}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">{teachersLoading ? 'Loading teachers...' : 'Select invigilator'}</option>
              {teachers?.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {`${teacher.firstName} ${teacher.lastName}`.trim()} {teacher.employeeNo ? `(${teacher.employeeNo})` : ''}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={centerId}
              onChange={(e) => {
                setCenterId(e.target.value);
                setRoomId('');
                setAutoPreview(null);
              }}
            >
              <option value="">{centersLoading ? 'Loading centers...' : 'Select center'}</option>
              {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select>
            <select className="rounded-lg border px-3 py-2 text-sm" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">{!centerId ? 'Select center first' : roomsLoading ? 'Loading rooms...' : 'Select room'}</option>
              {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
            <Button onClick={handleAssign} loading={assignMutation.isPending}>Assign</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            <Button variant="outline" onClick={handleAutoPreview} loading={autoPreviewMutation.isPending}>Preview Auto Assign</Button>
            {autoPreview ? (
              <Button onClick={() => autoSaveMutation.mutate()} loading={autoSaveMutation.isPending} disabled={!autoPreview.summary.planned}>
                Save Auto Assignments
              </Button>
            ) : null}
            <p className="text-xs text-gray-500">Uses selected paper and center if chosen; otherwise covers all dated papers and active rooms.</p>
          </div>
        </section>
        {autoPreview ? (
          <section className="mb-4 rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Auto Assign Preview</h2>
                <p className="text-sm text-gray-500">
                  {autoPreview.summary.planned} planned · {autoPreview.summary.skippedExisting} skipped existing · {autoPreview.summary.warnings} warnings
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setAutoPreview(null)}>Clear Preview</Button>
            </div>
            {autoPreview.warnings.length ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {autoPreview.warnings.slice(0, 5).map((warning) => <p key={warning}>{warning}</p>)}
                {autoPreview.warnings.length > 5 ? <p>+{autoPreview.warnings.length - 5} more warnings</p> : null}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {autoPreview.assignments.slice(0, 12).map((entry) => (
                <div key={`${entry.examPaperId}-${entry.roomId}`} className="rounded-md border p-3 text-sm">
                  <div className="font-medium text-gray-900">{entry.subjectName} - {formatPaperDate(entry.scheduledAt)}</div>
                  <div className="text-gray-600">{entry.centerName} / {entry.roomName}</div>
                  <div className="text-gray-500">{entry.teacherName}{entry.employeeNo ? ` (${entry.employeeNo})` : ''}</div>
                </div>
              ))}
            </div>
            {autoPreview.assignments.length > 12 ? <p className="mt-2 text-xs text-gray-500">Showing first 12 of {autoPreview.assignments.length} planned assignments.</p> : null}
          </section>
        ) : null}
        <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="p-3">Paper</th><th className="p-3">Invigilator</th><th className="p-3">Center</th><th className="p-3">Room</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-4" colSpan={5}>Loading assignments...</td></tr> : null}
              {!examId ? <tr><td className="p-4 text-gray-500" colSpan={5}>Select an exam to view invigilators.</td></tr> : null}
              {examId && !isLoading && !assignments.length ? <tr><td className="p-4 text-gray-500" colSpan={5}>No invigilators assigned.</td></tr> : null}
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-t">
                  <td className="p-3"><div className="font-medium">{assignment.examPaper?.subject?.name ?? '-'}</div><div className="text-xs text-gray-500">{formatPaperDate(assignment.examPaper?.scheduledAt)}</div></td>
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
