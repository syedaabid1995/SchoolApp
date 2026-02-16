'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listSections, listSubjects } from '../../../../services/academic.service';
import { listExams, getExam, listMarks, uploadMarks } from '../../../../services/report.service';
import { getSession } from '../../../../services/auth.service';
import { listStudents, Student } from '../../../../services/student.service';
import { useNotify } from '../../../../components/NotificationProvider';
import PageHeader from '../../../../components/PageHeader';
import Button from '../../../../components/Button';

type ExamPaper = {
  id: string;
  subjectId: string;
  maxMarks: number;
  passMarks: number;
};

type MarksRow = {
  studentId: string;
  rollNo: string;
  name: string;
  marks: string;
  absent: boolean;
  remarks: string;
};

const gradeFor = (marks: number, maxMarks: number) => {
  if (!Number.isFinite(marks) || maxMarks <= 0) return '—';
  const percent = (marks / maxMarks) * 100;
  if (percent >= 90) return 'A+';
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'E';
};

export default function MarksUploadPage() {
  const notify = useNotify();
  const [filters, setFilters] = useState({
    academicYearId: '',
    examId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    component: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [marksRows, setMarksRows] = useState<MarksRow[]>([]);
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'LOCKED'>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');
  const [formError, setFormError] = useState('');

  const { data: session } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const role = session?.role ?? 'TEACHER';
  const canEditAfterSubmit = role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';
  const canLock = role === 'SCHOOL_ADMIN' || role === 'SUPER_ADMIN';
  const effectiveSchoolId = session?.schoolId ?? undefined;

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
  const { data: exams } = useQuery({ queryKey: ['exams'], queryFn: listExams });

  const { data: selectedExam } = useQuery({
    queryKey: ['exam', filters.examId],
    queryFn: () => getExam(filters.examId),
    enabled: Boolean(filters.examId),
  });

  const examPapers = (selectedExam?.papers ?? []) as ExamPaper[];
  const examClassId = selectedExam?.classId ?? '';
  const examAcademicYearId = selectedExam?.academicYearId ?? '';

  useEffect(() => {
    if (!loaded) return;
    setLoaded(false);
    setMarksRows([]);
    setStatus('DRAFT');
    setBulkOpen(false);
    setBulkFileName('');
    setFormError('');
  }, [filters.examId, filters.classId, filters.sectionId, filters.subjectId, filters.component]);

  useEffect(() => {
    if (!selectedExam) return;
    setFilters((prev) => ({
      ...prev,
      classId: selectedExam.classId ?? prev.classId,
      academicYearId: selectedExam.academicYearId ?? prev.academicYearId,
    }));
  }, [selectedExam]);

  const subjectLookup = useMemo(() => {
    const map = new Map<string, string>();
    (subjects ?? []).forEach((subject: { id: string; name: string }) => map.set(subject.id, subject.name));
    return map;
  }, [subjects]);

  const mappedSubjects = useMemo(() => {
    return examPapers
      .map((paper) => ({
        id: paper.subjectId,
        name: subjectLookup.get(paper.subjectId) ?? '—',
      }))
      .filter((entry) => entry.id);
  }, [examPapers, subjectLookup]);

  const selectedPaper = examPapers.find((paper) => paper.subjectId === filters.subjectId);
  const maxMarks = selectedPaper?.maxMarks ?? 100;

  const sectionOptions = useMemo(() => {
    return (sections ?? []).filter((section: { classId: string }) => section.classId === filters.classId);
  }, [sections, filters.classId]);

  const loadStudents = async () => {
    let error = '';
    if (!filters.examId) error = 'Select an exam.';
    else if (!filters.classId) error = 'Select a class.';
    else if (!filters.subjectId) error = 'Select a subject.';
    setFormError(error);
    if (error) {
      notify.error('Validation error', error);
      return;
    }
    const students = await listStudents({ schoolId: effectiveSchoolId });
    const filtered = (students ?? []).filter((student: Student) => {
      if (filters.classId && student.classId !== filters.classId) return false;
      if (filters.sectionId && student.sectionId !== filters.sectionId) return false;
      return true;
    });
    const rows: MarksRow[] = filtered.map((student) => ({
      studentId: student.id,
      rollNo: student.admissionNo,
      name: `${student.firstName} ${student.lastName}`.trim(),
      marks: '',
      absent: false,
      remarks: '',
    }));
    let nextStatus: 'DRAFT' | 'SUBMITTED' | 'LOCKED' = 'DRAFT';
    if (selectedPaper?.id) {
      const existing = await listMarks({ examPaperId: selectedPaper.id });
      const statusSet = new Set((existing ?? []).map((entry: { status: 'DRAFT' | 'SUBMITTED' | 'LOCKED' }) => entry.status));
      if (statusSet.has('LOCKED')) nextStatus = 'LOCKED';
      else if (statusSet.has('SUBMITTED')) nextStatus = 'SUBMITTED';
      const markMap = new Map(
        (existing ?? []).map((entry: { studentId: string; marks: number }) => [entry.studentId, entry]),
      );
      rows.forEach((row) => {
        const entry = markMap.get(row.studentId);
        if (entry && typeof entry === 'object' && 'marks' in entry) {
          row.marks = Number.isFinite(entry.marks) ? String(entry.marks) : '';
        }
      });
    }
    setMarksRows(rows);
    setLoaded(true);
    setStatus(nextStatus);
    setFormError('');
    notify.success('Students loaded', 'Marks are ready to enter.');
  };

  const handleExamChange = (examId: string) => {
    setFilters((prev) => ({
      ...prev,
      examId,
      subjectId: '',
      classId: '',
      sectionId: '',
      academicYearId: prev.academicYearId,
    }));
  };

  const setRow = (studentId: string, patch: Partial<MarksRow>) => {
    setMarksRows((prev) =>
      prev.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row)),
    );
  };

  const completedCount = marksRows.filter((row) => row.absent || row.marks.trim() !== '').length;
  const absentCount = marksRows.filter((row) => row.absent).length;
  const pendingCount = marksRows.length - completedCount;

  const examTitle = [
    exams?.find((exam: { id: string; name: string }) => exam.id === filters.examId)?.name,
    classes?.find((cls: { id: string; name: string }) => cls.id === filters.classId)?.name,
    subjectLookup.get(filters.subjectId),
  ]
    .filter(Boolean)
    .join(' • ');

  const downloadTemplate = () => {
    const header = 'Roll No,Student Name,Marks,Absent (Y/N)\n';
    const rows = marksRows
      .map((row) => `${row.rollNo},"${row.name}",,`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'marks-upload-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const saveMarks = async (nextStatus: 'DRAFT' | 'SUBMITTED' | 'LOCKED') => {
    if (!selectedPaper?.id) return;
    if (!marksRows.length) {
      const message = 'Load students before saving marks.';
      setFormError(message);
      notify.error('Validation error', message);
      return;
    }
    setSaving(true);
    try {
      const payload = marksRows
        .filter((row) => row.marks.trim() !== '' && !row.absent)
        .map((row) => ({ studentId: row.studentId, score: Number(row.marks) }));
      const hasAbsent = marksRows.some((row) => row.absent);
      if (!payload.length && !hasAbsent) {
        const message = 'Enter at least one mark before saving.';
        setFormError(message);
        notify.error('Validation error', message);
        return;
      }
      await uploadMarks({ examPaperId: selectedPaper.id, marks: payload, status: nextStatus });
      setStatus(nextStatus);
      setFormError('');
      const label = nextStatus === 'DRAFT' ? 'Draft saved' : nextStatus === 'SUBMITTED' ? 'Marks submitted' : 'Marks locked';
      notify.success(label, 'Marks updated successfully.');
    } finally {
      setSaving(false);
    }
  };

  const submitWithConfirm = async () => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm('Submit marks now? You can only edit after submission if you are an admin.');
    if (confirmed) {
      await saveMarks('SUBMITTED');
    }
  };

  const stats = {
    total: marksRows.length,
    completed: completedCount,
    absent: absentCount,
    pending: pendingCount,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40">
      <div className="mx-auto max-w-7xl pr-6 pb-12">
        <PageHeader
          title="Upload Marks"
          subtitle="Enter and manage student marks for exams with comprehensive grading and assessment tools."
        />
        {/* Stats Cards */}
        {loaded && (
          <div className="mb-8 grid gap-6 md:grid-cols-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100">Total Students</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <div className="rounded-full bg-white/20 p-3">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100">Marks Entered</p>
                  <p className="text-3xl font-bold">{stats.completed}</p>
                </div>
                <div className="rounded-full bg-white/20 p-3">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100">Absent</p>
                  <p className="text-3xl font-bold">{stats.absent}</p>
                </div>
                <div className="rounded-full bg-white/20 p-3">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl bg-gradient-to-br from-red-500 to-red-600 p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100">Pending</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <div className="rounded-full bg-white/20 p-3">
                  <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Context Selection */}
        <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">Select Context</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Academic Year</label>
              <select
                value={filters.academicYearId || examAcademicYearId}
                onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                disabled={Boolean(examAcademicYearId)}
              >
                <option value="">Select academic year...</option>
                {years?.map((year: { id: string; name: string }) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Exam</label>
              <select
                value={filters.examId}
                onChange={(e) => handleExamChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Select exam...</option>
                {exams?.map((exam: { id: string; name: string }) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Class</label>
              <select
                value={examClassId || filters.classId}
                onChange={(e) => setFilters({ ...filters, classId: e.target.value, sectionId: '' })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                disabled={Boolean(examClassId)}
              >
                <option value="">Select class...</option>
                {(examClassId
                  ? classes?.filter((cls: { id: string }) => cls.id === examClassId)
                  : classes
                )?.map((cls: { id: string; name: string }) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Section</label>
              <select
                value={filters.sectionId}
                onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Select section...</option>
                {sectionOptions.map((section: { id: string; name: string }) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Subject</label>
              <select
                value={filters.subjectId}
                onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Select subject...</option>
                {mappedSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Component (Optional)</label>
              <select
                value={filters.component}
                onChange={(e) => setFilters({ ...filters, component: e.target.value })}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              >
                <option value="">Select component...</option>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
                <option value="PRACTICAL">Practical</option>
              </select>
            </div>
          </div>
          <div className="mt-6">
            <Button
              variant="primary"
              onClick={loadStudents}
              icon={
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              }
            >
              Load Students
            </Button>
          </div>
        </section>

        {/* Marks Entry Table */}
        {loaded && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-200">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{examTitle || 'Marks Entry'}</h2>
                <p className="text-sm text-gray-500">Max Marks: {maxMarks}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  status === 'LOCKED' 
                    ? 'bg-red-100 text-red-800' 
                    : status === 'SUBMITTED' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {status}
                </span>
                {status !== 'LOCKED' ? (
                  <button
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    onClick={() => setBulkOpen(true)}
                  >
                    <div className="flex items-center">
                      <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Upload Excel
                    </div>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Roll No</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Student Name</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Max Marks</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Marks Obtained</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Grade</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Absent</th>
                    <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {marksRows.map((row) => {
                    const marksValue = Number(row.marks);
                    const grade = row.absent ? 'AB' : row.marks.trim() ? gradeFor(marksValue, maxMarks) : '—';
                    return (
                      <tr key={row.studentId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.rollNo}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{row.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{maxMarks}</td>
                        <td className="px-6 py-4">
                          <input
                            value={row.marks}
                            onChange={(e) => setRow(row.studentId, { marks: e.target.value })}
                            disabled={row.absent || status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:bg-gray-100"
                            inputMode="numeric"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            grade === 'AB' ? 'bg-red-100 text-red-800' :
                            grade === 'A+' || grade === 'A' ? 'bg-green-100 text-green-800' :
                            grade === 'B' || grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                            grade === 'D' || grade === 'E' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={row.absent}
                            onChange={(e) => setRow(row.studentId, { absent: e.target.checked, marks: '' })}
                            disabled={status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            value={row.remarks}
                            onChange={(e) => setRow(row.studentId, { remarks: e.target.value })}
                            disabled={status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                            className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:bg-gray-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4">
                <div className="grid grid-cols-2 gap-6 text-sm md:grid-cols-4">
                  <div>
                    <span className="font-medium text-gray-900">Total Students:</span>
                    <span className="ml-2 text-gray-600">{marksRows.length}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Marks Entered:</span>
                    <span className="ml-2 text-gray-600">{completedCount}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Absent:</span>
                    <span className="ml-2 text-gray-600">{absentCount}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Pending:</span>
                    <span className="ml-2 text-gray-600">{pendingCount}</span>
                  </div>
                </div>
              </div>
              {status !== 'LOCKED' ? (
                <div className="flex gap-3">
                  <button
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => saveMarks('DRAFT')}
                    disabled={saving}
                  >
                    {saving && status === 'DRAFT' ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    className="rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    onClick={submitWithConfirm}
                    disabled={saving}
                  >
                    Submit Marks
                  </button>
                  {canLock && (
                    <button
                      className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
                      onClick={() => saveMarks('LOCKED')}
                      disabled={saving}
                    >
                      Lock Marks
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        )}

        {/* Bulk Upload Modal */}
        {bulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Bulk Upload Marks</h3>
                <button 
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  onClick={() => setBulkOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-blue-800">Step 1: Download Template</h4>
                      <p className="mt-1 text-sm text-blue-700">Download the Excel template with student data pre-filled.</p>
                      <button
                        className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        onClick={downloadTemplate}
                      >
                        <div className="flex items-center">
                          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Template
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800">Step 2: Upload Completed File</h4>
                      <p className="mt-1 text-sm text-green-700">Fill in the marks and upload the completed Excel file.</p>
                      <input
                        type="file"
                        accept=".xls,.xlsx,.csv"
                        onChange={(e) => setBulkFileName(e.target.files?.[0]?.name ?? '')}
                        className="mt-3 block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-green-700"
                      />
                      {bulkFileName && (
                        <p className="mt-2 text-sm text-green-600">Selected: {bulkFileName}</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <h4 className="text-sm font-medium text-gray-800">Step 3: Preview & Confirm</h4>
                  <div className="mt-3 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                    <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Data preview will appear here after file upload</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setBulkOpen(false)}
                >
                  Cancel
                </button>
                <button className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:from-green-700 hover:to-emerald-700">
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
