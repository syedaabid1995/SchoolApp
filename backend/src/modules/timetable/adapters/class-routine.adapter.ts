import { prisma as defaultPrisma } from '../../../config/db';
import type { TimetableAdapter, TimetableReadParams, TimetableSlot } from '../models/timetable-read-model';

type PrismaLike = typeof defaultPrisma;

const teacherName = (teacher: { firstName?: string | null; lastName?: string | null }) =>
  [teacher.firstName, teacher.lastName].filter(Boolean).join(' ');

export class ClassRoutineAdapter implements TimetableAdapter {
  readonly source = 'class-routine' as const;

  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  async getTimetable(params: TimetableReadParams): Promise<TimetableSlot[]> {
    const rows = await this.db.classRoutine.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.teacherId ? { teacherId: params.teacherId } : {}),
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId !== undefined ? { sectionId: params.sectionId } : {}),
        ...(typeof params.dayOfWeek === 'number' ? { dayOfWeek: params.dayOfWeek } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } },
        timePeriod: { select: { id: true, name: true, type: true, startTime: true, endTime: true } },
        subject: { select: { name: true, code: true, type: true } },
        teacher: { select: { firstName: true, lastName: true, employeeNo: true } },
        classRoom: { select: { id: true, roomNumber: true, capacity: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { timePeriod: { startTime: 'asc' } }],
    });

    return rows.map((row) => ({
      schoolId: row.schoolId,
      dayOfWeek: row.dayOfWeek,
      periodId: row.timePeriodId,
      periodName: row.timePeriod?.name ?? null,
      periodType: row.timePeriod?.type ?? null,
      startTime: row.timePeriod?.startTime ?? null,
      endTime: row.timePeriod?.endTime ?? null,
      subjectId: row.subjectId,
      subjectName: row.subject?.name ?? '',
      subjectCode: row.subject?.code ?? null,
      subjectType: row.subject?.type ?? null,
      teacherId: row.teacherId,
      teacherName: teacherName(row.teacher),
      teacherEmployeeNo: row.teacher?.employeeNo ?? null,
      classId: row.classId,
      className: row.class?.name ?? null,
      sectionId: row.sectionId,
      sectionName: row.section?.name ?? null,
      roomId: row.classRoomId ?? null,
      roomName: row.classRoom?.roomNumber ?? null,
      roomCapacity: row.classRoom?.capacity ?? null,
      isActive: true,
      createdAt: row.createdAt ?? null,
      updatedAt: row.updatedAt ?? null,
      source: this.source,
      sourceId: row.id,
      timetableVersionId: null,
      academicYearId: null,
      teacherFirstName: row.teacher?.firstName ?? null,
      teacherLastName: row.teacher?.lastName ?? null,
    }));
  }
}
