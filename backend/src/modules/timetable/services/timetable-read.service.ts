import { prisma as defaultPrisma } from '../../../config/db';
import { ClassRoutineAdapter } from '../adapters/class-routine.adapter';
import { TimetableEntryAdapter } from '../adapters/timetable-entry.adapter';
import type {
  ClassTimetable,
  DashboardTimetable,
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
  classRoutineAdapter?: TimetableAdapter;
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
  private readonly classRoutineAdapter: TimetableAdapter;
  private readonly timetableEntryAdapter: TimetableAdapter;
  private readonly db: PrismaLike;

  constructor(options: TimetableReadServiceOptions = {}) {
    this.db = options.prisma ?? defaultPrisma;
    this.classRoutineAdapter = options.classRoutineAdapter ?? new ClassRoutineAdapter(this.db);
    this.timetableEntryAdapter = options.timetableEntryAdapter ?? new TimetableEntryAdapter(this.db);
  }

  private adapters(mode: TimetableReadMode = 'combined') {
    if (mode === 'legacy') return [this.classRoutineAdapter];
    if (mode === 'modern') return [this.timetableEntryAdapter];
    return [this.classRoutineAdapter, this.timetableEntryAdapter];
  }

  async getTimetable(params: TimetableReadParams & { mode?: TimetableReadMode }): Promise<TimetableSlot[]> {
    const sources = await Promise.all(this.adapters(params.mode).map((adapter) => adapter.getTimetable(params)));
    return sortSlots(sources.flat());
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
