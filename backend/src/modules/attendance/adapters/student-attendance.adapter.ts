import { prisma as defaultPrisma } from '../../../config/db';
import type {
  StudentAttendanceAdapter,
  StudentAttendanceReadParams,
  StudentDailyAttendance,
} from '../models/attendance-read-model';

type PrismaLike = typeof defaultPrisma;

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);

const buildDateRange = (params: StudentAttendanceReadParams) => {
  if (params.date) {
    const start = toDateOnly(params.date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { gte: start, lt: end };
  }
  const range: { gte?: Date; lt?: Date } = {};
  if (params.fromDate) range.gte = toDateOnly(params.fromDate);
  if (params.toDate) {
    const end = toDateOnly(params.toDate);
    end.setUTCDate(end.getUTCDate() + 1);
    range.lt = end;
  }
  return Object.keys(range).length ? range : undefined;
};

export class StudentAttendanceReadAdapter implements StudentAttendanceAdapter {
  readonly source = 'student-attendance' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getStudentAttendance(params: StudentAttendanceReadParams): Promise<StudentDailyAttendance[]> {
    const attendanceDate = buildDateRange(params);
    const rows = await this.db.studentAttendance.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.studentId ? { studentId: params.studentId } : {}),
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(params.academicSessionId ? { academicSessionId: params.academicSessionId } : {}),
        ...(attendanceDate ? { attendanceDate } : {}),
      },
      orderBy: [{ attendanceDate: 'asc' }, { studentId: 'asc' }],
    });

    return rows.map((row) => ({
      source: this.source,
      sourceId: row.id,
      schoolId: row.schoolId,
      studentId: row.studentId,
      classId: row.classId,
      sectionId: row.sectionId,
      academicSessionId: row.academicSessionId,
      date: toDateKey(row.attendanceDate),
      status: row.status,
      note: row.note ?? null,
      sessionId: null,
      periodId: null,
      timetableEntryId: null,
    }));
  }
}

