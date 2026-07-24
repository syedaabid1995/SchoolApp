import { api } from '../lib/api';
import {
  createAttendancePeriodForAcademics,
  createTimetableVersion,
  deleteAttendancePeriodForAcademics,
  deleteTimetableEntry,
  generateTimetableEntries,
  listAcademicYears,
  listAttendancePeriodsForAcademics,
  listTimetableEntries,
  listTimetableVersions,
  publishTimetableVersion,
  updateAttendancePeriodForAcademics,
  updateTimetableEntry,
  upsertTimetableEntries,
  type TimetableEntry,
  type TimetableVersion,
} from './academic.service';

export type SubjectType = 'THEORY' | 'PRACTICAL';
export type TimePeriodType = 'CLASS_TIME' | 'EXAM_TIME' | 'BREAK';

export type ClassSectionLink = {
  id: string;
  sectionId: string;
  section: { id: string; name: string };
};

export type AcademicClass = {
  id: string;
  name: string;
  academicYearId?: string | null;
  academicYear?: { id: string; name: string } | null;
  classSections?: ClassSectionLink[];
  _count?: {
    students?: number;
    subjects?: number;
    timetableEntries?: number;
    assignSubjects?: number;
    classTeachers?: number;
    classRoutines?: number;
  };
};

export type AcademicSection = {
  id: string;
  name: string;
  schoolId: string;
  classId?: string | null;
  classSections?: Array<{ classId: string; class?: { id: string; name: string } }>;
  _count?: { students?: number; classSections?: number };
};

export type AcademicSubject = {
  id: string;
  name: string;
  code?: string | null;
  type: SubjectType;
  _count?: { assignSubjects?: number; classRoutines?: number; examPapers?: number; timetableEntries?: number };
};

export type ClassRoom = {
  id: string;
  roomNumber: string;
  capacity: number;
  _count?: { classRoutines?: number };
};

export type TimePeriod = {
  id: string;
  type: TimePeriodType;
  name: string;
  startTime: string;
  endTime: string;
  _count?: { classRoutines?: number };
};

export type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  user?: { email?: string | null };
};

export type AssignSubject = {
  id: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null; type?: SubjectType };
  teacher?: TeacherOption;
};

export type ClassTeacher = {
  id: string;
  classId: string;
  sectionId: string;
  teacherId: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  teacher?: TeacherOption;
};

export type ClassRoutine = {
  id: string;
  classId: string;
  sectionId: string;
  timePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  classRoomId?: string | null;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  timePeriod?: TimePeriod;
  subject?: { id: string; name: string; code?: string | null; type?: SubjectType };
  teacher?: TeacherOption;
  classRoom?: { id: string; roomNumber: string; capacity: number } | null;
};

export type SeedDefaultTimePeriodsResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  skipped: Array<{ name: string; reason: string }>;
  periods: TimePeriod[];
};

export type GenerateClassRoutineResult = {
  createdCount: number;
  skippedCount: number;
  skipped: Array<{ dayOfWeek: number; periodId: string; reason: string }>;
  routines: ClassRoutine[];
};

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

const DEFAULT_TIME_PERIODS: Array<{ type: TimePeriodType; name: string; startTime: string; endTime: string }> = [
  { type: 'CLASS_TIME', name: '1ST PERIOD', startTime: '09:00', endTime: '09:45' },
  { type: 'CLASS_TIME', name: '2ND PERIOD', startTime: '09:45', endTime: '10:30' },
  { type: 'BREAK', name: 'SHORT BREAK', startTime: '10:30', endTime: '10:45' },
  { type: 'CLASS_TIME', name: '3RD PERIOD', startTime: '10:45', endTime: '11:30' },
  { type: 'CLASS_TIME', name: '4TH PERIOD', startTime: '11:30', endTime: '12:15' },
  { type: 'BREAK', name: 'LUNCH BREAK', startTime: '12:15', endTime: '13:00' },
  { type: 'CLASS_TIME', name: '5TH PERIOD', startTime: '13:00', endTime: '13:45' },
  { type: 'CLASS_TIME', name: '6TH PERIOD', startTime: '13:45', endTime: '14:30' },
  { type: 'CLASS_TIME', name: '7TH PERIOD', startTime: '14:30', endTime: '15:15' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const getCurrentAcademicYear = async () => {
  const years = await listAcademicYears();
  const today = todayIso();
  const items = Array.isArray(years) ? years : [];
  const current =
    items.find((year: any) => year.isActive) ??
    items.find((year: any) => String(year.startDate ?? '') <= today && String(year.endDate ?? '') >= today) ??
    items[0];
  if (!current?.id) throw new Error('Create an academic year before managing timetable entries.');
  return current as { id: string; name?: string; startDate?: string; endDate?: string };
};

const getDraftTimetableVersion = async (createIfMissing: boolean): Promise<TimetableVersion | null> => {
  const academicYear = await getCurrentAcademicYear();
  const versions = await listTimetableVersions({ academicYearId: academicYear.id });
  const draft = versions.find((version) => version.status === 'DRAFT');
  if (draft || !createIfMissing) return draft ?? null;

  return createTimetableVersion({
    academicYearId: academicYear.id,
    name: `Draft Timetable ${todayIso()}`,
    effectiveFrom: academicYear.startDate ?? todayIso(),
    effectiveTo: academicYear.endDate ?? null,
  });
};

const toTimePeriod = (period: Awaited<ReturnType<typeof listAttendancePeriodsForAcademics>>[number]): TimePeriod => ({
  id: period.id,
  type: (period.type ?? 'CLASS_TIME') as TimePeriodType,
  name: period.name,
  startTime: period.startTime,
  endTime: period.endTime,
  _count: { classRoutines: period._count?.timetableEntries ?? 0 },
});

const toClassRoutine = (entry: TimetableEntry): ClassRoutine => ({
  id: entry.id,
  classId: entry.classId,
  sectionId: entry.sectionId ?? '',
  timePeriodId: entry.attendancePeriodId,
  dayOfWeek: entry.dayOfWeek,
  subjectId: entry.subjectId,
  teacherId: entry.teacherId,
  classRoomId: entry.classRoomId ?? null,
  class: entry.class,
  section: entry.section ?? undefined,
  timePeriod: entry.period
    ? {
        id: entry.period.id,
        type: (entry.period.type ?? 'CLASS_TIME') as TimePeriodType,
        name: entry.period.name,
        startTime: entry.period.startTime,
        endTime: entry.period.endTime,
      }
    : undefined,
  subject: entry.subject,
  teacher: entry.teacher,
  classRoom: entry.classRoom
    ? {
        id: entry.classRoom.id,
        roomNumber: entry.classRoom.roomNumber,
        capacity: entry.classRoom.capacity ?? 0,
      }
    : null,
});

const isOverlappingPeriod = (candidate: { startTime: string; endTime: string }, existing: TimePeriod) =>
  candidate.startTime < existing.endTime && candidate.endTime > existing.startTime;

export const listSetupClasses = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<AcademicClass[]>('/academic-setup/classes', { params: sanitizeParams(params) });
  return data;
};

export const createSetupClass = async (payload: { name: string; academicYearId?: string | null; sectionIds?: string[] }) => {
  const { data } = await api.post<AcademicClass>('/academic-setup/classes', payload);
  return data;
};

export const updateSetupClass = async (id: string, payload: { name?: string; academicYearId?: string | null; sectionIds?: string[] }) => {
  const { data } = await api.patch<AcademicClass>(`/academic-setup/classes/${id}`, payload);
  return data;
};

export const deleteSetupClass = async (id: string) => {
  await api.delete(`/academic-setup/classes/${id}`);
};

export const listSetupSections = async (params?: { schoolId?: string; search?: string; classId?: string }) => {
  const { data } = await api.get<AcademicSection[]>('/academic-setup/sections', { params: sanitizeParams(params) });
  return data;
};

export const createSetupSection = async (payload: { name: string }) => {
  const { data } = await api.post<AcademicSection>('/academic-setup/sections', payload);
  return data;
};

export const updateSetupSection = async (id: string, payload: { name?: string }) => {
  const { data } = await api.patch<AcademicSection>(`/academic-setup/sections/${id}`, payload);
  return data;
};

export const deleteSetupSection = async (id: string) => {
  await api.delete(`/academic-setup/sections/${id}`);
};

export const listSetupSubjects = async (params?: { search?: string }) => {
  const { data } = await api.get<AcademicSubject[]>('/academic-setup/subjects', { params: sanitizeParams(params) });
  return data;
};

export const createSetupSubject = async (payload: { name: string; code?: string | null; type: SubjectType }) => {
  const { data } = await api.post<AcademicSubject>('/academic-setup/subjects', payload);
  return data;
};

export const updateSetupSubject = async (id: string, payload: { name?: string; code?: string | null; type?: SubjectType }) => {
  const { data } = await api.patch<AcademicSubject>(`/academic-setup/subjects/${id}`, payload);
  return data;
};

export const deleteSetupSubject = async (id: string) => {
  await api.delete(`/academic-setup/subjects/${id}`);
};

export const listClassRooms = async (params?: { search?: string }) => {
  const { data } = await api.get<ClassRoom[]>('/academic-setup/rooms', { params: sanitizeParams(params) });
  return data;
};

export const createClassRoom = async (payload: { roomNumber: string; capacity: number }) => {
  const { data } = await api.post<ClassRoom>('/academic-setup/rooms', payload);
  return data;
};

export const updateClassRoom = async (id: string, payload: { roomNumber?: string; capacity?: number }) => {
  const { data } = await api.patch<ClassRoom>(`/academic-setup/rooms/${id}`, payload);
  return data;
};

export const deleteClassRoom = async (id: string) => {
  await api.delete(`/academic-setup/rooms/${id}`);
};

export const listTimePeriods = async () => {
  const periods = await listAttendancePeriodsForAcademics();
  return periods.map(toTimePeriod);
};

export const createTimePeriod = async (payload: { type: TimePeriodType; name: string; startTime: string; endTime: string }) => {
  const period = await createAttendancePeriodForAcademics(payload);
  return toTimePeriod(period as Awaited<ReturnType<typeof listAttendancePeriodsForAcademics>>[number]);
};

export const updateTimePeriod = async (id: string, payload: Partial<{ type: TimePeriodType; name: string; startTime: string; endTime: string }>) => {
  const period = await updateAttendancePeriodForAcademics(id, payload);
  return toTimePeriod(period as Awaited<ReturnType<typeof listAttendancePeriodsForAcademics>>[number]);
};

export const deleteTimePeriod = async (id: string) => {
  await deleteAttendancePeriodForAcademics(id);
};

export const seedDefaultTimePeriods = async () => {
  const existing = await listTimePeriods();
  const skipped: Array<{ name: string; reason: string }> = [];
  const periods: TimePeriod[] = [];
  let createdCount = 0;
  let updatedCount = 0;

  for (const period of DEFAULT_TIME_PERIODS) {
    const match = existing.find(
      (item) => item.type === period.type && item.name.trim().toLowerCase() === period.name.trim().toLowerCase(),
    );
    const overlap = existing.find((item) => item.id !== match?.id && isOverlappingPeriod(period, item));
    if (overlap) {
      skipped.push({
        name: period.name,
        reason: `Overlaps with ${overlap.name} (${overlap.startTime}-${overlap.endTime})`,
      });
      continue;
    }

    if (match) {
      periods.push(await updateTimePeriod(match.id, period));
      updatedCount += 1;
      continue;
    }

    periods.push(await createTimePeriod(period));
    createdCount += 1;
  }

  return {
    createdCount,
    updatedCount,
    skippedCount: skipped.length,
    skipped,
    periods,
  };
};

export const listAssignSubjects = async (params?: { classId?: string; sectionId?: string }) => {
  const { data } = await api.get<AssignSubject[]>('/academic-setup/assign-subjects', { params: sanitizeParams(params) });
  return data;
};

export const saveAssignSubjects = async (payload: {
  classId: string;
  sectionId: string;
  replace?: boolean;
  assignments: Array<{ subjectId: string; teacherId: string }>;
}) => {
  const { data } = await api.post<AssignSubject[]>('/academic-setup/assign-subjects', payload);
  return data;
};

export const deleteAssignSubject = async (id: string) => {
  await api.delete(`/academic-setup/assign-subjects/${id}`);
};

export const listClassTeachers = async () => {
  const { data } = await api.get<ClassTeacher[]>('/academic-setup/class-teachers');
  return data;
};

export const saveClassTeacher = async (payload: { classId: string; sectionId: string; teacherId: string }) => {
  const { data } = await api.post<ClassTeacher>('/academic-setup/class-teachers', payload);
  return data;
};

export const updateClassTeacher = async (id: string, payload: Partial<{ classId: string; sectionId: string; teacherId: string }>) => {
  const { data } = await api.patch<ClassTeacher>(`/academic-setup/class-teachers/${id}`, payload);
  return data;
};

export const deleteClassTeacher = async (id: string) => {
  await api.delete(`/academic-setup/class-teachers/${id}`);
};

export const listClassRoutines = async (params?: { classId?: string; sectionId?: string; teacherId?: string }) => {
  const version = await getDraftTimetableVersion(false);
  if (!version) return [];
  const entries = await listTimetableEntries({ timetableVersionId: version.id });
  const sanitized = sanitizeParams(params);
  return entries
    .map(toClassRoutine)
    .filter((item) => {
      if (sanitized?.classId && item.classId !== sanitized.classId) return false;
      if (sanitized?.sectionId && item.sectionId !== sanitized.sectionId) return false;
      if (sanitized?.teacherId && item.teacherId !== sanitized.teacherId) return false;
      return true;
    });
};

export const createClassRoutine = async (payload: {
  classId: string;
  sectionId: string;
  dayOfWeek: number;
  timePeriodId: string;
  subjectId: string;
  teacherId: string;
  classRoomId?: string | null;
}) => {
  const version = await getDraftTimetableVersion(true);
  if (!version) throw new Error('Create an academic year before managing timetable entries.');
  const [entry] = await upsertTimetableEntries({
    timetableVersionId: version.id,
    entries: [
      {
        classId: payload.classId,
        sectionId: payload.sectionId,
        attendancePeriodId: payload.timePeriodId,
        dayOfWeek: payload.dayOfWeek,
        subjectId: payload.subjectId,
        teacherId: payload.teacherId,
        classRoomId: payload.classRoomId ?? null,
      },
    ],
  });
  return toClassRoutine(entry);
};

export const updateClassRoutine = async (id: string, payload: Partial<{
  classId: string;
  sectionId: string;
  dayOfWeek: number;
  timePeriodId: string;
  subjectId: string;
  teacherId: string;
  classRoomId: string | null;
}>) => {
  const entry = await updateTimetableEntry(id, {
    classId: payload.classId,
    sectionId: payload.sectionId,
    attendancePeriodId: payload.timePeriodId,
    dayOfWeek: payload.dayOfWeek,
    subjectId: payload.subjectId,
    teacherId: payload.teacherId,
    classRoomId: payload.classRoomId,
  });
  return toClassRoutine(entry);
};

export const deleteClassRoutine = async (id: string) => {
  await deleteTimetableEntry(id);
};

export const generateClassRoutine = async (payload: {
  classId: string;
  sectionId: string;
  classRoomId?: string | null;
  replaceExisting?: boolean;
  days?: number[];
}) => {
  const version = await getDraftTimetableVersion(true);
  if (!version) throw new Error('Create an academic year before generating timetable entries.');
  const result = await generateTimetableEntries({
    timetableVersionId: version.id,
    classId: payload.classId,
    sectionId: payload.sectionId,
    classRoomId: payload.classRoomId ?? null,
    replaceExisting: payload.replaceExisting,
    days: payload.days,
  });
  return {
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    skipped: result.skipped,
    routines: result.entries.map(toClassRoutine),
  };
};

export const publishCurrentTimetableDraft = async () => {
  const version = await getDraftTimetableVersion(false);
  if (!version) throw new Error('No draft timetable is available to publish.');
  return publishTimetableVersion(version.id);
};
