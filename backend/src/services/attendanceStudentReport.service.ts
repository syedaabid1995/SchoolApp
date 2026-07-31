import type { AttendanceStatus, AttendanceUnitType, Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveAttendanceUnits } from './attendanceSheet.service';

type UnitColumn = {
  key: string;
  label: string;
  unitType: AttendanceUnitType;
  startTime?: string | null;
  endTime?: string | null;
};

type ReportCell = {
  status: AttendanceStatus | 'UNMARKED' | 'HOLIDAY';
  note?: string | null;
  sessionId?: string | null;
  recordId?: string | null;
  subject?: string | null;
  unitLabel?: string | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REPORT_DAYS = 800;

type HolidayInfo = {
  title: string;
  details?: string | null;
};

const dayValueByKey = new Map([
  ['saturday', 1],
  ['sat', 1],
  ['sunday', 2],
  ['sun', 2],
  ['monday', 3],
  ['mon', 3],
  ['tuesday', 4],
  ['tue', 4],
  ['wednesday', 5],
  ['wed', 5],
  ['thursday', 6],
  ['thu', 6],
  ['friday', 7],
  ['fri', 7],
]);

const maxReportDays = () => {
  const configured = Number(process.env.STUDENT_ATTENDANCE_REPORT_MAX_DAYS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_REPORT_DAYS;
};

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const toDateKey = (value: Date | string) => toDateOnly(value).toISOString().slice(0, 10);

const routineDayValue = (date: Date) => {
  const day = toDateOnly(date).getUTCDay();
  return day === 6 ? 1 : day + 2;
};

const eachDate = (start: Date, end: Date) => {
  const dates: Date[] = [];
  const cursor = toDateOnly(start);
  const last = toDateOnly(end);
  while (cursor <= last) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const fullName = (student: { fullName?: string | null; firstName?: string | null; lastName?: string | null }) =>
  student.fullName || [student.firstName, student.lastName].filter(Boolean).join(' ').trim();

const weekendValuesFromJson = (weekends: Prisma.JsonValue | null | undefined) => {
  const values = new Set<number>();
  if (!Array.isArray(weekends)) return new Set([7]);

  for (const item of weekends) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (row.isWeekend !== true) continue;
    const key = String(row.id ?? row.name ?? row.value ?? row.dayOfWeek ?? '').trim().toLowerCase();
    const numeric = Number(key);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) values.add(numeric);
    const value = dayValueByKey.get(key);
    if (value) values.add(value);
  }

  return values;
};

const applySystemHolidays = (
  holidayByDate: Map<string, HolidayInfo>,
  holidays: Prisma.JsonValue | null | undefined,
  startDate: Date,
  endDate: Date,
) => {
  const rows = Array.isArray(holidays) ? holidays : [];
  for (const item of rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const from = typeof row.fromDate === 'string' ? toDateOnly(row.fromDate) : null;
    const to = typeof row.toDate === 'string' ? toDateOnly(row.toDate) : from;
    if (!from || !to || to < startDate || from > endDate) continue;
    const title = String(row.title ?? 'Holiday').trim() || 'Holiday';
    const details = typeof row.details === 'string' && row.details.trim() ? row.details.trim() : null;
    for (const day of eachDate(from < startDate ? startDate : from, to > endDate ? endDate : to)) {
      holidayByDate.set(toDateKey(day), { title, details });
    }
  }
};

const applySystemWeekends = (
  holidayByDate: Map<string, HolidayInfo>,
  weekends: Prisma.JsonValue | null | undefined,
  dates: Date[],
) => {
  const weekendValues = weekendValuesFromJson(weekends);
  for (const day of dates) {
    if (!weekendValues.has(routineDayValue(day))) continue;
    const key = toDateKey(day);
    if (!holidayByDate.has(key)) {
      holidayByDate.set(key, { title: 'Weekend', details: 'Configured school weekend' });
    }
  }
};

const holidayNote = (holiday: HolidayInfo) => [holiday.title, holiday.details].filter(Boolean).join(' - ');

const columnLabel = (unit: Awaited<ReturnType<typeof resolveAttendanceUnits>>['units'][number]) => {
  if (unit.unitType === 'TIMETABLE_ENTRY') {
    return unit.label.split(' - ')[0] || unit.label;
  }
  return unit.label;
};

const unitColumnKey = (unit: Awaited<ReturnType<typeof resolveAttendanceUnits>>['units'][number]) => {
  if (unit.unitType === 'DAY') return 'day';
  if (unit.unitType === 'SLOT') return `slot:${unit.slotId ?? unit.slotType ?? unit.label}`;
  if (unit.unitType === 'PERIOD') return `period:${unit.periodId ?? unit.label}`;
  return `period:${unit.periodId ?? unit.timetableEntryId ?? unit.label}`;
};

const sessionColumnKey = (session: {
  unitType: AttendanceUnitType | null;
  slotId?: string | null;
  periodId?: string | null;
  timetableEntryId?: string | null;
}) => {
  if (session.unitType === 'DAY') return 'day';
  if (session.unitType === 'SLOT') return `slot:${session.slotId ?? ''}`;
  if (session.unitType === 'PERIOD') return `period:${session.periodId ?? ''}`;
  if (session.unitType === 'TIMETABLE_ENTRY') return `period:${session.periodId ?? session.timetableEntryId ?? ''}`;
  return '';
};

const statusOrder: Record<ReportCell['status'], number> = {
  PRESENT: 1,
  LATE: 2,
  ABSENT: 3,
  EXCUSED: 4,
  HOLIDAY: 5,
  UNMARKED: 6,
};

export const buildStudentAttendanceReport = async (params: {
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionId?: string | null;
  studentId: string;
}) => {
  const [academicYear, klass, section, student] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { id: params.academicYearId, schoolId: params.schoolId },
      select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
    }),
    prisma.class.findFirst({
      where: { id: params.classId, schoolId: params.schoolId },
      select: { id: true, name: true },
    }),
    params.sectionId
      ? prisma.section.findFirst({
          where: { id: params.sectionId, schoolId: params.schoolId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    prisma.student.findFirst({
      where: {
        id: params.studentId,
        schoolId: params.schoolId,
        status: { not: 'DISABLED' },
        OR: [
          {
            academicSessionId: params.academicYearId,
            classId: params.classId,
            sectionId: params.sectionId ?? null,
          },
          {
            enrollments: {
              some: {
                academicSessionId: params.academicYearId,
                classId: params.classId,
                sectionId: params.sectionId ?? null,
              },
            },
          },
        ],
      },
      select: { id: true, admissionNo: true, rollNo: true, firstName: true, lastName: true, fullName: true },
    }),
  ]);

  if (!academicYear) throw new HttpError(404, 'Academic year not found');
  if (!klass) throw new HttpError(404, 'Class not found');
  if (params.sectionId && !section) throw new HttpError(404, 'Section not found');
  if (!student) throw new HttpError(404, 'Student not found for the selected academic year, class, and section');

  const startDate = toDateOnly(academicYear.startDate);
  const endDate = toDateOnly(academicYear.endDate);
  if (endDate < startDate) {
    throw new HttpError(400, 'Academic year end date must be after the start date');
  }

  const reportDays = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
  if (reportDays > maxReportDays()) {
    throw new HttpError(400, `Student attendance report is limited to a ${maxReportDays()} day academic year`);
  }

  const dates = eachDate(startDate, endDate);
  const columnMap = new Map<string, UnitColumn>();
  const expectedByDate = new Map<string, Map<string, ReportCell>>();
  let resolvedMode = 'DAILY';

  for (const day of dates) {
    const date = toDateKey(day);
    const resolved = await resolveAttendanceUnits({
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      date,
    });
    resolvedMode = resolved.configuration.mode;
    const cells = new Map<string, ReportCell>();
    resolved.units.forEach((unit) => {
      const key = unitColumnKey(unit);
      if (!columnMap.has(key)) {
        columnMap.set(key, {
          key,
          label: columnLabel(unit),
          unitType: unit.unitType,
          startTime: unit.startTime,
          endTime: unit.endTime,
        });
      }
      cells.set(key, { status: 'UNMARKED', unitLabel: unit.label });
    });
    expectedByDate.set(date, cells);
  }

  const [sessions, holidays, systemSettings] = await Promise.all([
    prisma.attendanceSession.findMany({
      where: {
        schoolId: params.schoolId,
        academicYearId: params.academicYearId,
        classId: params.classId,
        sectionId: params.sectionId ?? null,
        date: { gte: startDate, lte: endDate },
      },
      include: {
        records: {
          where: { studentId: params.studentId },
          select: { id: true, status: true, manualOverrideReason: true },
        },
        slot: { select: { name: true, type: true } },
        period: { select: { name: true, startTime: true, endTime: true } },
        timetableEntry: {
          select: {
            id: true,
            subject: { select: { name: true } },
            period: { select: { name: true, startTime: true, endTime: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    }),
    params.sectionId
      ? prisma.attendanceHoliday.findMany({
          where: {
            schoolId: params.schoolId,
            academicSessionId: params.academicYearId,
            classId: params.classId,
            sectionId: params.sectionId,
            holidayDate: { gte: startDate, lte: endDate },
          },
          select: { holidayDate: true, reason: true },
        })
      : Promise.resolve([]),
    prisma.schoolSystemSetting.findUnique({
      where: { schoolId: params.schoolId },
      select: { holidays: true, weekends: true },
    }),
  ]);

  const holidayByDate = new Map<string, HolidayInfo>();
  applySystemWeekends(holidayByDate, systemSettings?.weekends, dates);
  applySystemHolidays(holidayByDate, systemSettings?.holidays, startDate, endDate);
  for (const holiday of holidays) {
    holidayByDate.set(toDateKey(holiday.holidayDate), {
      title: holiday.reason ?? 'Holiday',
      details: null,
    });
  }

  for (const session of sessions) {
    const date = toDateKey(session.date);
    const key = sessionColumnKey(session);
    const cells = expectedByDate.get(date);
    if (!cells || !key) continue;
    if (!columnMap.has(key)) {
      const period = session.timetableEntry?.period ?? session.period;
      columnMap.set(key, {
        key,
        label: period?.name ?? session.slot?.name ?? session.unitType ?? key,
        unitType: session.unitType ?? 'DAY',
        startTime: period?.startTime ?? null,
        endTime: period?.endTime ?? null,
      });
    }
    const record = session.records[0];
    const current = cells.get(key);
    const next: ReportCell = {
      status: record?.status ?? current?.status ?? 'UNMARKED',
      note: record?.manualOverrideReason ?? current?.note ?? null,
      sessionId: session.id,
      recordId: record?.id ?? null,
      subject: session.timetableEntry?.subject?.name ?? null,
      unitLabel: session.timetableEntry?.period?.name ?? session.period?.name ?? session.slot?.name ?? session.unitType,
    };
    if (!current || statusOrder[next.status] <= statusOrder[current.status]) {
      cells.set(key, next);
    }
  }

  for (const [date, holiday] of holidayByDate) {
    const cells = expectedByDate.get(date);
    if (!cells) continue;
    for (const [key, cell] of cells) {
      cells.set(key, { ...cell, status: 'HOLIDAY', note: holidayNote(holiday) });
    }
  }

  const columns = Array.from(columnMap.values()).sort((a, b) => {
    const timeCompare = String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));
    if (timeCompare) return timeCompare;
    return a.label.localeCompare(b.label);
  });

  const summary = { total: 0, present: 0, late: 0, absent: 0, excused: 0, holiday: 0, unmarked: 0 };
  const rows = dates.map((day) => {
    const date = toDateKey(day);
    const cellsByKey = expectedByDate.get(date) ?? new Map<string, ReportCell>();
    const cells: Record<string, ReportCell> = {};
    columns.forEach((column) => {
      const cell = cellsByKey.get(column.key) ?? { status: 'UNMARKED' as const };
      cells[column.key] = cell;
      summary.total += 1;
      if (cell.status === 'PRESENT') summary.present += 1;
      if (cell.status === 'LATE') summary.late += 1;
      if (cell.status === 'ABSENT') summary.absent += 1;
      if (cell.status === 'EXCUSED') summary.excused += 1;
      if (cell.status === 'HOLIDAY') summary.holiday += 1;
      if (cell.status === 'UNMARKED') summary.unmarked += 1;
    });
    return {
      date,
      day: day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      cells,
    };
  });

  const attended = summary.present + summary.late + summary.excused;
  const denominator = Math.max(0, summary.total - summary.holiday);
  const percentage = denominator > 0 ? Math.round((attended / denominator) * 10000) / 100 : 0;

  return {
    academicYear,
    class: klass,
    section,
    student: { ...student, name: fullName(student) },
    mode: resolvedMode,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    columns,
    rows,
    summary: { ...summary, percentage },
  };
};
