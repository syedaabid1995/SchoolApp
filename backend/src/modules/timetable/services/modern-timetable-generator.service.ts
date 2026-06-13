import { Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../../../config/db';
import { HttpError } from '../../../middlewares/error.middleware';

type PrismaLike = typeof defaultPrisma;

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

const allRoutineDayValues = [1, 2, 3, 4, 5, 6, 7];

const normalizeRoomLabel = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

const weekendValuesFromJson = (weekends: Prisma.JsonValue | null | undefined) => {
  const values = new Set<number>();
  if (!Array.isArray(weekends)) return new Set([7]);

  for (const item of weekends) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const day = item as Record<string, unknown>;
    if (day.isWeekend !== true) continue;
    const key = String(day.id ?? day.name ?? '').trim().toLowerCase();
    const value = dayValueByKey.get(key);
    if (value) values.add(value);
  }

  return values;
};

type ModernTimetableGeneratorInput = {
  schoolId: string;
  timetableVersionId?: string;
  classId: string;
  sectionId: string;
  classRoomId?: string | null;
  days?: number[];
  replaceExisting?: boolean;
};

type SkippedSlot = {
  dayOfWeek: number;
  periodId: string;
  reason: string;
};

export type ModernTimetableGeneratorResult = {
  createdCount: number;
  skippedCount: number;
  skipped: SkippedSlot[];
  entries: Awaited<ReturnType<PrismaLike['timetableEntry']['findMany']>>;
};

export class ModernTimetableGeneratorService {
  constructor(private readonly db: PrismaLike = defaultPrisma) {}

  private async resolveDraftVersion(params: { schoolId: string; timetableVersionId?: string }) {
    const where = params.timetableVersionId
      ? { id: params.timetableVersionId, schoolId: params.schoolId, status: 'DRAFT' as const }
      : { schoolId: params.schoolId, status: 'DRAFT' as const };

    const version = await this.db.timetableVersion.findFirst({
      where,
      select: { id: true, academicYearId: true, createdAt: true },
      orderBy: params.timetableVersionId ? undefined : [{ createdAt: 'desc' }],
    });

    if (!version) throw new HttpError(404, 'Draft timetable version not found');
    return version;
  }

  private async validateScope(params: ModernTimetableGeneratorInput) {
    const [classRecord, section, classSection, classRoom] = await Promise.all([
      this.db.class.findFirst({ where: { id: params.classId, schoolId: params.schoolId }, select: { id: true } }),
      this.db.section.findFirst({ where: { id: params.sectionId, schoolId: params.schoolId }, select: { id: true } }),
      this.db.classSection.findFirst({
        where: { schoolId: params.schoolId, classId: params.classId, sectionId: params.sectionId },
        select: { id: true },
      }),
      params.classRoomId
        ? this.db.classRoom.findFirst({
            where: { id: params.classRoomId, schoolId: params.schoolId },
            select: { id: true, roomNumber: true },
          })
        : Promise.resolve(null),
    ]);

    if (!classRecord) throw new HttpError(404, 'Class not found');
    if (!section) throw new HttpError(404, 'Section not found');
    if (!classSection) throw new HttpError(400, 'Section is not assigned to the selected class');
    if (params.classRoomId && !classRoom) throw new HttpError(404, 'Class room not found');
    return { classRoom };
  }

  async generate(params: ModernTimetableGeneratorInput): Promise<ModernTimetableGeneratorResult> {
    const [version, { classRoom }, setting] = await Promise.all([
      this.resolveDraftVersion({ schoolId: params.schoolId, timetableVersionId: params.timetableVersionId }),
      this.validateScope(params),
      this.db.schoolSystemSetting.findUnique({ where: { schoolId: params.schoolId }, select: { weekends: true } }),
    ]);

    const weekendValues = weekendValuesFromJson(setting?.weekends);
    const requestedDays = params.days?.length ? params.days : allRoutineDayValues;
    const days = [...new Set(requestedDays)].filter((day) => !weekendValues.has(day)).sort((a, b) => a - b);
    if (!days.length) throw new HttpError(400, 'All selected days are configured as weekend');

    const [periods, assignments] = await Promise.all([
      this.db.attendancePeriod.findMany({
        where: { schoolId: params.schoolId, type: 'CLASS_TIME' },
        orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
      }),
      this.db.assignSubject.findMany({
        where: { schoolId: params.schoolId, classId: params.classId, sectionId: params.sectionId },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true, employeeNo: true } },
        },
        orderBy: [{ subject: { name: 'asc' } }],
      }),
    ]);

    if (!periods.length) throw new HttpError(400, 'Add class time periods before generating routine');
    if (!assignments.length) throw new HttpError(400, 'Assign subjects and teachers before generating routine');

    const periodIds = periods.map((period) => period.id);
    const roomLabel = classRoom?.roomNumber ?? null;
    const normalizedRequestedRoomLabel = normalizeRoomLabel(roomLabel);

    return this.db.$transaction(async (tx) => {
      if (params.replaceExisting) {
        await tx.timetableEntry.deleteMany({
          where: {
            schoolId: params.schoolId,
            timetableVersionId: version.id,
            classId: params.classId,
            sectionId: params.sectionId,
            dayOfWeek: { in: days },
            attendancePeriodId: { in: periodIds },
          },
        });
      }

      const existingEntries = await tx.timetableEntry.findMany({
        where: {
          schoolId: params.schoolId,
          timetableVersionId: version.id,
          dayOfWeek: { in: days },
          attendancePeriodId: { in: periodIds },
          isActive: true,
        },
        select: {
          classId: true,
          sectionId: true,
          dayOfWeek: true,
          attendancePeriodId: true,
          teacherId: true,
          classRoomId: true,
          room: true,
        },
      });

      const occupiedClassSlots = new Set<string>();
      const busyTeacherSlots = new Set<string>();
      const busyRoomSlots = new Set<string>();
      for (const entry of existingEntries) {
        if (entry.classId === params.classId && entry.sectionId === params.sectionId) {
          occupiedClassSlots.add(`${entry.dayOfWeek}:${entry.attendancePeriodId}`);
        }
        busyTeacherSlots.add(`${entry.teacherId}:${entry.dayOfWeek}:${entry.attendancePeriodId}`);
        if (entry.classRoomId) {
          busyRoomSlots.add(`id:${entry.classRoomId}:${entry.dayOfWeek}:${entry.attendancePeriodId}`);
        } else {
          const normalizedRoom = normalizeRoomLabel(entry.room);
          if (normalizedRoom) busyRoomSlots.add(`label:${normalizedRoom}:${entry.dayOfWeek}:${entry.attendancePeriodId}`);
        }
      }

      const skipped: SkippedSlot[] = [];
      const createData: Prisma.TimetableEntryCreateManyInput[] = [];
      let cursor = 0;

      for (const dayOfWeek of days) {
        for (const period of periods) {
          const classSlotKey = `${dayOfWeek}:${period.id}`;
          if (occupiedClassSlots.has(classSlotKey)) {
            skipped.push({ dayOfWeek, periodId: period.id, reason: 'Class-section already has a routine in this period' });
            continue;
          }

          let selected: (typeof assignments)[number] | null = null;
          for (let offset = 0; offset < assignments.length; offset += 1) {
            const candidate = assignments[(cursor + offset) % assignments.length];
            const teacherSlotKey = `${candidate.teacherId}:${dayOfWeek}:${period.id}`;
            const roomSlotKeys = params.classRoomId
              ? [
                  `id:${params.classRoomId}:${dayOfWeek}:${period.id}`,
                  ...(normalizedRequestedRoomLabel ? [`label:${normalizedRequestedRoomLabel}:${dayOfWeek}:${period.id}`] : []),
                ]
              : [];
            if (!busyTeacherSlots.has(teacherSlotKey) && roomSlotKeys.every((key) => !busyRoomSlots.has(key))) {
              selected = candidate;
              cursor = (cursor + offset + 1) % assignments.length;
              break;
            }
          }

          if (!selected) {
            skipped.push({ dayOfWeek, periodId: period.id, reason: 'No assigned teacher available for this period' });
            continue;
          }

          createData.push({
            schoolId: params.schoolId,
            timetableVersionId: version.id,
            academicYearId: version.academicYearId,
            classId: params.classId,
            sectionId: params.sectionId,
            attendancePeriodId: period.id,
            dayOfWeek,
            subjectId: selected.subjectId,
            teacherId: selected.teacherId,
            classRoomId: params.classRoomId ?? null,
            room: roomLabel,
            isActive: true,
          });
          occupiedClassSlots.add(classSlotKey);
          busyTeacherSlots.add(`${selected.teacherId}:${dayOfWeek}:${period.id}`);
          if (params.classRoomId) {
            busyRoomSlots.add(`id:${params.classRoomId}:${dayOfWeek}:${period.id}`);
            if (normalizedRequestedRoomLabel) busyRoomSlots.add(`label:${normalizedRequestedRoomLabel}:${dayOfWeek}:${period.id}`);
          }
        }
      }

      const created = createData.length
        ? await tx.timetableEntry.createMany({ data: createData, skipDuplicates: true })
        : { count: 0 };

      const entries = await tx.timetableEntry.findMany({
        where: {
          schoolId: params.schoolId,
          timetableVersionId: version.id,
          classId: params.classId,
          sectionId: params.sectionId,
        },
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          period: { select: { id: true, name: true, type: true, startTime: true, endTime: true } },
          subject: { select: { id: true, name: true, code: true, type: true } },
          teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
          classRoom: { select: { id: true, roomNumber: true, capacity: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { period: { startTime: 'asc' } }],
      });

      return { createdCount: created.count, skippedCount: skipped.length, skipped, entries };
    });
  }
}

export const modernTimetableGeneratorService = new ModernTimetableGeneratorService();
