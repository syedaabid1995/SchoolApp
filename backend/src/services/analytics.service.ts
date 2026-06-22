import { prisma } from '../config/db';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addUtcDays = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const attendanceValue = (status: string) => {
  if (['PRESENT', 'LATE', 'EXCUSED'].includes(status)) return 1;
  if (status === 'HALF_DAY') return 0.5;
  return 0;
};

export const getAttendanceRate = async (schoolId: string) => {
  const records = await attendanceReadService.getStudentAttendance({ schoolId });
  const total = records.length;
  const present = records.reduce((sum, record) => sum + attendanceValue(record.status), 0);

  return total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));
};

export const getWeeklyAnalytics = async (schoolId: string) => {
  const today = startOfUtcDay(new Date());
  const end = addUtcDays(today, 1);
  const start = addUtcDays(today, -6);
  const days = Array.from({ length: 7 }, (_, index) => addUtcDays(start, index));

  const [attendanceRecords, students, marks] = await Promise.all([
    attendanceReadService.getStudentAttendance({
      schoolId,
      fromDate: start,
      toDate: end,
    }),
    prisma.student.findMany({
      where: { schoolId, status: 'ENROLLED' },
      select: { admissionDate: true, createdAt: true },
    }),
    prisma.mark.findMany({
      where: { examPaper: { exam: { schoolId } }, createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    }),
  ]);

  const hasRecordsInWindow = attendanceRecords.some((record) => days.some((day) => dateKey(day) === record.date));
  const analyticsDays = hasRecordsInWindow || attendanceRecords.length === 0
    ? days
    : [...new Set(attendanceRecords.map((record) => record.date))]
        .sort()
        .map((date) => new Date(`${date}T00:00:00.000Z`));
  const byDay = new Map(analyticsDays.map((day) => [dateKey(day), { total: 0, present: 0, marks: 0 }]));

  for (const record of attendanceRecords) {
    const key = record.date;
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    bucket.present += attendanceValue(record.status);
  }

  for (const mark of marks) {
    const bucket = byDay.get(dateKey(mark.createdAt));
    if (bucket) bucket.marks += 1;
  }

  const maxMarks = Math.max(1, ...Array.from(byDay.values()).map((bucket) => bucket.marks));

  return analyticsDays.map((day) => {
    const key = dateKey(day);
    const stats = byDay.get(key) ?? { total: 0, present: 0, marks: 0 };
    const attendanceRate = stats.total === 0 ? 0 : Math.round((stats.present / stats.total) * 100);
    const endOfDay = addUtcDays(day, 1);
    const enrollment = students.filter((student) => (student.admissionDate ?? student.createdAt) < endOfDay).length;
    const performance = Math.round((stats.marks / maxMarks) * 100);
    return hasRecordsInWindow || attendanceRecords.length === 0
      ? { date: day, attendanceRate, enrollment, performance }
      : { date: day, attendanceRate };
  });
};

export const getPerformanceMetrics = async (schoolId: string) => {
  const [exams, marks, students, attendanceRate, classes, classSections, subjects] = await Promise.all([
    prisma.exam.count({ where: { schoolId } }),
    prisma.mark.count({ where: { examPaper: { exam: { schoolId } } } }),
    prisma.student.count({ where: { schoolId, status: 'ENROLLED' } }),
    getAttendanceRate(schoolId),
    prisma.class.count({ where: { schoolId } }),
    prisma.classSection.count({ where: { schoolId } }),
    prisma.subject.count({ where: { schoolId } }),
  ]);
  const markCoverage = students > 0 ? Math.min(100, Math.round((marks / students) * 100)) : 0;
  const setupCoverage = classes > 0 ? Math.round(((classSections > 0 ? 50 : 0) + (subjects > 0 ? 50 : 0))) : 0;
  const overallScore = Math.round((attendanceRate + markCoverage + setupCoverage) / 3);

  return {
    exams,
    marks,
    students,
    overallScore,
    attendanceRate,
    satisfactionRate: setupCoverage,
  };
};

export const getStudentCount = async (schoolId: string) => {
  return prisma.student.count({ where: { schoolId } });
};

export const getTeacherActivity = async (schoolId: string) => {
  const sessions = await prisma.attendanceSession.count({ where: { schoolId } });
  const activeTeachers = await prisma.teacherProfile.count({ where: { schoolId, isActive: true } });
  return { sessions, activeTeachers };
};

export const getAcademicSummary = async (schoolId: string) => {
  const exams = await prisma.exam.count({ where: { schoolId } });
  const marks = await prisma.mark.count({ where: { examPaper: { exam: { schoolId } } } });
  return { exams, marks };
};
