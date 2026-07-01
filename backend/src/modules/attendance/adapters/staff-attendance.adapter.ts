import { prisma as defaultPrisma } from '../../../config/db';
import type {
  TeacherAttendanceAdapter,
  TeacherAttendanceReadParams,
  TeacherDailyAttendance,
} from '../models/attendance-read-model';

type PrismaLike = typeof defaultPrisma;

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const buildDateRange = (params: TeacherAttendanceReadParams) => {
  const range: { gte?: Date; lt?: Date } = {};
  if (params.fromDate) range.gte = toDateOnly(params.fromDate);
  if (params.toDate) {
    const end = toDateOnly(params.toDate);
    end.setUTCDate(end.getUTCDate() + 1);
    range.lt = end;
  }
  return Object.keys(range).length ? range : undefined;
};

export class StaffAttendanceReadAdapter implements TeacherAttendanceAdapter {
  readonly source = 'staff-attendance' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getStaffAttendanceHoliday(params: {
    schoolId: string;
    holidayDate: Date;
    roleName?: string | null;
  }) {
    return this.db.staffAttendanceHoliday.findFirst({
      where: { schoolId: params.schoolId, holidayDate: params.holidayDate, roleName: (params.roleName ?? null) as any },
    });
  }

  async getStaffAttendanceHolidays(params: {
    schoolId: string;
    fromDate: Date;
    toDateExclusive: Date;
    roleName?: string | null;
  }) {
    return this.db.staffAttendanceHoliday.findMany({
      where: {
        schoolId: params.schoolId,
        holidayDate: { gte: params.fromDate, lt: params.toDateExclusive },
        roleName: (params.roleName ?? null) as any,
      },
    });
  }

  async getTeacherAttendance(params: TeacherAttendanceReadParams): Promise<TeacherDailyAttendance[]> {
    const attendanceDate = buildDateRange(params);
    const rows = await this.db.staffAttendance.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.teacherId ? { staffId: params.teacherId } : {}),
        ...(attendanceDate ? { attendanceDate } : {}),
      },
      include: { period: { select: { id: true, name: true } } },
      orderBy: [{ attendanceDate: 'asc' }, { staffId: 'asc' }],
    });

    return rows.map((row) => ({
      source: this.source,
      sourceId: row.id,
      schoolId: row.schoolId,
      teacherId: row.staffId,
      date: toDateKey(row.attendanceDate),
      status: row.status,
      note: row.note ?? null,
      unitKey: row.unitKey,
      unitType: row.unitType,
      slotType: row.slotType ?? null,
      periodId: row.periodId ?? null,
      periodName: row.period?.name ?? null,
    }));
  }
}
