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
  if (params.date) return { equals: toDateOnly(params.date) };
  const range: { gte?: Date; lte?: Date } = {};
  if (params.fromDate) range.gte = toDateOnly(params.fromDate);
  if (params.toDate) range.lte = toDateOnly(params.toDate);
  return Object.keys(range).length ? range : undefined;
};

export class PeriodAttendanceReadAdapter implements StudentAttendanceAdapter {
  readonly source = 'period-attendance' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getStudentAttendance(params: StudentAttendanceReadParams): Promise<StudentDailyAttendance[]> {
    const sessionDate = buildDateRange(params);
    const rows = await this.db.attendanceRecord.findMany({
      where: {
        ...(params.studentId ? { studentId: params.studentId } : {}),
        session: {
          schoolId: params.schoolId,
          ...(sessionDate ? { date: sessionDate } : {}),
        },
        ...(params.classId || params.sectionId !== undefined
          ? {
              student: {
                ...(params.classId ? { classId: params.classId } : {}),
                ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
              },
            }
          : {}),
      },
      include: {
        session: true,
        student: { select: { classId: true, sectionId: true, academicSessionId: true } },
      },
      orderBy: [{ capturedAt: 'asc' }, { studentId: 'asc' }],
    });

    return rows.map((row) => ({
      source: this.source,
      sourceId: row.id,
      schoolId: row.session.schoolId,
      studentId: row.studentId,
      classId: row.student?.classId ?? null,
      sectionId: row.student?.sectionId ?? null,
      academicSessionId: row.student?.academicSessionId ?? null,
      date: toDateKey(row.session.date),
      status: row.status,
      note: row.manualOverrideReason ?? null,
      sessionId: row.sessionId,
      periodId: row.session.periodId,
      timetableEntryId: row.session.timetableEntryId ?? null,
    }));
  }

  async getSessionRecords(sessionId: string) {
    return this.db.attendanceRecord.findMany({
      where: { sessionId },
      include: { student: true },
      orderBy: { capturedAt: 'asc' },
    });
  }
}
