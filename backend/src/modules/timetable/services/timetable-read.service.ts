import { prisma as defaultPrisma } from '../../../config/db';
import { TimetableEntryAdapter } from '../adapters/timetable-entry.adapter';
import type {
  ClassTimetable,
  DashboardTimetable,
  LegacyTimePeriod,
  LegacyTimePeriodReadParams,
  ParentTimetable,
  StudentTimetableReadParams,
  TeacherTimetable,
  TimetableAdapter,
  TimetableReadMode,
  TimetableReadParams,
  TimetableSlot,
} from '../models/timetable-read-model';

type PrismaLike = typeof defaultPrisma;

type TimetableReadServiceOptions = {
  timetableEntryAdapter?: TimetableAdapter;
  prisma?: PrismaLike;
};

const sortSlots = (slots: TimetableSlot[]) =>
  [...slots].sort((a, b) => {
    const dayCompare = a.dayOfWeek - b.dayOfWeek;
    if (dayCompare) return dayCompare;
    const startCompare = (a.startTime ?? '').localeCompare(b.startTime ?? '');
    if (startCompare) return startCompare;
    return a.source.localeCompare(b.source);
  });

export class TimetableReadService {
  private readonly timetableEntryAdapter: TimetableAdapter;
  private readonly db: PrismaLike;

  constructor(options: TimetableReadServiceOptions = {}) {
    this.db = options.prisma ?? defaultPrisma;
    this.timetableEntryAdapter = options.timetableEntryAdapter ?? new TimetableEntryAdapter(this.db);
  }

  private adapters(_mode: TimetableReadMode = 'combined') {
    return [this.timetableEntryAdapter];
  }

  async getTimetable(params: TimetableReadParams & { mode?: TimetableReadMode }): Promise<TimetableSlot[]> {
    const sources = await Promise.all(this.adapters(params.mode).map((adapter) => adapter.getTimetable(params)));
    return sortSlots(sources.flat());
  }

  async getLegacyTimePeriods(params: LegacyTimePeriodReadParams): Promise<LegacyTimePeriod[]> {
    const periods = await this.db.attendancePeriod.findMany({
      where: {
        schoolId: params.schoolId,
        ...(params.type ? { type: params.type as any } : {}),
      },
      orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
      ...(params.includeRoutineCount ? { include: { _count: { select: { timetableEntries: true } } } } : {}),
      ...(params.selectPublicFieldsOnly ? { select: { id: true, name: true, startTime: true, endTime: true, type: true } } : {}),
    } as any);

    return periods.map((period: any) => ({
      ...period,
      _count: period._count ? { classRoutines: period._count.timetableEntries ?? 0 } : undefined,
    }));
  }

  async getTeacherTimetable(params: TimetableReadParams & { teacherId: string; mode?: TimetableReadMode }): Promise<TeacherTimetable> {
    const mode = params.mode ?? 'combined';
    return {
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      mode,
      slots: await this.getTimetable({ ...params, mode }),
    };
  }

  async getClassTimetable(params: TimetableReadParams & { classId: string; mode?: TimetableReadMode }): Promise<ClassTimetable> {
    const mode = params.mode ?? 'combined';
    return {
      schoolId: params.schoolId,
      classId: params.classId,
      sectionId: params.sectionId ?? null,
      mode,
      slots: await this.getTimetable({ ...params, mode }),
    };
  }

  async getStudentTimetable(params: StudentTimetableReadParams & { mode?: TimetableReadMode }): Promise<ParentTimetable> {
    const mode = params.mode ?? 'combined';
    const resolved = await this.resolveStudentScope(params);
    return {
      schoolId: params.schoolId,
      studentId: params.studentId,
      classId: resolved.classId,
      sectionId: resolved.sectionId,
      mode,
      slots: resolved.classId
        ? await this.getTimetable({
            ...params,
            mode,
            classId: resolved.classId,
            sectionId: resolved.sectionId,
          })
        : [],
    };
  }

  async getParentTimetable(params: StudentTimetableReadParams & { mode?: TimetableReadMode }): Promise<ParentTimetable> {
    return this.getStudentTimetable(params);
  }

  async getDashboardTimetable(params: TimetableReadParams & { mode?: TimetableReadMode }): Promise<DashboardTimetable> {
    const mode = params.mode ?? 'combined';
    return {
      schoolId: params.schoolId,
      mode,
      slots: await this.getTimetable({ ...params, mode }),
    };
  }

  private async resolveStudentScope(params: StudentTimetableReadParams) {
    if (params.classId) {
      return { classId: params.classId, sectionId: params.sectionId ?? null };
    }
    if (!params.studentId) {
      return { classId: null, sectionId: params.sectionId ?? null };
    }
    const student = await this.db.student.findFirst({
      where: { id: params.studentId, schoolId: params.schoolId },
      select: { classId: true, sectionId: true },
    });
    return {
      classId: student?.classId ?? null,
      sectionId: student?.sectionId ?? null,
    };
  }
}

export const timetableReadService = new TimetableReadService();
