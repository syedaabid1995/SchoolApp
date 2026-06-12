import { prisma as defaultPrisma } from '../../../config/db';
import type { Prisma } from '@prisma/client';
import type {
  StudentAttendanceAdapter,
  StudentAttendanceSessionOverview,
  StudentAttendanceSessionOverviewParams,
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

export class SessionAttendanceReadAdapter implements StudentAttendanceAdapter {
  readonly source = 'session-attendance' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getStudentAttendance(params: StudentAttendanceReadParams): Promise<StudentDailyAttendance[]> {
    const date = buildDateRange(params);
    const sessions = await this.db.studentAttendanceSession.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(date ? { date } : {}),
        ...(params.studentId ? { records: { some: { studentId: params.studentId } } } : {}),
      },
      include: {
        records: params.studentId ? { where: { studentId: params.studentId } } : true,
      },
      orderBy: [{ date: 'asc' }, { classId: 'asc' }],
    });

    return sessions.flatMap((session) =>
      session.records.map((record) => ({
        source: this.source,
        sourceId: record.id,
        schoolId: session.schoolId,
        studentId: record.studentId,
        classId: session.classId,
        sectionId: session.sectionId ?? null,
        academicSessionId: null,
        date: toDateKey(session.date),
        status: record.status,
        note: record.remarks ?? null,
        sessionId: session.id,
        periodId: null,
        timetableEntryId: null,
      })),
    );
  }

  async getSessionOverview(params: StudentAttendanceSessionOverviewParams): Promise<StudentAttendanceSessionOverview[]> {
    const date = params.date ? toDateOnly(params.date) : undefined;
    const where: Prisma.StudentAttendanceSessionWhereInput = {
      schoolId: params.schoolId,
      ...(date ? { date } : {}),
    };

    if (Array.isArray(params.classId)) {
      where.classId = { in: params.classId };
    } else if (params.classId) {
      where.classId = params.classId;
    }

    if (params.sectionId !== undefined) {
      where.sectionId = params.sectionId;
    }

    if (params.classSectionPairs?.length) {
      where.OR = params.classSectionPairs.map((pair) => ({
        classId: pair.classId,
        sectionId: pair.sectionId,
      }));
    }

    const sessions = await this.db.studentAttendanceSession.findMany({
      where,
      include: {
        records: true,
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      schoolId: session.schoolId,
      date: session.date,
      status: session.status,
      classId: session.classId,
      className: session.class.name,
      sectionId: session.sectionId,
      sectionName: session.section?.name ?? 'N/A',
      lockedAt: session.lockedAt,
      lockReason: session.lockReason,
      recordCount: session.records.length,
      records: session.records.map((record) => ({
        source: this.source,
        sourceId: record.id,
        schoolId: session.schoolId,
        studentId: record.studentId,
        classId: session.classId,
        sectionId: session.sectionId ?? null,
        academicSessionId: null,
        date: toDateKey(session.date),
        status: record.status,
        note: record.remarks ?? null,
        sessionId: session.id,
        periodId: null,
        timetableEntryId: null,
      })),
    }));
  }
}
