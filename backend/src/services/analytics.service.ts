import { prisma } from '../config/db';

export const getAttendanceRate = async (schoolId: string) => {
  const total = await prisma.attendanceRecord.count({
    where: { session: { schoolId } },
  });
  const present = await prisma.attendanceRecord.count({
    where: { session: { schoolId }, status: { in: ['PRESENT', 'LATE'] } },
  });

  return total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));
};

export const getWeeklyAnalytics = async (schoolId: string) => {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const sessions = await prisma.attendanceSession.findMany({
    where: { schoolId, date: { gte: start, lte: today } },
    select: { id: true, date: true },
  });

  const sessionIds = sessions.map((s) => s.id);
  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId: { in: sessionIds } },
    select: { sessionId: true, status: true },
  });

  const bySession = records.reduce<Record<string, { total: number; present: number }>>((acc, r) => {
    acc[r.sessionId] = acc[r.sessionId] ?? { total: 0, present: 0 };
    acc[r.sessionId].total += 1;
    if (['PRESENT', 'LATE', 'EXCUSED'].includes(r.status)) acc[r.sessionId].present += 1;
    return acc;
  }, {});

  return sessions.map((s) => {
    const stats = bySession[s.id] ?? { total: 0, present: 0 };
    const rate = stats.total === 0 ? 0 : Math.round((stats.present / stats.total) * 100);
    return { date: s.date, attendanceRate: rate };
  });
};

export const getPerformanceMetrics = async (schoolId: string) => {
  const [exams, marks, students] = await Promise.all([
    prisma.exam.count({ where: { schoolId } }),
    prisma.mark.count({ where: { examPaper: { exam: { schoolId } } } }),
    prisma.student.count({ where: { schoolId } }),
  ]);
  return { exams, marks, students };
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
