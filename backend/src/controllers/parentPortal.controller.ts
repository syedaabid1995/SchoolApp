import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { requireAuth } from '../middlewares/rbac.middleware';
import { attendanceReadService } from '../modules/attendance/services/attendance-read.service';
import * as attendanceSheetService from '../services/attendanceSheet.service';
import { evaluateFailCriteria, getExamGradingSettings } from '../services/grade.service';
import {
  computeStudentLeaveDays,
  findParentProfileForChild,
  sendStudentLeaveRequestTeacherAlerts,
  studentLeaveTypes,
} from '../services/studentLeave.service';
import { parseLimit } from '../utils/pagination';

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

const payloadRecord = (payload: unknown) =>
  payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

const payloadString = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key];
  return typeof value === 'string' ? value : '';
};

const parseJsonPayload = (value: unknown) => {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const studentLeaveSchema = z.object({
  childId: z.string().uuid(),
  leaveType: z.enum(studentLeaveTypes).or(z.string().trim().min(1).max(80)),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(3).max(1000),
});

const skippedDaysArray = (value: Prisma.JsonValue) =>
  Array.isArray(value)
    ? value
        .filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map((item) => ({
          date: typeof (item as Record<string, unknown>).date === 'string' ? String((item as Record<string, unknown>).date) : '',
          reason: typeof (item as Record<string, unknown>).reason === 'string' ? String((item as Record<string, unknown>).reason) : 'Non-working day',
          type: typeof (item as Record<string, unknown>).type === 'string' ? String((item as Record<string, unknown>).type) : 'HOLIDAY',
        }))
    : [];

const formatStudentLeaveRequest = (request: any) => {
  const childName =
    request.student?.fullName ||
    `${request.student?.firstName ?? ''} ${request.student?.lastName ?? ''}`.trim() ||
    'Student';
  const classLabel = [request.student?.class?.name, request.student?.section?.name].filter(Boolean).join(' ');
  return {
    id: request.id,
    childId: request.studentId,
    childName,
    classLabel,
    leaveType: request.leaveType,
    fromDate: request.fromDate,
    toDate: request.toDate,
    requestedDays: request.requestedDays,
    workingDays: request.workingDays,
    skippedDays: skippedDaysArray(request.skippedDays),
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

export const listParentChildren = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const children = await resolveChildren(auth.userId);
  res.status(200).json(children);
};

export const listParentLeaveRequests = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const childId = typeof req.query.childId === 'string' ? req.query.childId : undefined;
  const { child, children } = await requireChildAccess(auth.userId, childId);
  const childIds = childId ? [child.id] : children.map((entry) => entry.id);
  const rows = await prisma.studentLeaveRequest.findMany({
    where: { studentId: { in: childIds } },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
  });

  const now = new Date();
  const month = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(now);
  res.status(200).json({
    items: rows.map(formatStudentLeaveRequest),
    total: rows.length,
    currentMonth: month,
    leaveTypes: studentLeaveTypes,
  });
};

export const createParentLeaveRequest = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const payload = studentLeaveSchema.parse(req.body);
  const { child } = await requireChildAccess(auth.userId, payload.childId);
  const parent = await findParentProfileForChild({ userId: auth.userId, childId: child.id });

  const calculation = await computeStudentLeaveDays({
    schoolId: child.schoolId,
    classId: child.classId,
    sectionId: child.sectionId,
    fromDate: payload.fromDate,
    toDate: payload.toDate,
  });
  if (calculation.workingDays <= 0) {
    throw new HttpError(400, 'Selected dates only include weekends or holidays');
  }

  const overlap = await prisma.studentLeaveRequest.findFirst({
    where: {
      schoolId: child.schoolId,
      studentId: child.id,
      status: { in: ['PENDING', 'APPROVED'] },
      fromDate: { lte: calculation.toDate },
      toDate: { gte: calculation.fromDate },
    },
    select: { id: true },
  });
  if (overlap) throw new HttpError(409, 'Leave request already exists for this date range');

  const request = await prisma.studentLeaveRequest.create({
    data: {
      schoolId: child.schoolId,
      studentId: child.id,
      parentId: parent.id,
      leaveType: payload.leaveType,
      fromDate: calculation.fromDate,
      toDate: calculation.toDate,
      requestedDays: calculation.requestedDays,
      workingDays: calculation.workingDays,
      skippedDays: calculation.skippedDays as Prisma.InputJsonValue,
      reason: payload.reason,
    },
    include: {
      student: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
    },
  });

  await sendStudentLeaveRequestTeacherAlerts({
    schoolId: child.schoolId,
    actorId: auth.userId,
    child,
    leaveType: payload.leaveType,
    fromDate: calculation.fromDate,
    toDate: calculation.toDate,
    workingDays: calculation.workingDays,
    reason: payload.reason,
    requestId: request.id,
  });

  res.status(201).json(formatStudentLeaveRequest(request));
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

  const attendanceRecords = await attendanceReadService.getStudentAttendance({
    schoolId: child.schoolId,
    studentId: child.id,
    source: 'period-attendance',
  });
  const totalRecords = attendanceRecords.length;
  const presentRecords = attendanceRecords.filter((record) => ['PRESENT', 'LATE', 'EXCUSED'].includes(record.status)).length;
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
    orderBy: { createdAt: 'desc' },
    take: 300,
  });
  const gradingSettings = await getExamGradingSettings(child.schoolId);
  let latestResult: { examName: string; total: string; status: string } | null = null;
  if (marks.length) {
    const byExam = new Map<string, { examName: string; totalMarks: number; maxMarks: number; subjectMarks: Array<{ marks: number; maxMarks: number }>; createdAt: Date }>();
    marks.forEach((mark) => {
      const exam = mark.examPaper.exam;
      if (!exam) return;
      const entry = byExam.get(exam.id) ?? {
        examName: exam.name,
        totalMarks: 0,
        maxMarks: 0,
        subjectMarks: [],
        createdAt: exam.createdAt,
      };
      entry.totalMarks += mark.marks;
      entry.maxMarks += mark.examPaper.maxMarks;
      entry.subjectMarks.push({ marks: mark.marks, maxMarks: mark.examPaper.maxMarks });
      if (exam.createdAt > entry.createdAt) entry.createdAt = exam.createdAt;
      byExam.set(exam.id, entry);
    });
    const latest = Array.from(byExam.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (latest) {
      latestResult = {
        examName: latest.examName,
        total: `${latest.totalMarks}/${latest.maxMarks}`,
        status: evaluateFailCriteria(latest.subjectMarks, gradingSettings.failCriteria).status === 'PASS' ? 'Pass' : 'Fail',
      };
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentAttendance = await attendanceReadService.getStudentAttendance({
    schoolId: child.schoolId,
    studentId: child.id,
    fromDate: since,
    toDate: new Date(),
    source: 'period-attendance',
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
  const { childId, academicYearId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);
  const yearId = typeof academicYearId === 'string' && academicYearId.trim() ? academicYearId.trim() : null;
  const limit = parseLimit(req.query.limit, { defaultLimit: 50, maxLimit: 100 });

  const exams = await prisma.exam.findMany({
    where: {
      schoolId: child.schoolId,
      academicYearId: yearId ?? child.academicYearId,
      status: { in: ['PUBLISHED', 'CLOSED'] },
      AND: [
        {
          OR: [
            { classId: child.classId ?? undefined },
            { classId: null },
          ],
        },
        {
          OR: [
            { sectionId: child.sectionId ?? undefined },
            { sectionId: null },
          ],
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id, status: 'LOCKED' },
    include: { examPaper: { select: { examId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const marksByExam = new Set(marks.map((mark) => mark.examPaper.examId));

  res.status(200).json(
    exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      status: exam.status,
      resultStatus: marksByExam.has(exam.id) ? 'Published' : 'Pending',
      scheduledAt: exam.scheduledAt,
      academicYearId: exam.academicYearId,
      type: exam.type,
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

export const getParentResults = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);
  const limit = parseLimit(req.query.limit, { defaultLimit: 200, maxLimit: 500 });

  const examTypeRows = await prisma.examTypeConfig.findMany({
    where: { schoolId: child.schoolId },
    select: { code: true, name: true, isActive: true },
  });
  const examTypeMap = new Map(examTypeRows.map((row) => [row.code, row]));

  const marks = await prisma.mark.findMany({
    where: { studentId: child.id, status: 'LOCKED' },
    include: {
      examPaper: {
        include: {
          subject: { select: { id: true, name: true } },
          exam: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });
  const hasNextPage = marks.length > limit;
  const resultMarks = marks.slice(0, limit);

  const grouped = new Map<string, {
    examId: string;
    examName: string;
    examType: string;
    examTypeCode: string;
    examTypeActive: boolean | null;
    examDate: string | null;
    resultPublishAt: string | null;
    academicYearId: string;
    classId: string | null;
    sectionId: string | null;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      marks: number;
      maxMarks: number;
      passMarks: number;
      grade?: string | null;
      scheduledAt: string | null;
    }>;
    totalMarks: number;
    totalMaxMarks: number;
  }>();

  resultMarks.forEach((mark) => {
    const exam = mark.examPaper.exam;
    if (!exam) return;
    const existing = grouped.get(exam.id);
    const examTypeInfo = examTypeMap.get(exam.type);
    const subjectRow = {
      subjectId: mark.examPaper.subjectId,
      subjectName: mark.examPaper.subject?.name ?? 'Subject',
      marks: mark.marks,
      maxMarks: mark.examPaper.maxMarks,
      passMarks: mark.examPaper.passMarks,
      grade: mark.grade ?? null,
      scheduledAt: mark.examPaper.scheduledAt ? mark.examPaper.scheduledAt.toISOString() : null,
    };

    if (!existing) {
      grouped.set(exam.id, {
        examId: exam.id,
        examName: exam.name,
        examType: examTypeInfo?.name ?? exam.type,
        examTypeCode: exam.type,
        examTypeActive: examTypeInfo?.isActive ?? null,
        examDate: exam.scheduledAt ? exam.scheduledAt.toISOString() : null,
        resultPublishAt: exam.resultPublishAt ? exam.resultPublishAt.toISOString() : null,
        academicYearId: exam.academicYearId,
        classId: exam.classId ?? null,
        sectionId: exam.sectionId ?? null,
        subjects: [subjectRow],
        totalMarks: mark.marks,
        totalMaxMarks: mark.examPaper.maxMarks,
      });
      return;
    }

    existing.subjects.push(subjectRow);
    existing.totalMarks += mark.marks;
    existing.totalMaxMarks += mark.examPaper.maxMarks;
  });

  const items = Array.from(grouped.values()).map((entry) => ({
    ...entry,
    percentage: entry.totalMaxMarks ? Math.round((entry.totalMarks / entry.totalMaxMarks) * 100) : null,
  }));

  const gradingSettings = await getExamGradingSettings(child.schoolId);
  const itemsWithStatus = items.map((entry) => {
    const evaluation = evaluateFailCriteria(
      entry.subjects.map((subject) => ({ marks: subject.marks, maxMarks: subject.maxMarks })),
      gradingSettings.failCriteria,
    );
    return {
      ...entry,
      resultStatus: evaluation.status,
      failedSubjects: evaluation.failedSubjects,
    };
  });

  res.status(200).json({
    child,
    items: itemsWithStatus,
    pageInfo: {
      limit,
      hasNextPage,
      nextCursor: null,
    },
  });
};

export const getParentAttendance = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId, month, date } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);

  const start = month && typeof month === 'string' ? new Date(`${month}-01`) : new Date();
  start.setDate(1);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);

  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  const records = await attendanceReadService.getStudentAttendance({
    schoolId: child.schoolId,
    studentId: child.id,
    fromDate: start,
    toDate: endInclusive,
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
  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const selectedDate =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : dateKey(new Date());

  const matchesUnit = (
    record: (typeof records)[number],
    unit: Awaited<ReturnType<typeof attendanceSheetService.resolveAttendanceUnits>>['units'][number],
  ) => {
    const recordUnit = record.unit;
    if (unit.unitType === 'DAY') {
      return recordUnit?.unitType === 'DAY' || record.source === 'session-attendance';
    }
    if (unit.unitType === 'SLOT') {
      return recordUnit?.unitType === 'SLOT' && recordUnit.slotId === (unit.slotId ?? null);
    }
    if (unit.unitType === 'PERIOD') {
      return recordUnit?.unitType === 'PERIOD' && recordUnit.periodId === (unit.periodId ?? null);
    }
    if (unit.unitType === 'TIMETABLE_ENTRY') {
      return (
        recordUnit?.unitType === 'TIMETABLE_ENTRY' &&
        recordUnit.timetableEntryId === (unit.timetableEntryId ?? null)
      );
    }
    return false;
  };

  const byDate = new Map<string, { status: string; remark?: string | null }>();
  records.forEach((record) => {
    const key = record.date;
    const nextStatus = normalizeStatus(record.status);
    const existing = byDate.get(key);
    const nextRank = statusRank[nextStatus] ?? 0;
    const existingRank = existing ? statusRank[existing.status] ?? 0 : 0;
    if (!existing || nextRank > existingRank || (nextRank === existingRank && !existing.remark && record.note)) {
      byDate.set(key, { status: nextStatus, remark: record.note ?? null });
    }
  });

  const calendar = Array.from(byDate.entries()).map(([date, entry]) => ({
    date,
    status: entry.status,
    remark: entry.remark ?? null,
  }));
  const presentDays = calendar.filter((entry) => entry.status === 'Present').length;
  const absentDays = calendar.filter((entry) => entry.status === 'Absent').length;
  const selectedDateObject = new Date(`${selectedDate}T00:00:00.000Z`);
  const attendanceUnits = child.classId
    ? await attendanceSheetService.resolveAttendanceUnits({
        schoolId: child.schoolId,
        academicYearId: child.academicYearId ?? null,
        classId: child.classId,
        sectionId: child.sectionId ?? null,
        date: selectedDateObject,
      })
    : {
        configuration: { mode: 'DAILY' as const },
        units: [{ unitType: 'DAY' as const, label: 'Day', source: 'DAY' as const }],
      };
  const selectedRecords = records.filter((record) => record.date === selectedDate);
  const sessions = attendanceUnits.units.map((unit, index) => {
    const record = selectedRecords.find((entry) => matchesUnit(entry, unit));
    return {
      id: record?.sessionId ?? `${selectedDate}:${unit.unitType}:${unit.slotId ?? unit.periodId ?? unit.timetableEntryId ?? 'day'}`,
      unitType: unit.unitType,
      mode: attendanceUnits.configuration.mode,
      label:
        unit.unitType === 'DAY'
          ? 'Daily Session'
          : unit.unitType === 'SLOT'
            ? `${unit.label} Session`
            : unit.label,
      startTime: 'startTime' in unit ? unit.startTime ?? null : null,
      endTime: 'endTime' in unit ? unit.endTime ?? null : null,
      status: record ? normalizeStatus(record.status) : 'Unmarked',
      remark: record?.note ?? null,
      sequence: index + 1,
    };
  });

  res.status(200).json({
    calendar,
    presentDays,
    absentDays,
    selectedDate,
    mode: attendanceUnits.configuration.mode,
    sessions,
  });
};

export const listParentNotices = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);
  const now = new Date();
  const [notices, pushLogs] = await Promise.all([
    prisma.communicationNotice.findMany({
      where: {
        schoolId: child.schoolId,
        status: 'PUBLISHED',
        publishedAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    }),
    prisma.notificationLog.findMany({
      where: {
        schoolId: child.schoolId,
        channel: 'PUSH',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }),
  ]);

  const targetedAlerts = pushLogs
    .map((log) => ({ log, payload: payloadRecord(log.payload) }))
    .filter(({ payload }) => {
      const to = payloadString(payload, 'to');
      const payloadChildId = payloadString(payload, 'childId');
      const alertType = payloadString(payload, 'alertType');
      return to === auth.userId && payloadChildId === child.id && Boolean(alertType);
    })
    .map(({ log, payload }) => ({
      id: log.id,
      title: payloadString(payload, 'subject') || 'School alert',
      date: (log.sentAt ?? log.createdAt).toISOString(),
      summary: payloadString(payload, 'body'),
      type: payloadString(payload, 'alertType'),
      status: log.status,
      details: {
        childId: payloadString(payload, 'childId'),
        childName: payloadString(payload, 'childName'),
        examId: payloadString(payload, 'examId'),
        examName: payloadString(payload, 'examName'),
        examStatus: payloadString(payload, 'examStatus'),
        examType: payloadString(payload, 'examType'),
        className: payloadString(payload, 'className'),
        sectionName: payloadString(payload, 'sectionName'),
        scheduledAt: payloadString(payload, 'scheduledAt'),
        resultPublishAt: payloadString(payload, 'resultPublishAt'),
        subjects: parseJsonPayload(payload.subjects),
        attendanceDate: payloadString(payload, 'attendanceDate'),
        attendanceUnit: payloadString(payload, 'attendanceUnit'),
        attendanceStatus: payloadString(payload, 'attendanceStatus'),
        remarks: payloadString(payload, 'remarks'),
      },
    }));

  const noticeItems = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      date: notice.publishedAt.toISOString(),
      summary: notice.message,
      type: 'NOTICE',
      audience: notice.audience,
      details: { audience: notice.audience },
    }));

  res.status(200).json(
    [...targetedAlerts, ...noticeItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100),
  );
};

export const listParentTimetable = async (_req: Request, res: Response) => {
  res.status(200).json([]);
};

export const listParentFees = async (req: Request, res: Response) => {
  const auth = requireAuth(req);
  const { childId } = req.query;
  const { child } = await requireChildAccess(auth.userId, typeof childId === 'string' ? childId : undefined);
  const limit = parseLimit(req.query.limit, { defaultLimit: 100, maxLimit: 100 });

  const invoices = await prisma.feeInvoice.findMany({
    where: {
      schoolId: child.schoolId,
      studentId: child.id,
      deletedAt: null,
    },
    include: {
      feeType: { select: { name: true, schedule: true } },
      items: { orderBy: { sortOrder: 'asc' } },
      payments: { orderBy: { paidAt: 'desc' } },
      receipts: { orderBy: { receiptDate: 'desc' } },
    },
    orderBy: { issueDate: 'desc' },
    take: limit,
  });

  const items = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.feeMonth ? `${invoice.feeMonth} Fee` : invoice.feeType?.name ?? 'School Fee',
    feeType: invoice.feeType?.name ?? null,
    amount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    dueAmount: invoice.dueAmount,
    status: invoice.status,
    dueDate: invoice.dueDate,
    issueDate: invoice.issueDate,
    items: invoice.items,
    payments: invoice.payments,
    receipts: invoice.receipts,
  }));

  const summary = items.reduce(
    (result, invoice) => {
      result.total += Number(invoice.amount ?? 0);
      result.paid += Number(invoice.paidAmount ?? 0);
      result.due += Number(invoice.dueAmount ?? 0);
      return result;
    },
    { total: 0, paid: 0, due: 0 },
  );

  res.status(200).json({ child, summary, items });
};
