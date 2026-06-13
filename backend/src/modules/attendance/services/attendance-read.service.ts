import { prisma as defaultPrisma } from '../../../config/db';
import { PeriodAttendanceReadAdapter } from '../adapters/period-attendance.adapter';
import { SessionAttendanceReadAdapter } from '../adapters/session-attendance.adapter';
import { StaffAttendanceReadAdapter } from '../adapters/staff-attendance.adapter';
import { TimetableReadService } from '../../timetable/services/timetable-read.service';
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
type TimetableSourceOption = 'timetable-entry' | 'combined';
type SessionAttendanceOverviewAdapter = StudentAttendanceAdapter & {
  getSessionOverview?: (params: StudentAttendanceSessionOverviewParams) => Promise<StudentAttendanceSessionOverview[]>;
};
type PeriodAttendanceRecordAdapter = StudentAttendanceAdapter & {
  getSessionRecords?: (sessionId: string) => Promise<unknown[]>;
};
type StaffAttendanceLegacyAdapter = TeacherAttendanceAdapter & {
  getStaffAttendanceHoliday?: (params: {
    schoolId: string;
    holidayDate: Date;
    roleName?: string | null;
  }) => Promise<any>;
  getStaffAttendanceHolidays?: (params: {
    schoolId: string;
    fromDate: Date;
    toDateExclusive: Date;
    roleName?: string | null;
  }) => Promise<any[]>;
};

type AttendanceReadServiceOptions = {
  sessionAttendanceAdapter?: SessionAttendanceOverviewAdapter;
  periodAttendanceAdapter?: PeriodAttendanceRecordAdapter;
  staffAttendanceAdapter?: StaffAttendanceLegacyAdapter;
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
  private readonly sessionAttendanceAdapter: SessionAttendanceOverviewAdapter;
  private readonly periodAttendanceAdapter: PeriodAttendanceRecordAdapter;
  private readonly staffAttendanceAdapter: StaffAttendanceLegacyAdapter;
  private readonly timetableReadService: TimetableReadService;
  private readonly db: PrismaLike;

  constructor(options: AttendanceReadServiceOptions = {}) {
    this.db = options.prisma ?? defaultPrisma;
    this.sessionAttendanceAdapter = options.sessionAttendanceAdapter ?? new SessionAttendanceReadAdapter(this.db);
    this.periodAttendanceAdapter = options.periodAttendanceAdapter ?? new PeriodAttendanceReadAdapter(this.db);
    this.staffAttendanceAdapter = options.staffAttendanceAdapter ?? new StaffAttendanceReadAdapter(this.db);
    this.timetableReadService = new TimetableReadService({ prisma: this.db });
  }

  private studentAdapters(source: StudentSourceOption = 'combined') {
    if (source === 'session-attendance') return [this.sessionAttendanceAdapter];
    if (source === 'period-attendance') return [this.periodAttendanceAdapter];
    return [this.sessionAttendanceAdapter, this.periodAttendanceAdapter];
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

  async getStudentAttendanceHoliday(params: {
    schoolId: string;
    academicSessionId: string;
    classId: string;
    sectionId: string;
    holidayDate: Date;
  }): Promise<any> {
    return this.db.attendanceHoliday.findFirst({
      where: {
        schoolId: params.schoolId,
        academicSessionId: params.academicSessionId,
        classId: params.classId,
        sectionId: params.sectionId,
        holidayDate: params.holidayDate,
      },
    });
  }

  async getStudentAttendanceHolidays(params: {
    schoolId: string;
    academicSessionId: string;
    classId: string;
    sectionId: string;
    fromDate: Date;
    toDateExclusive: Date;
  }): Promise<any[]> {
    return this.db.attendanceHoliday.findMany({
      where: {
        schoolId: params.schoolId,
        academicSessionId: params.academicSessionId,
        classId: params.classId,
        sectionId: params.sectionId,
        holidayDate: { gte: params.fromDate, lt: params.toDateExclusive },
      },
    });
  }

  async getStaffAttendanceHoliday(params: {
    schoolId: string;
    holidayDate: Date;
    roleName?: string | null;
  }): Promise<any> {
    if (!this.staffAttendanceAdapter.getStaffAttendanceHoliday) {
      throw new Error('Staff attendance holiday reads are not supported by this adapter');
    }
    return this.staffAttendanceAdapter.getStaffAttendanceHoliday(params);
  }

  async getStaffAttendanceHolidays(params: {
    schoolId: string;
    fromDate: Date;
    toDateExclusive: Date;
    roleName?: string | null;
  }): Promise<any[]> {
    if (!this.staffAttendanceAdapter.getStaffAttendanceHolidays) {
      throw new Error('Staff attendance holiday reads are not supported by this adapter');
    }
    return this.staffAttendanceAdapter.getStaffAttendanceHolidays(params);
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
    const modern = await this.getModernTimetable(params);
    return modern.sort((a, b) => {
      const dayCompare = a.dayOfWeek - b.dayOfWeek;
      if (dayCompare) return dayCompare;
      return (a.startTime ?? '').localeCompare(b.startTime ?? '');
    });
  }

  private async getModernTimetable(params: TimetableReadParams): Promise<TimetableSlot[]> {
    const slots = await this.timetableReadService.getTimetable({
      ...params,
      dayOfWeek: params.dayOfWeek ?? (params.date ? dayOfWeekFromDate(params.date) : undefined),
    });

    return slots.map((slot) => ({
      source: 'timetable-entry',
      sourceId: slot.sourceId,
      schoolId: slot.schoolId,
      academicYearId: slot.academicYearId,
      timetableVersionId: slot.timetableVersionId,
      classId: slot.classId,
      sectionId: slot.sectionId,
      periodId: slot.periodId ?? '',
      dayOfWeek: slot.dayOfWeek,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
      room: slot.roomName,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  }
}

export const attendanceReadService = new AttendanceReadService();
