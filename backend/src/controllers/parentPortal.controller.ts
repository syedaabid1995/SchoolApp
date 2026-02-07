import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { requireAuth } from '../middlewares/rbac.middleware';

const resolveParentProfiles = async (userId: string) => {
  return prisma.parentProfile.findMany({
    where: { userId },
  });
};

const resolveChildren = async (userId: string) => {
  const parents = await resolveParentProfiles(userId);
  if (!parents.length) return [];
  const parentIds = parents.map((parent) => parent.id);
  const links = await prisma.studentParent.findMany({
    where: { parentId: { in: parentIds } },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true, academicYearId: true } },
          section: { select: { id: true, name: true } },
          school: { select: { id: true, name: true } },
        },
      },
    },
  });

  const unique = new Map<string, (typeof links)[number]>();
  links.forEach((link) => {
    if (!unique.has(link.studentId)) unique.set(link.studentId, link);
  });

  return Array.from(unique.values()).map((link) => {
    const className = link.student.class?.name ?? 'Class';
    const sectionName = link.student.section?.name;
    const classLabel = sectionName ? `${className} ${sectionName}` : className;
    return {
      id: link.student.id,
      name: `${link.student.firstName} ${link.student.lastName}`.trim(),
      classLabel,
      classId: link.student.classId ?? null,
      sectionId: link.student.sectionId ?? null,
      rollNo: link.student.admissionNo,
      schoolId: link.student.schoolId,
      schoolName: link.student.school?.name ?? '',
      academicYearId: link.student.class?.academicYearId ?? null,
    };
  });
};

const requireChildAccess = async (userId: string, childId?: string) => {
  const children = await resolveChildren(userId);
  if (!children.length) {
    throw new HttpError(404, 'No linked children');
  }
  if (!childId) return { child: children[0], children };
  const child = children.find((entry) => entry.id === childId);
  if (!child) {
    throw new HttpError(403, 'Child not linked to parent');
  }
  return { child, children };
};

export const listParentChildren = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const children = await resolveChildren(auth.userId);
  res.status(200).json(children);
};

export const getParentProfile = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  const parents = await resolveParentProfiles(auth.userId);
  const profile = parents[0];
  const children = await resolveChildren(auth.userId);
  res.status(200).json({
    name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.email ?? 'Parent',
    phone: profile?.phone ?? null,
    email: profile?.email ?? user?.email ?? null,
    schoolName: children[0]?.schoolName ?? null,
    academicYear: null,
    children,
  });
};

export const getParentDashboard = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);

  const totalRecords = await prisma.attendanceRecord.count({ where: { studentId: child.id } });
  const presentRecords = await prisma.attendanceRecord.count({
    where: { studentId: child.id, status: { in: ['PRESENT', 'LATE', 'EXCUSED'] } },
  });
  const attendancePercent = totalRecords ? Math.round((presentRecords / totalRecords) * 100) : null;

  const currentExam = await prisma.exam.findFirst({
    where: {
      schoolId: child.schoolId,
      classId: child.classId ?? undefined,
      sectionId: child.sectionId ?? undefined,
      status: { in: ['PUBLISHED', 'CLOSED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id },
    include: { examPaper: { include: { exam: true } } },
  });
  let latestResult: { examName: string; total: string; status: string } | null = null;
  if (marks.length) {
    const byExam = new Map<string, { examName: string; totalMarks: number; maxMarks: number; pass: boolean; createdAt: Date }>();
    marks.forEach((mark) => {
      const exam = mark.examPaper.exam;
      if (!exam) return;
      const entry = byExam.get(exam.id) ?? {
        examName: exam.name,
        totalMarks: 0,
        maxMarks: 0,
        pass: true,
        createdAt: exam.createdAt,
      };
      entry.totalMarks += mark.marks;
      entry.maxMarks += mark.examPaper.maxMarks;
      if (mark.marks < mark.examPaper.passMarks) entry.pass = false;
      if (exam.createdAt > entry.createdAt) entry.createdAt = exam.createdAt;
      byExam.set(exam.id, entry);
    });
    const latest = Array.from(byExam.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (latest) {
      latestResult = {
        examName: latest.examName,
        total: `${latest.totalMarks}/${latest.maxMarks}`,
        status: latest.pass ? 'Pass' : 'Fail',
      };
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentAttendance = await prisma.attendanceRecord.findMany({
    where: { studentId: child.id, session: { date: { gte: since } } },
    include: { session: { select: { date: true } } },
  });
  const presentDays = recentAttendance.filter((record) => record.status !== 'ABSENT').length;
  const absentDays = recentAttendance.filter((record) => record.status === 'ABSENT').length;
  const monthlyPercent = recentAttendance.length ? Math.round((presentDays / recentAttendance.length) * 100) : 0;

  res.status(200).json({
    child,
    attendancePercent,
    currentExam: currentExam?.name ?? null,
    latestResult,
    attendanceSnapshot: {
      presentDays,
      absentDays,
      monthlyPercent,
    },
    notices: [],
  });
};

export const listParentExams = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);

  const exams = await prisma.exam.findMany({
    where: {
      schoolId: child.schoolId,
      classId: child.classId ?? undefined,
      sectionId: child.sectionId ?? undefined,
      status: { in: ['PUBLISHED', 'CLOSED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id },
    include: { examPaper: { select: { examId: true } } },
  });
  const marksByExam = new Set(marks.map((mark) => mark.examPaper.examId));

  res.status(200).json(
    exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      status: exam.status,
      resultStatus: marksByExam.has(exam.id) ? 'Published' : 'Pending',
    })),
  );
};

export const listParentSubjects = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);

  if (!child.classId) {
    res.status(200).json([]);
    return;
  }

  const subjects = await prisma.subject.findMany({
    where: {
      schoolId: child.schoolId,
      classId: child.classId,
      ...(child.academicYearId ? { academicYearId: child.academicYearId } : {}),
    },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(subjects.map((subject) => ({ id: subject.id, name: subject.name })));
};

export const getParentAttendance = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId, month } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);

  const start = month && typeof month === 'string' ? new Date(`${month}-01`) : new Date();
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  const records = await prisma.studentAttendanceRecord.findMany({
    where: {
      studentId: child.id,
      session: { date: { gte: start, lt: end } },
    },
    include: { session: { select: { date: true } } },
  });

  const statusRank: Record<string, number> = {
    Absent: 4,
    Late: 3,
    'Half Day': 2,
    Present: 1,
  };
  const normalizeStatus = (status: string) => {
    if (status === 'ABSENT') return 'Absent';
    if (status === 'LATE') return 'Late';
    if (status === 'HALF_DAY') return 'Half Day';
    return 'Present';
  };

  const byDate = new Map<string, { status: string; remark?: string | null }>();
  records.forEach((record) => {
    const sessionDate = record.session.date;
    const key = `${sessionDate.getUTCFullYear()}-${String(sessionDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
      sessionDate.getUTCDate(),
    ).padStart(2, '0')}`;
    const nextStatus = normalizeStatus(record.status);
    const existing = byDate.get(key);
    const nextRank = statusRank[nextStatus] ?? 0;
    const existingRank = existing ? statusRank[existing.status] ?? 0 : 0;
    if (!existing || nextRank > existingRank || (nextRank === existingRank && !existing.remark && record.remarks)) {
      byDate.set(key, { status: nextStatus, remark: record.remarks ?? null });
    }
  });

  const calendar = Array.from(byDate.entries()).map(([date, entry]) => ({
    date,
    status: entry.status,
    remark: entry.remark ?? null,
  }));
  const presentDays = calendar.filter((entry) => entry.status === 'Present').length;
  const absentDays = calendar.filter((entry) => entry.status === 'Absent').length;

  res.status(200).json({ calendar, presentDays, absentDays });
};

export const listParentNotices = async (_req: Request, res: Response) => {
  res.status(200).json([]);
};

export const listParentTimetable = async (_req: Request, res: Response) => {
  res.status(200).json([]);
};

export const listParentFees = async (_req: Request, res: Response) => {
  res.status(200).json([]);
};
