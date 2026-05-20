import PDFDocument from 'pdfkit';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { evaluateFailCriteria, getExamGradingSettings } from './grade.service';

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
