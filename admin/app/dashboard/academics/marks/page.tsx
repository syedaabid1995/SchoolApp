'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAcademicYears, listClasses, listSections, listSubjects } from '../../../../services/academic.service';
import { listExams, getExam, listMarks, uploadMarks } from '../../../../services/report.service';
import { getSession } from '../../../../services/auth.service';
import { listStudents, Student } from '../../../../services/student.service';

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
    if (!effectiveSchoolId || !filters.classId || !filters.examId || !filters.subjectId) return;
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
      const markMap = new Map((existing ?? []).map((entry: { studentId: string; marks: number }) => [entry.studentId, entry]));
      rows.forEach((row) => {
        const entry = markMap.get(row.studentId);
        if (entry) {
          row.marks = Number.isFinite(entry.marks) ? String(entry.marks) : '';
        }
      });
    }
    setMarksRows(rows);
    setLoaded(true);
    setStatus(nextStatus);
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
    setSaving(true);
    try {
      const payload = marksRows
        .filter((row) => row.marks.trim() !== '' && !row.absent)
        .map((row) => ({ studentId: row.studentId, score: Number(row.marks) }));
      await uploadMarks({ examPaperId: selectedPaper.id, marks: payload, status: nextStatus });
      setStatus(nextStatus);
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">Upload Marks</h1>
        <p className="text-sm text-slate">Select context and enter marks for the mapped subjects.</p>
      </header>

      <section className="rounded-2xl border border-slate/10 bg-white p-6">
        <h2 className="text-lg font-semibold">Select Context</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            value={filters.academicYearId || examAcademicYearId}
            onChange={(e) => setFilters({ ...filters, academicYearId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            disabled={Boolean(examAcademicYearId)}
          >
            <option value="">Academic Year</option>
            {years?.map((year: { id: string; name: string }) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
          <select
            value={filters.examId}
            onChange={(e) => handleExamChange(e.target.value)}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Exam</option>
            {exams?.map((exam: { id: string; name: string }) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
          <select
            value={examClassId || filters.classId}
            onChange={(e) => setFilters({ ...filters, classId: e.target.value, sectionId: '' })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
            disabled={Boolean(examClassId)}
          >
            <option value="">Class</option>
            {(examClassId
              ? classes?.filter((cls: { id: string }) => cls.id === examClassId)
              : classes
            )?.map((cls: { id: string; name: string }) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          <select
            value={filters.sectionId}
            onChange={(e) => setFilters({ ...filters, sectionId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Section</option>
            {sectionOptions.map((section: { id: string; name: string }) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <select
            value={filters.subjectId}
            onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Subject (mapped to exam)</option>
            {mappedSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          <select
            value={filters.component}
            onChange={(e) => setFilters({ ...filters, component: e.target.value })}
            className="rounded-lg border border-slate/20 px-3 py-2 text-sm"
          >
            <option value="">Exam Component (optional)</option>
            <option value="INTERNAL">Internal</option>
            <option value="EXTERNAL">External</option>
            <option value="PRACTICAL">Practical</option>
          </select>
        </div>
        <button
          className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          onClick={loadStudents}
          disabled={!filters.examId || !filters.classId || !filters.subjectId}
        >
          Load Students
        </button>
      </section>

      {loaded ? (
        <section className="rounded-2xl border border-slate/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{examTitle || 'Marks Entry'}</h2>
              <p className="text-xs text-slate">Max Marks: {maxMarks}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold text-slate">
                {status}
              </span>
              <button
                className="rounded-lg border border-slate/20 px-3 py-1.5 text-xs font-semibold"
                onClick={() => setBulkOpen(true)}
              >
                Upload via Excel
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate">
                <tr>
                  <th className="py-2">Roll No</th>
                  <th>Student Name</th>
                  <th>Max Marks</th>
                  <th>Marks Obtained</th>
                  <th>Grade</th>
                  <th>Absent</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {marksRows.map((row) => {
                  const marksValue = Number(row.marks);
                  const grade = row.absent ? 'AB' : row.marks.trim() ? gradeFor(marksValue, maxMarks) : '—';
                  return (
                    <tr key={row.studentId} className="border-t border-slate/10">
                      <td className="py-2">{row.rollNo}</td>
                      <td>{row.name}</td>
                      <td>{maxMarks}</td>
                      <td>
                        <input
                          value={row.marks}
                          onChange={(e) => setRow(row.studentId, { marks: e.target.value })}
                          disabled={row.absent || status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                          className="w-24 rounded-md border border-slate/20 px-2 py-1 text-sm"
                          inputMode="numeric"
                        />
                      </td>
                      <td className="text-slate">{grade}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.absent}
                          onChange={(e) => setRow(row.studentId, { absent: e.target.checked, marks: '' })}
                          disabled={status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.remarks}
                          onChange={(e) => setRow(row.studentId, { remarks: e.target.value })}
                          disabled={status === 'LOCKED' || (status === 'SUBMITTED' && !canEditAfterSubmit)}
                          className="w-40 rounded-md border border-slate/20 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-xl border border-slate/10 bg-sand px-4 py-3 text-xs text-slate">
              <div className="flex gap-4">
                <span>Total Students: {marksRows.length}</span>
                <span>Marks Entered: {completedCount}</span>
                <span>Absent: {absentCount}</span>
                <span>Pending: {pendingCount}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={() => saveMarks('DRAFT')}
                disabled={saving}
              >
                {saving && status === 'DRAFT' ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                className="rounded-lg border border-slate/20 px-4 py-2 text-sm"
                onClick={submitWithConfirm}
                disabled={saving}
              >
                Submit Marks
              </button>
              {canLock ? (
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => saveMarks('LOCKED')}
                  disabled={saving}
                >
                  Lock Marks
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Bulk Upload</h3>
              <button className="text-sm text-slate" onClick={() => setBulkOpen(false)}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="font-semibold text-ink">Step 1: Download Template</p>
                <button
                  className="mt-2 rounded-lg border border-slate/20 px-3 py-2 text-xs font-semibold"
                  onClick={downloadTemplate}
                >
                  Download Sample Excel
                </button>
              </div>
              <div>
                <p className="font-semibold text-ink">Step 2: Upload File</p>
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={(e) => setBulkFileName(e.target.files?.[0]?.name ?? '')}
                  className="mt-2 text-xs"
                />
                {bulkFileName ? (
                  <p className="mt-2 text-xs text-slate">Selected: {bulkFileName}</p>
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-ink">Step 3: Preview Data</p>
                <div className="mt-2 rounded-lg border border-dashed border-slate/20 bg-sand px-4 py-6 text-xs text-slate">
                  Preview will appear here after upload.
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-lg border border-slate/20 px-4 py-2 text-sm" onClick={() => setBulkOpen(false)}>
                Cancel
              </button>
              <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">
                Confirm &amp; Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
