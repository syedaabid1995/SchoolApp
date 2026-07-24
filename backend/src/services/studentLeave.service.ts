import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { HttpError } from '../middlewares/error.middleware';
import { sendNotification } from './notification.service';

export const studentLeaveTypes = [
  'Sick Leave',
  'Medical Leave',
  'Family Function',
  'Medical Checkup',
  'Others',
] as const;

type LinkedChild = {
  id: string;
  schoolId: string;
  classId: string | null;
  sectionId: string | null;
  name: string;
  classLabel: string;
};

const dayMs = 86_400_000;

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

const dayStart = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const enumerateDays = (fromDate: Date, toDate: Date) => {
  const days: Date[] = [];
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};

const routineDayValue = (date: Date) => {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
};

const weekendValuesFromJson = (weekends: Prisma.JsonValue | null | undefined) => {
  const values = new Set<number>();
  const rows = Array.isArray(weekends) ? weekends : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    if (item.isWeekend === false) continue;
    const raw = String(item.value ?? item.dayOfWeek ?? item.id ?? item.name ?? '').trim().toLowerCase();
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) values.add(numeric);
    if (raw.includes('monday')) values.add(1);
    if (raw.includes('tuesday')) values.add(2);
    if (raw.includes('wednesday')) values.add(3);
    if (raw.includes('thursday')) values.add(4);
    if (raw.includes('friday')) values.add(5);
    if (raw.includes('saturday')) values.add(6);
    if (raw.includes('sunday')) values.add(7);
  }
  if (!values.size) {
    values.add(6);
    values.add(7);
  }
  return values;
};

const addSystemHolidayDates = (
  holidays: Prisma.JsonValue | null | undefined,
  holidayMap: Map<string, string>,
  fromDate: Date,
  toDate: Date,
) => {
  const rows = Array.isArray(holidays) ? holidays : [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const from = typeof item.fromDate === 'string' ? dayStart(item.fromDate) : null;
    const to = typeof item.toDate === 'string' ? dayStart(item.toDate) : from;
    if (!from || !to || to < fromDate || from > toDate) continue;
    const title = String(item.title ?? 'Holiday');
    for (const day of enumerateDays(from < fromDate ? fromDate : from, to > toDate ? toDate : to)) {
      holidayMap.set(dateKey(day), title);
    }
  }
};

export const computeStudentLeaveDays = async (params: {
  schoolId: string;
  classId?: string | null;
  sectionId?: string | null;
  fromDate: string;
  toDate: string;
}) => {
  const fromDate = dayStart(params.fromDate);
  const toDate = dayStart(params.toDate);
  if (toDate < fromDate) throw new HttpError(400, 'To date must be after or equal to from date');

  const [settings, attendanceHolidays] = await Promise.all([
    prisma.schoolSystemSetting.findUnique({
      where: { schoolId: params.schoolId },
      select: { weekends: true, holidays: true },
    }),
    params.classId && params.sectionId
      ? prisma.attendanceHoliday.findMany({
          where: {
            schoolId: params.schoolId,
            classId: params.classId,
            sectionId: params.sectionId,
            holidayDate: { gte: fromDate, lte: toDate },
          },
          select: { holidayDate: true, reason: true },
        })
      : Promise.resolve([]),
  ]);

  const weekends = weekendValuesFromJson(settings?.weekends);
  const holidayMap = new Map<string, string>();
  addSystemHolidayDates(settings?.holidays, holidayMap, fromDate, toDate);
  for (const holiday of attendanceHolidays) {
    holidayMap.set(dateKey(holiday.holidayDate), holiday.reason ?? 'Holiday');
  }

  const requestedDays = Math.floor((toDate.getTime() - fromDate.getTime()) / dayMs) + 1;
  const workingDates: string[] = [];
  const skippedDays: Array<{ date: string; reason: string; type: 'WEEKEND' | 'HOLIDAY' }> = [];

  for (const day of enumerateDays(fromDate, toDate)) {
    const key = dateKey(day);
    if (weekends.has(routineDayValue(day))) {
      skippedDays.push({ date: key, reason: 'Weekend', type: 'WEEKEND' });
      continue;
    }
    const holidayReason = holidayMap.get(key);
    if (holidayReason) {
      skippedDays.push({ date: key, reason: holidayReason, type: 'HOLIDAY' });
      continue;
    }
    workingDates.push(key);
  }

  return { fromDate, toDate, requestedDays, workingDays: workingDates.length, workingDates, skippedDays };
};

export const findParentProfileForChild = async (params: { userId: string; childId: string }) => {
  const link = await prisma.studentParent.findFirst({
    where: { studentId: params.childId, parent: { userId: params.userId } },
    include: { parent: true },
  });
  if (!link) throw new HttpError(403, 'Child not linked to parent');
  return link.parent;
};

export const sendStudentLeaveRequestTeacherAlerts = async (params: {
  schoolId: string;
  actorId?: string | null;
  child: LinkedChild;
  leaveType: string;
  fromDate: Date;
  toDate: Date;
  workingDays: number;
  reason: string;
  requestId: string;
}) => {
  const [classTeachers, assignedTeachers, admins] = await Promise.all([
    params.child.classId && params.child.sectionId
      ? prisma.classTeacher.findMany({
          where: { schoolId: params.schoolId, classId: params.child.classId, sectionId: params.child.sectionId },
          include: { teacher: { select: { userId: true, firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    params.child.classId
      ? prisma.teacherClassAssignment.findMany({
          where: {
            classId: params.child.classId,
            OR: [{ sectionId: params.child.sectionId }, { sectionId: null }],
            teacher: { schoolId: params.schoolId, isActive: true },
          },
          include: { teacher: { select: { userId: true, firstName: true, lastName: true } } },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { schoolId: params.schoolId, roles: { some: { role: { name: 'SCHOOL_ADMIN' } } }, status: 'ACTIVE' },
      select: { id: true, email: true },
      take: 25,
    }),
  ]);

  const recipients = new Map<string, { userId: string; name: string; type: 'TEACHER' | 'SCHOOL_ADMIN' }>();
  for (const item of classTeachers) {
    recipients.set(item.teacher.userId, {
      userId: item.teacher.userId,
      name: `${item.teacher.firstName} ${item.teacher.lastName}`.trim() || 'Teacher',
      type: 'TEACHER',
    });
  }
  for (const item of assignedTeachers) {
    recipients.set(item.teacher.userId, {
      userId: item.teacher.userId,
      name: `${item.teacher.firstName} ${item.teacher.lastName}`.trim() || 'Teacher',
      type: 'TEACHER',
    });
  }
  for (const admin of admins) {
    recipients.set(admin.id, { userId: admin.id, name: admin.email, type: 'SCHOOL_ADMIN' });
  }

  const from = params.fromDate.toISOString().slice(0, 10);
  const to = params.toDate.toISOString().slice(0, 10);
  const body = `${params.child.name} requested ${params.leaveType} from ${from} to ${to} (${params.workingDays} working day${params.workingDays === 1 ? '' : 's'}).`;

  await Promise.all(
    Array.from(recipients.values()).map(async (recipient) => {
      try {
        await sendNotification({
          schoolId: params.schoolId,
          userId: params.actorId ?? null,
          channel: 'PUSH',
          data: {
            to: recipient.userId,
            subject: 'Student leave request',
            body,
            recipientName: recipient.name,
            recipientType: recipient.type,
            targetMode: 'CLASS',
            route: '/notifications',
            module: 'leave',
            category: 'leave',
            priority: 'high',
            alertType: 'STUDENT_LEAVE_REQUEST',
            leaveRequestId: params.requestId,
            childId: params.child.id,
            childName: params.child.name,
            classLabel: params.child.classLabel,
            leaveType: params.leaveType,
            fromDate: from,
            toDate: to,
            workingDays: String(params.workingDays),
            reason: params.reason,
          },
        });
      } catch (error) {
        logger.warn({ err: error, recipientUserId: recipient.userId }, 'student leave teacher push failed');
      }
    }),
  );
};
