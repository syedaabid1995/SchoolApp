import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import { calculateGrade, evaluateFailCriteria, getExamGradingSettings } from './grade.service';
import type { StudentDailyAttendance } from '../modules/attendance/models/attendance-read-model';
import { timetableReadService } from '../modules/timetable/services/timetable-read.service';

export const generateTermReport = async (params: {
  schoolId: string;
  studentId: string;
  termId: string;
}) => {
  const { schoolId, studentId, termId } = params;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const term = await prisma.term.findFirst({
    where: { id: termId, academicYear: { schoolId } },
  });

  if (!term) {
    throw new HttpError(404, 'Term not found');
  }

  const marks = await prisma.mark.findMany({
    where: {
      studentId,
      examPaper: { exam: { termId } },
    },
    include: {
      examPaper: { include: { subject: true, exam: true } },
    },
  });
  const gradingSettings = await getExamGradingSettings(schoolId);
  const evaluation = evaluateFailCriteria(
    marks.map((mark) => ({ marks: mark.marks, maxMarks: mark.examPaper.maxMarks })),
    gradingSettings.failCriteria,
  );

  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(18).text('Term Report Card', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Student: ${student.firstName} ${student.lastName}`);
  doc.text(`Term: ${term.name}`);
  doc.text(`Result: ${evaluation.status}`);
  doc.moveDown();

  doc.fontSize(12).text('Subject', 50, doc.y, { continued: true });
  doc.text('Exam', 250, doc.y, { continued: true });
  doc.text('Marks', 400, doc.y, { continued: true });
  doc.text('Grade', 470, doc.y);
  doc.moveDown();

  marks.forEach((mark) => {
    doc.text(mark.examPaper.subject.name, 50, doc.y, { continued: true });
    doc.text(mark.examPaper.exam.name, 250, doc.y, { continued: true });
    doc.text(mark.marks.toFixed(2), 400, doc.y, { continued: true });
    doc.text(mark.grade ?? '-', 470, doc.y);
  });

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

export const generateAnnualReport = async (params: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
}) => {
  const { schoolId, studentId, academicYearId } = params;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
  });

  if (!student) {
    throw new HttpError(404, 'Student not found');
  }

  const academicYear = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
  });

  if (!academicYear) {
    throw new HttpError(404, 'Academic year not found');
  }

  const marks = await prisma.mark.findMany({
    where: {
      studentId,
      examPaper: { exam: { academicYearId } },
    },
    include: {
      examPaper: { include: { subject: true, exam: true } },
    },
  });
  const gradingSettings = await getExamGradingSettings(schoolId);
  const evaluation = evaluateFailCriteria(
    marks.map((mark) => ({ marks: mark.marks, maxMarks: mark.examPaper.maxMarks })),
    gradingSettings.failCriteria,
  );

  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(18).text('Annual Report Card', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Student: ${student.firstName} ${student.lastName}`);
  doc.text(`Academic Year: ${academicYear.name}`);
  doc.text(`Result: ${evaluation.status}`);
  doc.moveDown();

  doc.fontSize(12).text('Subject', 50, doc.y, { continued: true });
  doc.text('Exam', 250, doc.y, { continued: true });
  doc.text('Marks', 400, doc.y, { continued: true });
  doc.text('Grade', 470, doc.y);
  doc.moveDown();

  marks.forEach((mark) => {
    doc.text(mark.examPaper.subject.name, 50, doc.y, { continued: true });
    doc.text(mark.examPaper.exam.name, 250, doc.y, { continued: true });
    doc.text(mark.marks.toFixed(2), 400, doc.y, { continued: true });
    doc.text(mark.grade ?? '-', 470, doc.y);
  });

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

type RankSummary = {
  studentId: string;
  total: number;
  maxTotal: number;
  percentage: number;
  classId: string | null;
  sectionId: string | null;
};

const calculateRanks = (rows: RankSummary[], target: RankSummary) => {
  const sortedByClass = rows
    .filter((row) => row.classId && row.classId === target.classId)
    .sort((a, b) => b.percentage - a.percentage || b.total - a.total);
  const sortedBySection = rows
    .filter((row) => row.sectionId && row.sectionId === target.sectionId)
    .sort((a, b) => b.percentage - a.percentage || b.total - a.total);

  const rankOf = (sorted: RankSummary[]) => {
    let rank = 0;
    let previous: RankSummary | null = null;
    return sorted.findIndex((row, index) => {
      if (!previous || row.percentage !== previous.percentage || row.total !== previous.total) {
        rank = index + 1;
      }
      previous = row;
      return row.studentId === target.studentId;
    }) >= 0
      ? rank
      : null;
  };

  return {
    classRank: rankOf(sortedByClass),
    sectionRank: rankOf(sortedBySection),
    classSize: sortedByClass.length,
    sectionSize: sortedBySection.length,
  };
};

export const generateRankCard = async (params: {
  schoolId: string;
  examId: string;
  studentId: string;
}) => {
  const { schoolId, examId, studentId } = params;

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { academicYear: true, term: true, class: true, section: true },
  });
  if (!exam) throw new HttpError(404, 'Exam not found');

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { class: true, section: true },
  });
  if (!student) throw new HttpError(404, 'Student not found');

  const marks = await prisma.mark.findMany({
    where: { studentId, examPaper: { examId } },
    include: { examPaper: { include: { subject: true } } },
    orderBy: { examPaper: { subject: { name: 'asc' } } },
  });
  if (!marks.length) throw new HttpError(404, 'No marks found for this student and exam');

  const allMarks = await prisma.mark.findMany({
    where: { examPaper: { examId } },
    include: { student: true, examPaper: true },
  });
  const gradingSettings = await getExamGradingSettings(schoolId);

  const summariesByStudent = new Map<string, RankSummary>();
  for (const mark of allMarks) {
    const existing = summariesByStudent.get(mark.studentId) ?? {
      studentId: mark.studentId,
      total: 0,
      maxTotal: 0,
      percentage: 0,
      classId: mark.student.classId,
      sectionId: mark.student.sectionId,
    };
    existing.total += mark.marks;
    existing.maxTotal += mark.examPaper.maxMarks;
    existing.percentage = existing.maxTotal > 0 ? (existing.total / existing.maxTotal) * 100 : 0;
    summariesByStudent.set(mark.studentId, existing);
  }

  const targetSummary = summariesByStudent.get(studentId);
  if (!targetSummary) throw new HttpError(404, 'Rank data not found');

  const evaluation = evaluateFailCriteria(
    marks.map((mark) => ({ marks: mark.marks, maxMarks: mark.examPaper.maxMarks })),
    gradingSettings.failCriteria,
  );
  const grade = calculateGrade(targetSummary.total, targetSummary.maxTotal, gradingSettings.gradeScale);
  const ranks = calculateRanks(Array.from(summariesByStudent.values()), targetSummary);

  const doc = new PDFDocument({ margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  doc.fontSize(18).text('Rank Card', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Student: ${student.fullName || `${student.firstName} ${student.lastName}`}`);
  doc.text(`Admission No: ${student.admissionNo}`);
  doc.text(`Class: ${student.class?.name ?? exam.class?.name ?? 'N/A'}`);
  doc.text(`Section: ${student.section?.name ?? exam.section?.name ?? 'N/A'}`);
  doc.text(`Exam: ${exam.name}`);
  doc.text(`Academic Year: ${exam.academicYear.name}`);
  if (exam.term) doc.text(`Term: ${exam.term.name}`);
  doc.moveDown();
  doc.text(`Total: ${targetSummary.total.toFixed(2)} / ${targetSummary.maxTotal.toFixed(2)}`);
  doc.text(`Percentage: ${targetSummary.percentage.toFixed(2)}%`);
  doc.text(`Grade: ${grade}`);
  doc.text(`Result: ${evaluation.status}`);
  doc.text(`Class Rank: ${ranks.classRank ?? 'N/A'}${ranks.classSize ? ` of ${ranks.classSize}` : ''}`);
  doc.text(`Section Rank: ${ranks.sectionRank ?? 'N/A'}${ranks.sectionSize ? ` of ${ranks.sectionSize}` : ''}`);
  doc.moveDown();

  doc.fontSize(12).text('Subject', 50, doc.y, { continued: true });
  doc.text('Marks', 280, doc.y, { continued: true });
  doc.text('Max', 360, doc.y, { continued: true });
  doc.text('Grade', 430, doc.y, { continued: true });
  doc.text('Status', 500, doc.y);
  doc.moveDown();

  marks.forEach((mark) => {
    doc.text(mark.examPaper.subject.name, 50, doc.y, { continued: true });
    doc.text(mark.marks.toFixed(2), 280, doc.y, { continued: true });
    doc.text(mark.examPaper.maxMarks.toFixed(2), 360, doc.y, { continued: true });
    doc.text(mark.grade ?? calculateGrade(mark.marks, mark.examPaper.maxMarks, gradingSettings.gradeScale), 430, doc.y, { continued: true });
    doc.text(mark.marks >= mark.examPaper.passMarks ? 'PASS' : 'FAIL', 500, doc.y);
  });

  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

export type ReportFormat = 'json' | 'csv' | 'pdf';
export type ReportFilterKey =
  | 'schoolId'
  | 'academicYearId'
  | 'classId'
  | 'sectionId'
  | 'studentId'
  | 'teacherId'
  | 'examId'
  | 'subjectId'
  | 'fromDate'
  | 'toDate'
  | 'status';

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportCatalogItem = {
  key: string;
  title: string;
  category: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  filters: ReportFilterKey[];
  formats: ReportFormat[];
  permission: string;
  columns: ReportColumn[];
};

export type ReportQuery = {
  schoolId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  studentId?: string;
  teacherId?: string;
  examId?: string;
  subjectId?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string;
  page: number;
  pageSize: number;
};

type ReportResult = {
  rows: Record<string, unknown>[];
  total: number;
};

type ReportDefinition = ReportCatalogItem & {
  fetch?: (query: ReportQuery) => Promise<ReportResult>;
};

const dateRange = (field: string, query: ReportQuery) => ({
  ...(query.fromDate || query.toDate
    ? {
        [field]: {
          ...(query.fromDate ? { gte: query.fromDate } : {}),
          ...(query.toDate ? { lte: query.toDate } : {}),
        },
      }
    : {}),
});

const pageArgs = (query: ReportQuery) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});

const paginate = <T>(rows: T[], query: ReportQuery) => rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);

const dateFromKey = (date: string) => new Date(`${date}T00:00:00.000Z`);

const filterStatus = <T extends { status: string }>(records: T[], status?: string) =>
  status ? records.filter((record) => record.status === status) : records;

const loadStudentAttendanceLookups = async (schoolId: string, records: StudentDailyAttendance[]) => {
  const studentIds = [...new Set(records.map((record) => record.studentId))];
  const classIds = [...new Set(records.map((record) => record.classId).filter((id): id is string => Boolean(id)))];
  const sectionIds = [...new Set(records.map((record) => record.sectionId).filter((id): id is string => Boolean(id)))];

  const [students, classes, sections] = await Promise.all([
    studentIds.length
      ? prisma.student.findMany({
          where: { schoolId, id: { in: studentIds } },
          select: { id: true, admissionNo: true, firstName: true, lastName: true, fullName: true },
        })
      : Promise.resolve([]),
    classIds.length
      ? prisma.class.findMany({ where: { schoolId, id: { in: classIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    sectionIds.length
      ? prisma.section.findMany({ where: { schoolId, id: { in: sectionIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  return {
    students: new Map(students.map((student) => [student.id, student])),
    classes: new Map(classes.map((row) => [row.id, row])),
    sections: new Map(sections.map((row) => [row.id, row])),
  };
};

const toPlain = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'toString' in value) return String(value);
  return String(value);
};

const fullName = (entity?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null) =>
  entity?.fullName || [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') || '';

const summarizeExamResults = (marks: any[]) => {
  const byStudent = new Map<string, { student: any; total: number; maxTotal: number; failedSubjects: number }>();
  for (const mark of marks) {
    const summary = byStudent.get(mark.studentId) ?? { student: mark.student, total: 0, maxTotal: 0, failedSubjects: 0 };
    summary.total += mark.marks;
    summary.maxTotal += mark.examPaper.maxMarks;
    if (mark.marks < mark.examPaper.passMarks) summary.failedSubjects += 1;
    byStudent.set(mark.studentId, summary);
  }
  return Array.from(byStudent.values()).map((summary) => {
    const percentage = summary.maxTotal > 0 ? (summary.total / summary.maxTotal) * 100 : 0;
    return {
      studentId: summary.student.id,
      admissionNo: summary.student.admissionNo,
      studentName: fullName(summary.student),
      class: summary.student.class?.name ?? '',
      section: summary.student.section?.name ?? '',
      total: summary.total.toFixed(2),
      maxTotal: summary.maxTotal.toFixed(2),
      percentage: percentage.toFixed(2),
      failedSubjects: summary.failedSubjects,
      result: summary.failedSubjects > 0 ? 'FAIL' : 'PASS',
    };
  });
};

const unavailable = (
  key: string,
  title: string,
  category: string,
  description: string,
  unavailableReason: string,
  filters: ReportFilterKey[] = [],
): ReportDefinition => ({
  key,
  title,
  category,
  description,
  available: false,
  unavailableReason,
  filters,
  formats: [],
  permission: `reports.${category.toLowerCase()}.view`,
  columns: [],
});

const reports: ReportDefinition[] = [
  {
    key: 'students.list',
    title: 'Student List',
    category: 'Students',
    description: 'Students by class, section, and status.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.students.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'status', label: 'Status' },
      { key: 'parents', label: 'Linked Parents' },
    ],
    fetch: async (query) => {
      const where: Prisma.StudentWhereInput = {
        schoolId: query.schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.student.findMany({
          where,
          ...pageArgs(query),
          orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }, { rollNo: 'asc' }, { admissionNo: 'asc' }],
          include: { class: true, section: true, _count: { select: { parentLinks: true } } },
        }),
        prisma.student.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((student) => ({
          admissionNo: student.admissionNo,
          studentName: fullName(student),
          class: student.class?.name ?? '',
          section: student.section?.name ?? '',
          status: student.status,
          parents: student._count.parentLinks,
        })),
      };
    },
  },
  {
    key: 'students.parent_links',
    title: 'Student Parent Links',
    category: 'Students',
    description: 'Student and guardian mapping.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'studentId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.students.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'parentName', label: 'Parent' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
    fetch: async (query) => {
      const where: Prisma.StudentParentWhereInput = {
        student: {
          schoolId: query.schoolId,
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
          ...(query.studentId ? { id: query.studentId } : {}),
        },
      };
      const [rows, total] = await Promise.all([
        prisma.studentParent.findMany({
          where,
          ...pageArgs(query),
          orderBy: { createdAt: 'desc' },
          include: { student: { include: { class: true, section: true } }, parent: true },
        }),
        prisma.studentParent.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((link) => ({
          admissionNo: link.student.admissionNo,
          studentName: fullName(link.student),
          class: link.student.class?.name ?? '',
          section: link.student.section?.name ?? '',
          parentName: fullName(link.parent),
          phone: link.parent.phone ?? '',
          email: link.parent.email ?? '',
        })),
      };
    },
  },
  {
    key: 'parents.list',
    title: 'Parent List',
    category: 'Parents',
    description: 'Parents linked to students in the school.',
    available: true,
    filters: ['schoolId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.parents.view',
    columns: [
      { key: 'parentName', label: 'Parent' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'linkedStudents', label: 'Linked Students' },
      { key: 'portalUser', label: 'Portal User' },
    ],
    fetch: async (query) => {
      const where: Prisma.ParentProfileWhereInput = { links: { some: { student: { schoolId: query.schoolId } } } };
      const [rows, total] = await Promise.all([
        prisma.parentProfile.findMany({ where, ...pageArgs(query), orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], include: { user: true, _count: { select: { links: true } } } }),
        prisma.parentProfile.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((parent) => ({
          parentName: fullName(parent),
          phone: parent.phone ?? '',
          email: parent.email ?? parent.user?.email ?? '',
          linkedStudents: parent._count.links,
          portalUser: parent.userId ? 'Yes' : 'No',
        })),
      };
    },
  },
  {
    key: 'attendance.students.daily',
    title: 'Student Daily Attendance',
    category: 'Attendance',
    description: 'Daily student attendance records.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'studentId', 'fromDate', 'toDate', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.attendance.view',
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'status', label: 'Status' },
    ],
    fetch: async (query) => {
      const records = filterStatus(
        await attendanceReadService.getStudentAttendance({
          schoolId: query.schoolId,
          classId: query.classId,
          sectionId: query.sectionId,
          studentId: query.studentId,
          fromDate: query.fromDate,
          toDate: query.toDate,
          source: 'student-attendance',
        }),
        query.status,
      ).sort((a, b) => b.date.localeCompare(a.date));
      const rows = paginate(records, query);
      const lookups = await loadStudentAttendanceLookups(query.schoolId, rows);
      return {
        total: records.length,
        rows: rows.map((row) => ({
          date: dateFromKey(row.date),
          admissionNo: lookups.students.get(row.studentId)?.admissionNo ?? '',
          studentName: fullName(lookups.students.get(row.studentId)),
          class: row.classId ? lookups.classes.get(row.classId)?.name ?? '' : '',
          section: row.sectionId ? lookups.sections.get(row.sectionId)?.name ?? '' : '',
          status: row.status,
        })),
      };
    },
  },
  {
    key: 'exams.subject_marks',
    title: 'Subject-wise Marks',
    category: 'Exams',
    description: 'Marks by exam subject and student.',
    available: true,
    filters: ['schoolId', 'examId', 'subjectId', 'classId', 'sectionId', 'studentId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.exams.view',
    columns: [
      { key: 'exam', label: 'Exam' },
      { key: 'subject', label: 'Subject' },
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'marks', label: 'Marks' },
      { key: 'maxMarks', label: 'Max' },
      { key: 'grade', label: 'Grade' },
      { key: 'status', label: 'Status' },
    ],
    fetch: async (query) => {
      const where: Prisma.MarkWhereInput = {
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        student: {
          schoolId: query.schoolId,
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        },
        examPaper: {
          ...(query.examId ? { examId: query.examId } : {}),
          ...(query.subjectId ? { subjectId: query.subjectId } : {}),
          exam: { schoolId: query.schoolId },
        },
      };
      const [rows, total] = await Promise.all([
        prisma.mark.findMany({ where, ...pageArgs(query), orderBy: [{ createdAt: 'desc' }], include: { student: true, examPaper: { include: { exam: true, subject: true } } } }),
        prisma.mark.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((mark) => ({
          exam: mark.examPaper.exam.name,
          subject: mark.examPaper.subject.name,
          admissionNo: mark.student.admissionNo,
          studentName: fullName(mark.student),
          marks: mark.marks.toFixed(2),
          maxMarks: mark.examPaper.maxMarks.toFixed(2),
          grade: mark.grade ?? '',
          status: mark.status,
        })),
      };
    },
  },
  {
    key: 'exams.results',
    title: 'Exam Result Summary',
    category: 'Exams',
    description: 'Student totals and pass/fail summary for an exam.',
    available: true,
    filters: ['schoolId', 'examId', 'classId', 'sectionId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.exams.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'total', label: 'Total' },
      { key: 'maxTotal', label: 'Max Total' },
      { key: 'percentage', label: 'Percentage' },
      { key: 'failedSubjects', label: 'Failed Subjects' },
      { key: 'result', label: 'Result' },
    ],
    fetch: async (query) => {
      const where: Prisma.MarkWhereInput = {
        student: {
          schoolId: query.schoolId,
          ...(query.classId ? { classId: query.classId } : {}),
          ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        },
        examPaper: { exam: { schoolId: query.schoolId, ...(query.examId ? { id: query.examId } : {}) } },
      };
      const marks = await prisma.mark.findMany({ where, include: { student: { include: { class: true, section: true } }, examPaper: true } });
      const rows = summarizeExamResults(marks).sort((a, b) => Number(b.percentage) - Number(a.percentage));
      return { total: rows.length, rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
    },
  },
  {
    key: 'exams.failed_students',
    title: 'Failed Students',
    category: 'Exams',
    description: 'Students with one or more failed subjects.',
    available: true,
    filters: ['schoolId', 'examId', 'classId', 'sectionId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.exams.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'percentage', label: 'Percentage' },
      { key: 'failedSubjects', label: 'Failed Subjects' },
    ],
    fetch: async (query) => {
      const result = await getReportData('exams.results', query);
      const rows = result.rows.filter((row) => Number(row.failedSubjects) > 0);
      return { total: rows.length, rows: rows.slice(0, query.pageSize) };
    },
  },
  {
    key: 'staff.list',
    title: 'Staff List',
    category: 'Staff',
    description: 'Active and inactive staff profiles.',
    available: true,
    filters: ['schoolId', 'teacherId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.staff.view',
    columns: [
      { key: 'employeeNo', label: 'Employee No' },
      { key: 'staffName', label: 'Staff' },
      { key: 'role', label: 'Role' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      { key: 'active', label: 'Active' },
    ],
    fetch: async (query) => {
      const where: Prisma.TeacherProfileWhereInput = {
        schoolId: query.schoolId,
        ...(query.teacherId ? { id: query.teacherId } : {}),
        ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.teacherProfile.findMany({ where, ...pageArgs(query), orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }], include: { user: true } }),
        prisma.teacherProfile.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((staff) => ({
          employeeNo: staff.employeeNo,
          staffName: fullName(staff),
          role: staff.roleName,
          phone: staff.phone ?? '',
          email: staff.user?.email ?? '',
          active: staff.isActive ? 'Yes' : 'No',
        })),
      };
    },
  },
  {
    key: 'staff.teacher_onboarding',
    title: 'Teacher Onboarding Readiness',
    category: 'Staff',
    description: 'Teacher readiness state and checklist flags.',
    available: true,
    filters: ['schoolId', 'teacherId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.staff.view',
    columns: [
      { key: 'employeeNo', label: 'Employee No' },
      { key: 'teacherName', label: 'Teacher' },
      { key: 'readinessStatus', label: 'Readiness' },
      { key: 'accountCreated', label: 'Account' },
      { key: 'classAssigned', label: 'Class Assigned' },
      { key: 'subjectAssigned', label: 'Subject Assigned' },
      { key: 'timetableAssigned', label: 'Timetable' },
    ],
    fetch: async (query) => {
      const where: Prisma.TeacherOnboardingWhereInput = {
        schoolId: query.schoolId,
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.status ? { readinessStatus: query.status } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.teacherOnboarding.findMany({ where, ...pageArgs(query), orderBy: { updatedAt: 'desc' }, include: { teacher: true } }),
        prisma.teacherOnboarding.count({ where }),
      ]);
      return {
        total,
        rows: rows.map((row) => ({
          employeeNo: row.teacher.employeeNo,
          teacherName: fullName(row.teacher),
          readinessStatus: row.readinessStatus,
          accountCreated: row.accountCreated ? 'Yes' : 'No',
          classAssigned: row.classAssigned ? 'Yes' : 'No',
          subjectAssigned: row.subjectAssigned ? 'Yes' : 'No',
          timetableAssigned: row.timetableAssigned ? 'Yes' : 'No',
        })),
      };
    },
  },
  {
    key: 'academics.subject_assignments',
    title: 'Subject Assignments',
    category: 'Academics',
    description: 'Subjects assigned to class sections and teachers.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'teacherId', 'subjectId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.academics.view',
    columns: [
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'subject', label: 'Subject' },
      { key: 'teacher', label: 'Teacher' },
    ],
    fetch: async (query) => {
      const where: Prisma.AssignSubjectWhereInput = {
        schoolId: query.schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.assignSubject.findMany({ where, ...pageArgs(query), orderBy: [{ class: { name: 'asc' } }], include: { class: true, section: true, subject: true, teacher: true } }),
        prisma.assignSubject.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ class: row.class.name, section: row.section.name, subject: row.subject.name, teacher: fullName(row.teacher) })) };
    },
  },
  {
    key: 'homework.summary',
    title: 'Homework Summary',
    category: 'Homework',
    description: 'Homework by class, subject, and submission date.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'subjectId', 'fromDate', 'toDate'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.homework.view',
    columns: [
      { key: 'homeworkDate', label: 'Homework Date' },
      { key: 'submissionDate', label: 'Submission Date' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'subject', label: 'Subject' },
      { key: 'marks', label: 'Marks' },
      { key: 'evaluations', label: 'Evaluations' },
    ],
    fetch: async (query) => {
      const where: Prisma.HomeworkWhereInput = {
        schoolId: query.schoolId,
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...dateRange('homeworkDate', query),
      };
      const [rows, total] = await Promise.all([
        prisma.homework.findMany({ where, ...pageArgs(query), orderBy: { homeworkDate: 'desc' }, include: { class: true, section: true, subject: true, _count: { select: { evaluations: true } } } }),
        prisma.homework.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ homeworkDate: row.homeworkDate, submissionDate: row.submissionDate, class: row.class.name, section: row.section.name, subject: row.subject.name, marks: row.marks, evaluations: row._count.evaluations })) };
    },
  },
  {
    key: 'library.issued_books',
    title: 'Library Issued Books',
    category: 'Library',
    description: 'Issued and returned library books.',
    available: true,
    filters: ['schoolId', 'fromDate', 'toDate', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.library.view',
    columns: [
      { key: 'book', label: 'Book' },
      { key: 'bookNumber', label: 'Book No' },
      { key: 'member', label: 'Member' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'returnDate', label: 'Return Date' },
      { key: 'status', label: 'Status' },
    ],
    fetch: async (query) => {
      const where: Prisma.LibraryIssueWhereInput = { schoolId: query.schoolId, ...(query.status ? { status: query.status as any } : {}), ...dateRange('issueDate', query) };
      const [rows, total] = await Promise.all([
        prisma.libraryIssue.findMany({ where, ...pageArgs(query), orderBy: { issueDate: 'desc' }, include: { book: true, member: true } }),
        prisma.libraryIssue.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ book: row.book.title, bookNumber: row.book.bookNumber ?? '', member: row.member.fullName, issueDate: row.issueDate, returnDate: row.returnDate, status: row.status })) };
    },
  },
  {
    key: 'transport.assignments',
    title: 'Transport Assignments',
    category: 'Transport',
    description: 'Students assigned to transport routes and vehicles.',
    available: true,
    filters: ['schoolId', 'studentId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.transport.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'route', label: 'Route' },
      { key: 'vehicle', label: 'Vehicle' },
      { key: 'active', label: 'Active' },
    ],
    fetch: async (query) => {
      const where: Prisma.StudentTransportAssignmentWhereInput = { schoolId: query.schoolId, ...(query.studentId ? { studentId: query.studentId } : {}), ...(query.status ? { active: query.status === 'ACTIVE' } : {}) };
      const [rows, total] = await Promise.all([
        prisma.studentTransportAssignment.findMany({ where, ...pageArgs(query), orderBy: { assignedAt: 'desc' }, include: { student: true, route: true, vehicle: true } }),
        prisma.studentTransportAssignment.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ admissionNo: row.student.admissionNo, studentName: fullName(row.student), route: row.route.title, vehicle: row.vehicle?.vehicleNumber ?? '', active: row.active ? 'Yes' : 'No' })) };
    },
  },
  {
    key: 'fees.collection_summary',
    title: 'Fee Collection Summary',
    category: 'Fees',
    description: 'Read-only invoice collection status.',
    available: true,
    filters: ['schoolId', 'academicYearId', 'classId', 'sectionId', 'studentId', 'status', 'fromDate', 'toDate'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.fees.view',
    columns: [
      { key: 'invoiceNumber', label: 'Invoice' },
      { key: 'studentName', label: 'Student' },
      { key: 'totalAmount', label: 'Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'dueAmount', label: 'Due' },
      { key: 'status', label: 'Status' },
      { key: 'issueDate', label: 'Issue Date' },
    ],
    fetch: async (query) => {
      const where: Prisma.FeeInvoiceWhereInput = {
        schoolId: query.schoolId,
        deletedAt: null,
        ...(query.academicYearId ? { academicSessionId: query.academicYearId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status as any } : {}),
        ...dateRange('issueDate', query),
      };
      const [rows, total] = await Promise.all([
        prisma.feeInvoice.findMany({ where, ...pageArgs(query), orderBy: { issueDate: 'desc' }, include: { student: true } }),
        prisma.feeInvoice.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ invoiceNumber: row.invoiceNumber, studentName: fullName(row.student), totalAmount: row.totalAmount, paidAmount: row.paidAmount, dueAmount: row.dueAmount, status: row.status, issueDate: row.issueDate })) };
    },
  },
  {
    key: 'payroll.summary',
    title: 'Payroll Summary',
    category: 'Payroll',
    description: 'Read-only generated payroll summary.',
    available: true,
    filters: ['schoolId', 'teacherId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.payroll.view',
    columns: [
      { key: 'payslipNo', label: 'Payslip' },
      { key: 'staffName', label: 'Staff' },
      { key: 'month', label: 'Month' },
      { key: 'year', label: 'Year' },
      { key: 'grossSalary', label: 'Gross' },
      { key: 'netSalary', label: 'Net' },
      { key: 'status', label: 'Status' },
    ],
    fetch: async (query) => {
      const where: Prisma.PayrollWhereInput = { schoolId: query.schoolId, ...(query.teacherId ? { staffId: query.teacherId } : {}), ...(query.status ? { status: query.status as any } : {}) };
      const [rows, total] = await Promise.all([
        prisma.payroll.findMany({ where, ...pageArgs(query), orderBy: [{ year: 'desc' }, { month: 'desc' }], include: { staff: true } }),
        prisma.payroll.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ payslipNo: row.payslipNo, staffName: fullName(row.staff), month: row.month, year: row.year, grossSalary: row.grossSalary, netSalary: row.netSalary, status: row.status })) };
    },
  },
  {
    key: 'staff.teacher_assignments',
    title: 'Teacher Assignment Report',
    category: 'Staff',
    description: 'Teacher class, subject, and class-teacher assignments.',
    available: true,
    filters: ['schoolId', 'teacherId', 'classId', 'sectionId', 'subjectId'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.staff.view',
    columns: [
      { key: 'employeeNo', label: 'Employee No' },
      { key: 'teacherName', label: 'Teacher' },
      { key: 'assignmentType', label: 'Type' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'subject', label: 'Subject' },
    ],
    fetch: async (query) => {
      const teachers = await prisma.teacherProfile.findMany({
        where: { schoolId: query.schoolId, ...(query.teacherId ? { id: query.teacherId } : {}) },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
          classAssignments: { include: { class: true, section: true } },
          subjectAssignments: { include: { subject: true } },
          classTeacherAssignments: { include: { class: true, section: true } },
        },
      });
      const rows = teachers.flatMap((teacher) => {
        const teacherName = fullName(teacher);
        const base = { employeeNo: teacher.employeeNo, teacherName };
        return [
          ...teacher.classAssignments
            .filter((entry) => (!query.classId || entry.classId === query.classId) && (!query.sectionId || entry.sectionId === query.sectionId))
            .map((entry) => ({ ...base, assignmentType: 'Class', class: entry.class.name, section: entry.section?.name ?? '', subject: '' })),
          ...teacher.subjectAssignments
            .filter((entry) => !query.subjectId || entry.subjectId === query.subjectId)
            .map((entry) => ({ ...base, assignmentType: 'Subject', class: '', section: '', subject: entry.subject.name })),
          ...teacher.classTeacherAssignments
            .filter((entry) => (!query.classId || entry.classId === query.classId) && (!query.sectionId || entry.sectionId === query.sectionId))
            .map((entry) => ({ ...base, assignmentType: 'Class Teacher', class: entry.class.name, section: entry.section.name, subject: '' })),
        ];
      });
      return { total: rows.length, rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
    },
  },
  {
    key: 'academics.timetable',
    title: 'Timetable Report',
    category: 'Academics',
    description: 'Active timetable entries by class, section, teacher, subject, and period.',
    available: true,
    filters: ['schoolId', 'academicYearId', 'classId', 'sectionId', 'teacherId', 'subjectId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.academics.view',
    columns: [
      { key: 'day', label: 'Day' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'period', label: 'Period' },
      { key: 'subject', label: 'Subject' },
      { key: 'teacher', label: 'Teacher' },
      { key: 'room', label: 'Room' },
      { key: 'active', label: 'Active' },
    ],
    fetch: async (query) => {
      const rows = await timetableReadService.getTimetable({
        schoolId: query.schoolId,
        academicYearId: query.academicYearId,
        classId: query.classId,
        sectionId: query.sectionId,
        teacherId: query.teacherId,
        isActive: query.status ? query.status === 'ACTIVE' : undefined,
        mode: 'modern',
      });
      const filteredRows = query.subjectId ? rows.filter((row) => row.subjectId === query.subjectId) : rows;
      const pagedRows = paginate(filteredRows, query);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return {
        total: filteredRows.length,
        rows: pagedRows.map((row) => ({
          day: days[row.dayOfWeek] ?? String(row.dayOfWeek),
          class: row.className ?? '',
          section: row.sectionName ?? '',
          period: row.periodName ?? '',
          subject: row.subjectName,
          teacher: row.teacherName,
          room: row.roomName ?? '',
          active: row.isActive ? 'Yes' : 'No',
        })),
      };
    },
  },
  {
    key: 'attendance.students.monthly',
    title: 'Student Monthly Attendance Summary',
    category: 'Attendance',
    description: 'Monthly student attendance totals from persisted attendance records.',
    available: true,
    filters: ['schoolId', 'classId', 'sectionId', 'studentId', 'fromDate', 'toDate'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.attendance.view',
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'class', label: 'Class' },
      { key: 'section', label: 'Section' },
      { key: 'present', label: 'Present' },
      { key: 'absent', label: 'Absent' },
      { key: 'late', label: 'Late' },
      { key: 'halfDay', label: 'Half Day' },
      { key: 'total', label: 'Total' },
    ],
    fetch: async (query) => {
      const records = await attendanceReadService.getStudentAttendance({
        schoolId: query.schoolId,
        classId: query.classId,
        sectionId: query.sectionId,
        studentId: query.studentId,
        fromDate: query.fromDate,
        toDate: query.toDate,
        source: 'student-attendance',
      });
      const lookups = await loadStudentAttendanceLookups(query.schoolId, records);
      const grouped = new Map<string, Record<string, unknown> & { present: number; absent: number; late: number; halfDay: number; total: number }>();
      records.forEach((record) => {
        const month = record.date.slice(0, 7);
        const key = `${month}:${record.studentId}`;
        const row = grouped.get(key) ?? {
          month,
          admissionNo: lookups.students.get(record.studentId)?.admissionNo ?? '',
          studentName: fullName(lookups.students.get(record.studentId)),
          class: record.classId ? lookups.classes.get(record.classId)?.name ?? '' : '',
          section: record.sectionId ? lookups.sections.get(record.sectionId)?.name ?? '' : '',
          present: 0,
          absent: 0,
          late: 0,
          halfDay: 0,
          total: 0,
        };
        if (record.status === 'PRESENT') row.present += 1;
        if (record.status === 'ABSENT') row.absent += 1;
        if (record.status === 'LATE') row.late += 1;
        if (record.status === 'HALF_DAY') row.halfDay += 1;
        row.total += 1;
        grouped.set(key, row);
      });
      const rows = Array.from(grouped.values()).sort((a, b) => String(b.month).localeCompare(String(a.month)));
      return { total: rows.length, rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
    },
  },
  {
    key: 'attendance.staff.summary',
    title: 'Staff Attendance Summary',
    category: 'Attendance',
    description: 'Staff attendance totals from staff attendance records.',
    available: true,
    filters: ['schoolId', 'teacherId', 'fromDate', 'toDate', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.attendance.view',
    columns: [
      { key: 'employeeNo', label: 'Employee No' },
      { key: 'staffName', label: 'Staff' },
      { key: 'present', label: 'Present' },
      { key: 'absent', label: 'Absent' },
      { key: 'late', label: 'Late' },
      { key: 'halfDay', label: 'Half Day' },
      { key: 'total', label: 'Total' },
    ],
    fetch: async (query) => {
      const summary = await attendanceReadService.getTeacherAttendance({
        schoolId: query.schoolId,
        teacherId: query.teacherId,
        fromDate: query.fromDate,
        toDate: query.toDate,
      });
      const records = filterStatus(summary.records, query.status);
      const staffIds = [...new Set(records.map((record) => record.teacherId))];
      const staffRows = staffIds.length
        ? await prisma.teacherProfile.findMany({
          where: { schoolId: query.schoolId, id: { in: staffIds } },
            select: { id: true, employeeNo: true, firstName: true, lastName: true },
          })
        : [];
      const staffById = new Map(staffRows.map((staff) => [staff.id, staff]));
      const grouped = new Map<string, { employeeNo: string; staffName: string; present: number; absent: number; late: number; halfDay: number; total: number }>();
      records.forEach((record) => {
        const staff = staffById.get(record.teacherId);
        const row = grouped.get(record.teacherId) ?? { employeeNo: staff?.employeeNo ?? '', staffName: fullName(staff), present: 0, absent: 0, late: 0, halfDay: 0, total: 0 };
        if (record.status === 'PRESENT') row.present += 1;
        if (record.status === 'ABSENT') row.absent += 1;
        if (record.status === 'LATE') row.late += 1;
        if (record.status === 'HALF_DAY') row.halfDay += 1;
        row.total += 1;
        grouped.set(record.teacherId, row);
      });
      const rows = Array.from(grouped.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));
      return { total: rows.length, rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
    },
  },
  {
    key: 'dormitory.assignments',
    title: 'Dormitory Assignments',
    category: 'Dormitory',
    description: 'Students assigned to dormitories and rooms.',
    available: true,
    filters: ['schoolId', 'studentId', 'status'],
    formats: ['json', 'csv', 'pdf'],
    permission: 'reports.dormitory.view',
    columns: [
      { key: 'admissionNo', label: 'Admission No' },
      { key: 'studentName', label: 'Student' },
      { key: 'dormitory', label: 'Dormitory' },
      { key: 'room', label: 'Room' },
      { key: 'assignedAt', label: 'Assigned At' },
      { key: 'active', label: 'Active' },
    ],
    fetch: async (query) => {
      const where: Prisma.StudentDormitoryAssignmentWhereInput = {
        schoolId: query.schoolId,
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { active: query.status === 'ACTIVE' } : {}),
      };
      const [rows, total] = await Promise.all([
        prisma.studentDormitoryAssignment.findMany({ where, ...pageArgs(query), orderBy: { assignedAt: 'desc' }, include: { student: true, dormitory: true, room: true } }),
        prisma.studentDormitoryAssignment.count({ where }),
      ]);
      return { total, rows: rows.map((row) => ({ admissionNo: row.student.admissionNo, studentName: fullName(row.student), dormitory: row.dormitory.name, room: row.room?.roomNumber ?? '', assignedAt: row.assignedAt, active: row.active ? 'Yes' : 'No' })) };
    },
  },
  unavailable(
    'students.profile_summary',
    'Student Profile Summary',
    'Students',
    'Student profile completeness summary.',
    'Unavailable because student profile completeness is spread across optional profile, document, guardian, sibling, and operational tables without a single required-field policy.',
    ['schoolId', 'classId', 'sectionId'],
  ),
];

const reportByKey = new Map(reports.map((report) => [report.key, report]));

export const listReportCatalog = () =>
  reports.map(({ fetch, ...report }) => ({
    ...report,
  }));

export const getReportDefinition = (reportKey: string) => {
  const report = reportByKey.get(reportKey);
  if (!report) throw new HttpError(404, 'Report not found');
  return report;
};

export const getReportData = async (reportKey: string, query: ReportQuery) => {
  const report = getReportDefinition(reportKey);
  if (!report.available || !report.fetch) {
    throw new HttpError(404, report.unavailableReason || 'Report is not available');
  }
  return report.fetch(query);
};

export const toCsv = (columns: ReportColumn[], rows: Record<string, unknown>[]) => {
  const escape = (value: unknown) => {
    const text = toPlain(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.map((column) => escape(column.label)).join(','), ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(','))].join('\n');
};

export const toReportPdf = async (params: {
  schoolId: string;
  report: ReportCatalogItem;
  rows: Record<string, unknown>[];
  filters: Record<string, unknown>;
}) => {
  if (params.rows.length > 500) throw new HttpError(413, 'PDF export is limited to 500 rows. Use CSV export for larger reports.');
  const school = await prisma.school.findFirst({ where: { id: params.schoolId }, select: { name: true } });
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  doc.fontSize(16).text(school?.name ?? 'School', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(13).text(params.report.title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(8).text(`Generated: ${new Date().toLocaleString('en-IN')}`);
  const activeFilters = Object.entries(params.filters)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${toPlain(value)}`);
  if (activeFilters.length) doc.text(`Filters: ${activeFilters.join(' | ')}`);
  doc.moveDown();

  const colWidth = Math.floor((doc.page.width - doc.page.margins.left - doc.page.margins.right) / Math.max(params.report.columns.length, 1));
  const renderHeader = () => {
    doc.fontSize(7);
    params.report.columns.forEach((column, index) => {
      doc.text(column.label, doc.page.margins.left + index * colWidth, doc.y, { width: colWidth - 4, continued: index < params.report.columns.length - 1 });
    });
    doc.moveDown(0.5);
  };
  renderHeader();
  params.rows.forEach((row) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 24) {
      doc.addPage();
      renderHeader();
    }
    params.report.columns.forEach((column, index) => {
      doc.text(toPlain(row[column.key]), doc.page.margins.left + index * colWidth, doc.y, { width: colWidth - 4, continued: index < params.report.columns.length - 1 });
    });
    doc.moveDown(0.4);
  });
  doc.end();

  return new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
};
