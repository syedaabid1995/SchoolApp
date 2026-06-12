import { prisma as defaultPrisma } from '../../../config/db';
import { PeriodAttendanceReadAdapter } from '../adapters/period-attendance.adapter';
import { SessionAttendanceReadAdapter } from '../adapters/session-attendance.adapter';
import { StaffAttendanceReadAdapter } from '../adapters/staff-attendance.adapter';
import { StudentAttendanceReadAdapter } from '../adapters/student-attendance.adapter';
import type {
  AttendanceAnalyticsSummary,
  AttendanceStatus,
  StudentAttendanceAdapter,
  StudentAttendanceReadParams,
  StudentAttendanceReadSource,
  StudentAttendanceSessionOverview,
  StudentAttendanceSessionOverviewParams,
  StudentAttendanceSummary,
  StudentDailyAttendance,
  TeacherAttendanceAdapter,
  TeacherAttendanceReadParams,
  TeacherAttendanceSummary,
  TimetableReadParams,
  TimetableSlot,
} from '../models/attendance-read-model';

type PrismaLike = typeof defaultPrisma;
type StudentSourceOption = StudentAttendanceReadSource | 'combined';
type TimetableSourceOption = 'legacy-routine' | 'timetable-entry' | 'combined';
type SessionAttendanceOverviewAdapter = StudentAttendanceAdapter & {
  getSessionOverview?: (params: StudentAttendanceSessionOverviewParams) => Promise<StudentAttendanceSessionOverview[]>;
};
type PeriodAttendanceRecordAdapter = StudentAttendanceAdapter & {
  getSessionRecords?: (sessionId: string) => Promise<unknown[]>;
};

type AttendanceReadServiceOptions = {
  studentAttendanceAdapter?: StudentAttendanceAdapter;
  sessionAttendanceAdapter?: SessionAttendanceOverviewAdapter;
  periodAttendanceAdapter?: PeriodAttendanceRecordAdapter;
  staffAttendanceAdapter?: TeacherAttendanceAdapter;
  prisma?: PrismaLike;
};

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toDateKey = (value: Date | string) => toDateOnly(value).toISOString().slice(0, 10);

const firstDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));
const lastDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0));

const blankStatusCounts = () => ({
  present: 0,
  absent: 0,
  late: 0,
  halfDay: 0,
  excused: 0,
  holiday: 0,
  unmarked: 0,
});

const applyStudentStatus = (counts: ReturnType<typeof blankStatusCounts>, status: AttendanceStatus) => {
  if (status === 'PRESENT') counts.present += 1;
  else if (status === 'ABSENT') counts.absent += 1;
  else if (status === 'LATE') counts.late += 1;
  else if (status === 'HALF_DAY') counts.halfDay += 1;
  else if (status === 'EXCUSED') counts.excused += 1;
  else if (status === 'HOLIDAY') counts.holiday += 1;
  else if (status === 'UNMARKED') counts.unmarked += 1;
};

const attendancePercentage = (counts: ReturnType<typeof blankStatusCounts>) => {
  const total = counts.present + counts.absent + counts.late + counts.halfDay + counts.excused + counts.holiday + counts.unmarked;
  if (!total) return 0;
  const attended = counts.present + counts.late + counts.excused + counts.halfDay * 0.5;
  return Math.round((attended / total) * 10000) / 100;
};

const dayOfWeekFromDate = (date: Date | string) => {
  const value = toDateOnly(date).getUTCDay();
  return value === 0 ? 7 : value;
};

export class AttendanceReadService {
  private readonly studentAttendanceAdapter: StudentAttendanceAdapter;
  private readonly sessionAttendanceAdapter: SessionAttendanceOverviewAdapter;
  private readonly periodAttendanceAdapter: PeriodAttendanceRecordAdapter;
  private readonly staffAttendanceAdapter: TeacherAttendanceAdapter;
  private readonly db: PrismaLike;

  constructor(options: AttendanceReadServiceOptions = {}) {
    this.db = options.prisma ?? defaultPrisma;
    this.studentAttendanceAdapter = options.studentAttendanceAdapter ?? new StudentAttendanceReadAdapter(this.db);
    this.sessionAttendanceAdapter = options.sessionAttendanceAdapter ?? new SessionAttendanceReadAdapter(this.db);
    this.periodAttendanceAdapter = options.periodAttendanceAdapter ?? new PeriodAttendanceReadAdapter(this.db);
    this.staffAttendanceAdapter = options.staffAttendanceAdapter ?? new StaffAttendanceReadAdapter(this.db);
  }

  private studentAdapters(source: StudentSourceOption = 'combined') {
    if (source === 'student-attendance') return [this.studentAttendanceAdapter];
    if (source === 'session-attendance') return [this.sessionAttendanceAdapter];
    if (source === 'period-attendance') return [this.periodAttendanceAdapter];
    return [this.studentAttendanceAdapter, this.sessionAttendanceAdapter, this.periodAttendanceAdapter];
  }

  async getStudentAttendance(
    params: StudentAttendanceReadParams & { source?: StudentSourceOption },
  ): Promise<StudentDailyAttendance[]> {
    const sources = await Promise.all(
      this.studentAdapters(params.source).map((adapter) => adapter.getStudentAttendance(params)),
    );
    return sources.flat().sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare) return dateCompare;
      const studentCompare = a.studentId.localeCompare(b.studentId);
      if (studentCompare) return studentCompare;
      return a.source.localeCompare(b.source);
    });
  }

  async getStudentMonthlyAttendance(params: {
    schoolId: string;
    studentId?: string;
    classId?: string;
    sectionId?: string | null;
    academicSessionId?: string;
    month: number;
    year: number;
    source?: StudentSourceOption;
  }): Promise<StudentAttendanceSummary> {
    const fromDate = firstDayOfMonth(params.year, params.month);
    const toDate = lastDayOfMonth(params.year, params.month);
    return this.getAttendanceSummary({
      schoolId: params.schoolId,
      studentId: params.studentId,
      classId: params.classId,
      sectionId: params.sectionId,
      academicSessionId: params.academicSessionId,
      fromDate,
      toDate,
      source: params.source,
    });
  }

  async getAttendanceSummary(
    params: StudentAttendanceReadParams & { source?: StudentSourceOption },
  ): Promise<StudentAttendanceSummary> {
    const fromDate = params.fromDate ?? params.date ?? new Date();
    const toDate = params.toDate ?? params.date ?? fromDate;
    const records = await this.getStudentAttendance({ ...params, fromDate, toDate });
    const counts = blankStatusCounts();
    const byStudent = new Map<string, ReturnType<typeof blankStatusCounts> & { totalRecords: number }>();

    for (const record of records) {
      applyStudentStatus(counts, record.status);
      const studentCounts = byStudent.get(record.studentId) ?? { ...blankStatusCounts(), totalRecords: 0 };
      applyStudentStatus(studentCounts, record.status);
      studentCounts.totalRecords += 1;
      byStudent.set(record.studentId, studentCounts);
    }

    return {
      schoolId: params.schoolId,
      source: params.source ?? 'combined',
      fromDate: toDateKey(fromDate),
      toDate: toDateKey(toDate),
      totalRecords: records.length,
      ...counts,
      byStudent: Array.from(byStudent.entries()).map(([studentId, row]) => ({
        studentId,
        totalRecords: row.totalRecords,
        present: row.present,
        absent: row.absent,
        late: row.late,
        halfDay: row.halfDay,
        excused: row.excused,
        holiday: row.holiday,
        unmarked: row.unmarked,
        percentage: attendancePercentage(row),
      })),
      records,
    };
  }

  async getSessionAttendanceOverview(params: StudentAttendanceSessionOverviewParams): Promise<StudentAttendanceSessionOverview[]> {
    if (!this.sessionAttendanceAdapter.getSessionOverview) {
      throw new Error('Session attendance overview is not supported by this adapter');
    }
    return this.sessionAttendanceAdapter.getSessionOverview(params);
  }

  async getPeriodSessionRecords(sessionId: string): Promise<unknown[]> {
    if (!this.periodAttendanceAdapter.getSessionRecords) {
      throw new Error('Period attendance session records are not supported by this adapter');
    }
    return this.periodAttendanceAdapter.getSessionRecords(sessionId);
  }

  async getTeacherAttendance(params: TeacherAttendanceReadParams): Promise<TeacherAttendanceSummary> {
    const fromDate = params.fromDate ?? new Date();
    const toDate = params.toDate ?? fromDate;
    const records = await this.staffAttendanceAdapter.getTeacherAttendance({ ...params, fromDate, toDate });
    const counts = { present: 0, absent: 0, late: 0, halfDay: 0, leave: 0, holiday: 0 };

    for (const record of records) {
      if (record.status === 'PRESENT') counts.present += 1;
      else if (record.status === 'ABSENT') counts.absent += 1;
      else if (record.status === 'LATE') counts.late += 1;
      else if (record.status === 'HALF_DAY') counts.halfDay += 1;
      else if (record.status === 'LEAVE') counts.leave += 1;
      else if (record.status === 'HOLIDAY') counts.holiday += 1;
    }

    return {
      schoolId: params.schoolId,
      source: 'staff-attendance',
      fromDate: toDateKey(fromDate),
      toDate: toDateKey(toDate),
      totalRecords: records.length,
      ...counts,
      records,
    };
  }

  async getAttendanceAnalytics(
    params: StudentAttendanceReadParams & { source?: StudentSourceOption },
  ): Promise<AttendanceAnalyticsSummary> {
    const fromDate = params.fromDate ?? params.date ?? new Date();
    const toDate = params.toDate ?? params.date ?? fromDate;
    const records = await this.getStudentAttendance({ ...params, fromDate, toDate });
    const presentLikeRecords = records.filter((record) =>
      ['PRESENT', 'LATE', 'HALF_DAY', 'EXCUSED'].includes(record.status),
    ).length;
    const absentRecords = records.filter((record) => record.status === 'ABSENT').length;
    const attendanceRate = records.length ? Math.round((presentLikeRecords / records.length) * 10000) / 100 : 0;

    return {
      schoolId: params.schoolId,
      source: params.source ?? 'combined',
      fromDate: toDateKey(fromDate),
      toDate: toDateKey(toDate),
      totalRecords: records.length,
      presentLikeRecords,
      absentRecords,
      attendanceRate,
      records,
    };
  }

  async getTimetable(
    params: TimetableReadParams & { source?: TimetableSourceOption },
  ): Promise<TimetableSlot[]> {
    const source = params.source ?? 'combined';
    const [legacy, modern] = await Promise.all([
      source === 'timetable-entry' ? Promise.resolve([]) : this.getLegacyTimetable(params),
      source === 'legacy-routine' ? Promise.resolve([]) : this.getModernTimetable(params),
    ]);
    return [...legacy, ...modern].sort((a, b) => {
      const dayCompare = a.dayOfWeek - b.dayOfWeek;
      if (dayCompare) return dayCompare;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  }

  private async getLegacyTimetable(params: TimetableReadParams): Promise<TimetableSlot[]> {
    const dayOfWeek = params.dayOfWeek ?? (params.date ? dayOfWeekFromDate(params.date) : undefined);
    const rows = await this.db.classRoutine.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.teacherId ? { teacherId: params.teacherId } : {}),
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(dayOfWeek ? { dayOfWeek } : {}),
      },
      include: {
        timePeriod: { select: { startTime: true, endTime: true } },
        classRoom: { select: { roomNumber: true } },
      },
    });

    return rows.map((row) => ({
      source: 'legacy-routine',
      sourceId: row.id,
      schoolId: row.schoolId,
      academicYearId: null,
      timetableVersionId: null,
      classId: row.classId,
      sectionId: row.sectionId,
      periodId: row.timePeriodId,
      dayOfWeek: row.dayOfWeek,
      subjectId: row.subjectId,
      teacherId: row.teacherId,
      room: row.classRoom?.roomNumber ?? null,
      startTime: row.timePeriod?.startTime ?? null,
      endTime: row.timePeriod?.endTime ?? null,
    }));
  }

  private async getModernTimetable(params: TimetableReadParams): Promise<TimetableSlot[]> {
    const dayOfWeek = params.dayOfWeek ?? (params.date ? dayOfWeekFromDate(params.date) : undefined);
    const date = params.date ? toDateOnly(params.date) : undefined;
    const rows = await this.db.timetableEntry.findMany({
      where: {
        schoolId: params.schoolId,
        isActive: true,
        ...(params.timetableVersionId ? { timetableVersionId: params.timetableVersionId } : {}),
        ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
        ...(params.teacherId ? { teacherId: params.teacherId } : {}),
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(dayOfWeek ? { dayOfWeek } : {}),
        ...(date
          ? {
              version: {
                status: 'PUBLISHED',
                effectiveFrom: { lte: date },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
              },
            }
          : {}),
      },
      include: {
        period: { select: { startTime: true, endTime: true } },
      },
    });

    return rows.map((row) => ({
      source: 'timetable-entry',
      sourceId: row.id,
      schoolId: row.schoolId,
      academicYearId: row.academicYearId,
      timetableVersionId: row.timetableVersionId,
      classId: row.classId,
      sectionId: row.sectionId ?? null,
      periodId: row.attendancePeriodId,
      dayOfWeek: row.dayOfWeek,
      subjectId: row.subjectId,
      teacherId: row.teacherId,
      room: row.room ?? null,
      startTime: row.period?.startTime ?? null,
      endTime: row.period?.endTime ?? null,
    }));
  }
}

export const attendanceReadService = new AttendanceReadService();
