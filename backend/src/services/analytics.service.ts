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
