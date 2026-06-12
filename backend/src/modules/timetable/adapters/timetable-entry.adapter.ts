import { prisma as defaultPrisma } from '../../../config/db';
import type { TimetableAdapter, TimetableReadParams, TimetableSlot } from '../models/timetable-read-model';

type PrismaLike = typeof defaultPrisma;

const toDateOnly = (value: Date | string) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const teacherName = (teacher: { firstName?: string | null; lastName?: string | null }) =>
  [teacher.firstName, teacher.lastName].filter(Boolean).join(' ');

export class TimetableEntryAdapter implements TimetableAdapter {
  readonly source = 'timetable-entry' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getTimetable(params: TimetableReadParams): Promise<TimetableSlot[]> {
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
        ...(typeof params.dayOfWeek === 'number' ? { dayOfWeek: params.dayOfWeek } : {}),
        ...(typeof params.isActive === 'boolean' ? { isActive: params.isActive } : {}),
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
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        period: { select: { id: true, name: true, startTime: true, endTime: true } },
        subject: { select: { name: true, code: true, type: true } },
        teacher: { select: { firstName: true, lastName: true, employeeNo: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: { startTime: 'asc' } }],
    });

    return rows.map((row) => ({
      schoolId: row.schoolId,
      dayOfWeek: row.dayOfWeek,
      periodId: row.attendancePeriodId,
      periodName: row.period?.name ?? null,
      periodType: null,
      startTime: row.period?.startTime ?? null,
      endTime: row.period?.endTime ?? null,
      subjectId: row.subjectId,
      subjectName: row.subject?.name ?? '',
      subjectCode: row.subject?.code ?? null,
      subjectType: row.subject?.type ?? null,
      teacherId: row.teacherId,
      teacherName: teacherName(row.teacher),
      teacherEmployeeNo: row.teacher?.employeeNo ?? null,
      classId: row.classId,
      className: row.class?.name ?? null,
      sectionId: row.sectionId ?? null,
      sectionName: row.section?.name ?? null,
      roomId: null,
      roomName: row.room ?? null,
      roomCapacity: null,
      isActive: row.isActive,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      source: this.source,
      sourceId: row.id,
      timetableVersionId: row.timetableVersionId,
      academicYearId: row.academicYearId,
      teacherFirstName: row.teacher?.firstName ?? null,
      teacherLastName: row.teacher?.lastName ?? null,
    }));
  }
}
