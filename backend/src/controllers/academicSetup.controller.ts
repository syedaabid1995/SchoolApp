import type { Request, Response } from 'express';
import { Prisma, SubjectType, TimePeriodType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';
import { invalidateAttendanceCache, invalidateTimetableCache } from '../services/cache/cache.invalidation';
import { modernTimetableGeneratorService } from '../modules/timetable/services/modern-timetable-generator.service';

const uuidSchema = z.string().uuid();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm time format');

const requireAcademicSetupUser = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId) {
    throw new HttpError(403, 'School scope is required to manage academic setup');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const requireAcademicSetupReadScope = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.schoolId) return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  if (req.auth.role === 'SUPER_ADMIN' && typeof req.query.schoolId === 'string') {
    return { schoolId: req.query.schoolId, userId: req.auth.userId };
  }
  throw new HttpError(403, 'School scope is required to read academic setup');
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
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

const getConfiguredWeekendValues = async (schoolId: string) => {
  const setting = await prisma.schoolSystemSetting.findUnique({ where: { schoolId }, select: { weekends: true } });
  return weekendValuesFromJson(setting?.weekends);
};

const ensureEndAfterStart = (startTime: string, endTime: string) => {
  if (endTime <= startTime) {
    throw new HttpError(400, 'End time must be after start time');
  }
};

const findOverlappingTimePeriod = async (
  schoolId: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) =>
  prisma.attendancePeriod.findFirst({
    where: {
      schoolId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true, name: true, startTime: true, endTime: true },
  });

const assertNoOverlappingTimePeriod = async (
  schoolId: string,
  startTime: string,
  endTime: string,
  excludeId?: string,
) => {
  const overlap = await findOverlappingTimePeriod(schoolId, startTime, endTime, excludeId);
  if (overlap) {
    throw new HttpError(409, `Time period overlaps with ${overlap.name} (${overlap.startTime}-${overlap.endTime})`);
  }
};

const handleUniqueError = (err: unknown, message: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, message);
  }
  throw err;
};

const assertClass = async (schoolId: string, classId: string) => {
  const found = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Class not found');
};

const assertSection = async (schoolId: string, sectionId: string) => {
  const found = await prisma.section.findFirst({
    where: { id: sectionId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Section not found');
};

const assertClassSection = async (schoolId: string, classId: string, sectionId: string) => {
  const found = await prisma.classSection.findFirst({
    where: { schoolId, classId, sectionId },
    select: { id: true },
  });
  if (!found) throw new HttpError(400, 'Section is not assigned to the selected class');
};

const assertSubject = async (schoolId: string, subjectId: string) => {
  const found = await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } });
  if (!found) throw new HttpError(404, 'Subject not found');
};

const assertTeacher = async (schoolId: string, teacherId: string) => {
  const found = await prisma.teacherProfile.findFirst({
    where: { id: teacherId, schoolId, isActive: true },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Teacher not found');
};

const assertTimePeriod = async (schoolId: string, timePeriodId: string) => {
  const found = await prisma.attendancePeriod.findFirst({
    where: { id: timePeriodId, schoolId },
    select: { id: true, type: true },
  });
  if (!found) throw new HttpError(404, 'Time period not found');
  return found;
};

const assertClassRoom = async (schoolId: string, classRoomId?: string | null) => {
  if (!classRoomId) return;
  const found = await prisma.classRoom.findFirst({
    where: { id: classRoomId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Class room not found');
};

const attendancePeriodLegacySelect = {
  id: true,
  schoolId: true,
  type: true,
  name: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { timetableEntries: true, sessions: true } },
} as const;

const toLegacyTimePeriodRow = (period: {
  id: string;
  schoolId: string;
  type: TimePeriodType;
  name: string;
  startTime: string;
  endTime: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { timetableEntries?: number };
}, includeRoutineCount = false) => ({
  id: period.id,
  schoolId: period.schoolId,
  type: period.type,
  name: period.name,
  startTime: period.startTime,
  endTime: period.endTime,
  createdAt: period.createdAt,
  updatedAt: period.updatedAt,
  ...(includeRoutineCount ? { _count: { classRoutines: period._count?.timetableEntries ?? 0 } } : {}),
});

const toLegacyRoutineScalar = (entry: {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string | null;
  attendancePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  classRoomId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: entry.id,
  schoolId: entry.schoolId,
  classId: entry.classId,
  sectionId: entry.sectionId ?? '',
  timePeriodId: entry.attendancePeriodId,
  dayOfWeek: entry.dayOfWeek,
  subjectId: entry.subjectId,
  teacherId: entry.teacherId,
  classRoomId: entry.classRoomId,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

const toLegacyRoutineRow = (entry: any) => ({
  ...toLegacyRoutineScalar(entry),
  class: entry.class ? { id: entry.class.id, name: entry.class.name } : undefined,
  section: entry.section ? { id: entry.section.id, name: entry.section.name } : null,
  timePeriod: entry.period
    ? {
        id: entry.period.id,
        name: entry.period.name,
        startTime: entry.period.startTime,
        endTime: entry.period.endTime,
        type: entry.period.type,
      }
    : undefined,
  subject: entry.subject
    ? {
        id: entry.subject.id,
        name: entry.subject.name,
        code: entry.subject.code,
        type: entry.subject.type,
      }
    : undefined,
  teacher: entry.teacher
    ? {
        id: entry.teacher.id,
        firstName: entry.teacher.firstName,
        lastName: entry.teacher.lastName,
        employeeNo: entry.teacher.employeeNo,
      }
    : undefined,
  classRoom: entry.classRoom
    ? {
        id: entry.classRoom.id,
        roomNumber: entry.classRoom.roomNumber,
        capacity: entry.classRoom.capacity,
      }
    : null,
});

const timetableEntryLegacyInclude = {
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  period: { select: { id: true, name: true, type: true, startTime: true, endTime: true } },
  subject: { select: { id: true, name: true, code: true, type: true } },
  teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
  classRoom: { select: { id: true, roomNumber: true, capacity: true } },
} satisfies Prisma.TimetableEntryInclude;

const timetableEntryLegacyOrderBy = [
  { dayOfWeek: 'asc' },
  { period: { startTime: 'asc' } },
] satisfies Prisma.TimetableEntryOrderByWithRelationInput[];

const resolveAcademicYearForTimetable = async (schoolId: string, classId?: string) => {
  if (classId) {
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { academicYearId: true },
    });
    if (classRecord?.academicYearId) {
      const academicYear = await prisma.academicYear.findFirst({
        where: { id: classRecord.academicYearId, schoolId },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      if (academicYear) return academicYear;
    }
  }

  const today = new Date();
  return prisma.academicYear.findFirst({
    where: {
      schoolId,
      OR: [
        { isActive: true },
        { startDate: { lte: today }, endDate: { gte: today } },
      ],
    },
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
  });
};

const resolveDraftTimetableVersion = async (params: {
  schoolId: string;
  userId: string;
  classId?: string;
  createIfMissing: boolean;
}) => {
  const academicYear = await resolveAcademicYearForTimetable(params.schoolId, params.classId);
  if (!academicYear) {
    if (params.createIfMissing) throw new HttpError(400, 'Create an academic year before managing timetable entries');
    return null;
  }

  const draft = await prisma.timetableVersion.findFirst({
    where: { schoolId: params.schoolId, academicYearId: academicYear.id, status: 'DRAFT' },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, academicYearId: true },
  });
  if (draft || !params.createIfMissing) return draft;

  return prisma.timetableVersion.create({
    data: {
      schoolId: params.schoolId,
      academicYearId: academicYear.id,
      name: `Draft Timetable ${new Date().toISOString().slice(0, 10)}`,
      effectiveFrom: academicYear.startDate,
      effectiveTo: academicYear.endDate,
      createdById: params.userId,
    },
    select: { id: true, academicYearId: true },
  });
};

const classSchema = z.object({
  name: z.string().min(1).max(80),
  academicYearId: uuidSchema.optional().nullable(),
  sectionIds: z.array(uuidSchema).max(40).optional(),
});

const updateClassSchema = classSchema.partial();

export const listSetupClasses = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: {
      academicYear: { select: { id: true, name: true } },
      classSections: {
        include: { section: { select: { id: true, name: true } } },
        orderBy: { section: { name: 'asc' } },
      },
      _count: {
        select: {
          students: true,
          subjects: true,
          timetableEntries: true,
          assignSubjects: true,
          classTeachers: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.status(200).json(classes.map((item) => ({
    ...item,
    _count: item._count ? { ...item._count, classRoutines: item._count.timetableEntries ?? 0 } : item._count,
  })));
};

export const createSetupClass = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = classSchema.parse(req.body);
  const sectionIds = [...new Set(payload.sectionIds ?? [])];

  if (payload.academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: payload.academicYearId, schoolId },
      select: { id: true },
    });
    if (!year) throw new HttpError(404, 'Academic year not found');
  }

  if (sectionIds.length) {
    const sections = await prisma.section.findMany({
      where: { schoolId, id: { in: sectionIds } },
      select: { id: true },
    });
    if (sections.length !== sectionIds.length) throw new HttpError(404, 'One or more sections are invalid');
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          schoolId,
          name: normalizeText(payload.name),
          academicYearId: payload.academicYearId ?? null,
        },
      });

      if (sectionIds.length) {
        await tx.classSection.createMany({
          data: sectionIds.map((sectionId) => ({ schoolId, classId: created.id, sectionId })),
          skipDuplicates: true,
        });
      }

      return tx.class.findUnique({
        where: { id: created.id },
        include: { classSections: { include: { section: { select: { id: true, name: true } } } } },
      });
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Class name already exists for this school');
  }
};

export const updateSetupClass = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = updateClassSchema.parse(req.body);
  const id = req.params.id;
  await assertClass(schoolId, id);
  const sectionIds = payload.sectionIds ? [...new Set(payload.sectionIds)] : undefined;

  if (payload.academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: payload.academicYearId, schoolId },
      select: { id: true },
    });
    if (!year) throw new HttpError(404, 'Academic year not found');
  }
  if (sectionIds) {
    const sections = await prisma.section.findMany({ where: { schoolId, id: { in: sectionIds } }, select: { id: true } });
    if (sections.length !== sectionIds.length) throw new HttpError(404, 'One or more sections are invalid');
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      await tx.class.update({
        where: { id },
        data: {
          name: payload.name === undefined ? undefined : normalizeText(payload.name),
          academicYearId: payload.academicYearId === undefined ? undefined : payload.academicYearId,
        },
      });
      if (sectionIds) {
        await tx.classSection.deleteMany({ where: { classId: id, schoolId } });
        if (sectionIds.length) {
          await tx.classSection.createMany({
            data: sectionIds.map((sectionId) => ({ schoolId, classId: id, sectionId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.class.findUnique({
        where: { id },
        include: { classSections: { include: { section: { select: { id: true, name: true } } } } },
      });
    });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Class name already exists for this school');
  }
};

export const deleteSetupClass = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.class.findFirst({
    where: { id, schoolId },
    include: {
      _count: { select: { students: true, subjects: true, timetableEntries: true, assignSubjects: true, classTeachers: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Class not found');
  const blockers = existing._count.students + existing._count.subjects + existing._count.timetableEntries + existing._count.assignSubjects + existing._count.classTeachers;
  if (blockers > 0) throw new HttpError(409, 'Cannot delete class while students, routine, subjects, or assignments exist');
  await prisma.class.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'CLASS', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

const sectionSchema = z.object({ name: z.string().min(1).max(80) });

export const listSetupSections = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const sections = await prisma.section.findMany({
    where: {
      schoolId,
      ...(classId ? { classSections: { some: { classId, schoolId } } } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: {
      classSections: { include: { class: { select: { id: true, name: true } } }, orderBy: { class: { name: 'asc' } } },
      _count: { select: { students: true, classSections: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.status(200).json(sections);
};

export const createSetupSection = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = sectionSchema.parse(req.body);
  const name = normalizeText(payload.name);
  const duplicate = await prisma.section.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Section name already exists for this school');
  try {
    const section = await prisma.section.create({
      data: { schoolId, name, classId: null },
    });
    res.status(201).json(section);
  } catch (err) {
    handleUniqueError(err, 'Section name already exists for this school');
  }
};

export const updateSetupSection = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = sectionSchema.partial().parse(req.body);
  const id = req.params.id;
  await assertSection(schoolId, id);
  if (payload.name) {
    const name = normalizeText(payload.name);
    const duplicate = await prisma.section.findFirst({
      where: { schoolId, id: { not: id }, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, 'Section name already exists for this school');
  }
  try {
    const section = await prisma.section.update({
      where: { id },
      data: { name: payload.name === undefined ? undefined : normalizeText(payload.name) },
    });
    res.status(200).json(section);
  } catch (err) {
    handleUniqueError(err, 'Section name already exists for this school');
  }
};

export const deleteSetupSection = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.section.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { students: true, classSections: true, assignSubjects: true, classTeachers: true, timetableEntries: true } } },
  });
  if (!existing) throw new HttpError(404, 'Section not found');
  const blockers = existing._count.students + existing._count.classSections + existing._count.assignSubjects + existing._count.classTeachers + existing._count.timetableEntries;
  if (blockers > 0) throw new HttpError(409, 'Cannot delete section while linked with classes, students, or assignments');
  await prisma.section.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'SECTION', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

const subjectSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  type: z.nativeEnum(SubjectType).default('THEORY'),
});

export const listSetupSubjects = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const subjects = await prisma.subject.findMany({
    where: {
      schoolId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { assignSubjects: true, examPapers: true, timetableEntries: true } } },
    orderBy: [{ name: 'asc' }],
  });
  res.status(200).json(subjects.map((item) => ({
    ...item,
    _count: item._count ? { ...item._count, classRoutines: item._count.timetableEntries ?? 0 } : item._count,
  })));
};

export const createSetupSubject = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = subjectSchema.parse(req.body);
  const name = normalizeText(payload.name);
  const duplicateName = await prisma.subject.findFirst({
    where: { schoolId, name: { equals: name, mode: 'insensitive' }, classId: null, academicYearId: null },
    select: { id: true },
  });
  if (duplicateName) throw new HttpError(409, 'Subject name already exists for this school');
  const duplicateCode = payload.code
    ? await prisma.subject.findFirst({ where: { schoolId, code: { equals: payload.code, mode: 'insensitive' } }, select: { id: true } })
    : null;
  if (duplicateCode) throw new HttpError(409, 'Subject code already exists for this school');
  const subject = await prisma.subject.create({
    data: {
      schoolId,
      name,
      code: payload.code?.trim() || null,
      type: payload.type,
    },
  });
  res.status(201).json(subject);
};

export const updateSetupSubject = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = subjectSchema.partial().parse(req.body);
  const id = req.params.id;
  await assertSubject(schoolId, id);
  if (payload.name) {
    const name = normalizeText(payload.name);
    const duplicateName = await prisma.subject.findFirst({
      where: { schoolId, id: { not: id }, name: { equals: name, mode: 'insensitive' }, classId: null, academicYearId: null },
      select: { id: true },
    });
    if (duplicateName) throw new HttpError(409, 'Subject name already exists for this school');
  }
  if (payload.code) {
    const duplicateCode = await prisma.subject.findFirst({
      where: { schoolId, code: { equals: payload.code, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    });
    if (duplicateCode) throw new HttpError(409, 'Subject code already exists for this school');
  }
  const subject = await prisma.subject.update({
    where: { id },
    data: {
      name: payload.name === undefined ? undefined : normalizeText(payload.name),
      code: payload.code === undefined ? undefined : payload.code?.trim() || null,
      type: payload.type ?? undefined,
    },
  });
  res.status(200).json(subject);
};

export const deleteSetupSubject = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.subject.findFirst({
    where: { id, schoolId },
    include: {
      _count: { select: { assignSubjects: true, examPapers: true, teacherAssignments: true, timetableEntries: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Subject not found');
  const blockers = existing._count.assignSubjects + existing._count.examPapers + existing._count.teacherAssignments + existing._count.timetableEntries;
  if (blockers > 0) throw new HttpError(409, 'Cannot delete subject while exams, routine, or assignments exist');
  await prisma.subject.delete({ where: { id } });
  res.status(204).send();
};

const roomSchema = z.object({
  roomNumber: z.string().min(1).max(50),
  capacity: z.coerce.number().int().min(1).max(10000),
});

export const listClassRooms = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const rooms = await prisma.classRoom.findMany({
    where: { schoolId, ...(search ? { roomNumber: { contains: search, mode: 'insensitive' } } : {}) },
    include: { _count: { select: { timetableEntries: true } } },
    orderBy: { roomNumber: 'asc' },
  });
  res.status(200).json(rooms.map((item) => ({
    ...item,
    _count: item._count ? { ...item._count, classRoutines: item._count.timetableEntries ?? 0 } : item._count,
  })));
};

export const createClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = roomSchema.parse(req.body);
  const roomNumber = normalizeText(payload.roomNumber);
  const duplicate = await prisma.classRoom.findFirst({
    where: { schoolId, roomNumber: { equals: roomNumber, mode: 'insensitive' } },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, 'Room number already exists for this school');
  try {
    const room = await prisma.classRoom.create({
      data: { schoolId, roomNumber, capacity: payload.capacity },
    });
    res.status(201).json(room);
  } catch (err) {
    handleUniqueError(err, 'Room number already exists for this school');
  }
};

export const updateClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = roomSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.classRoom.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Class room not found');
  const roomNumber = payload.roomNumber === undefined ? undefined : normalizeText(payload.roomNumber);
  if (roomNumber !== undefined) {
    const duplicate = await prisma.classRoom.findFirst({
      where: { schoolId, id: { not: id }, roomNumber: { equals: roomNumber, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, 'Room number already exists for this school');
  }
  try {
    const room = await prisma.classRoom.update({
      where: { id },
      data: {
        roomNumber,
        capacity: payload.capacity ?? undefined,
      },
    });
    res.status(200).json(room);
  } catch (err) {
    handleUniqueError(err, 'Room number already exists for this school');
  }
};

export const deleteClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.classRoom.findFirst({ where: { id, schoolId }, include: { _count: { select: { timetableEntries: true } } } });
  if (!existing) throw new HttpError(404, 'Class room not found');
  if (existing._count.timetableEntries > 0) throw new HttpError(409, 'Cannot delete room while routine entries exist');
  await prisma.classRoom.delete({ where: { id } });
  res.status(204).send();
};

const timePeriodSchema = z.object({
  type: z.nativeEnum(TimePeriodType),
  name: z.string().min(1).max(80),
  startTime: timeSchema,
  endTime: timeSchema,
});

export const listTimePeriods = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const periods = await prisma.attendancePeriod.findMany({
    where: { schoolId },
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    select: attendancePeriodLegacySelect,
  });
  res.status(200).json(periods.map((period) => toLegacyTimePeriodRow(period, true)));
};

export const createTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = timePeriodSchema.parse(req.body);
  ensureEndAfterStart(payload.startTime, payload.endTime);
  await assertNoOverlappingTimePeriod(schoolId, payload.startTime, payload.endTime);
  try {
    const period = await prisma.attendancePeriod.create({
      data: { schoolId, type: payload.type, name: normalizeText(payload.name), startTime: payload.startTime, endTime: payload.endTime },
      select: attendancePeriodLegacySelect,
    });
    await Promise.all([invalidateAttendanceCache(schoolId), invalidateTimetableCache(schoolId)]);
    res.status(201).json(toLegacyTimePeriodRow(period));
  } catch (err) {
    handleUniqueError(err, 'Time period already exists for this school');
  }
};

export const updateTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = timePeriodSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.attendancePeriod.findFirst({ where: { id, schoolId }, select: { id: true, startTime: true, endTime: true } });
  if (!existing) throw new HttpError(404, 'Time period not found');
  const startTime = payload.startTime ?? existing.startTime;
  const endTime = payload.endTime ?? existing.endTime;
  ensureEndAfterStart(startTime, endTime);
  await assertNoOverlappingTimePeriod(schoolId, startTime, endTime, id);
  try {
    const period = await prisma.attendancePeriod.update({
      where: { id },
      data: {
        type: payload.type ?? undefined,
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        startTime: payload.startTime ?? undefined,
        endTime: payload.endTime ?? undefined,
      },
      select: attendancePeriodLegacySelect,
    });
    await Promise.all([invalidateAttendanceCache(schoolId), invalidateTimetableCache(schoolId)]);
    res.status(200).json(toLegacyTimePeriodRow(period));
  } catch (err) {
    handleUniqueError(err, 'Time period already exists for this school');
  }
};

export const seedDefaultTimePeriods = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  let createdCount = 0;
  let updatedCount = 0;
  const skipped: Array<{ name: string; reason: string }> = [];

  for (const period of DEFAULT_TIME_PERIODS) {
    const existing = await prisma.attendancePeriod.findFirst({
      where: { schoolId, type: period.type, name: { equals: period.name, mode: 'insensitive' } },
      select: { id: true },
    });
    const overlap = await findOverlappingTimePeriod(schoolId, period.startTime, period.endTime, existing?.id);
    if (overlap) {
      skipped.push({
        name: period.name,
        reason: `Overlaps with ${overlap.name} (${overlap.startTime}-${overlap.endTime})`,
      });
      continue;
    }
    if (existing) {
      await prisma.attendancePeriod.update({
        where: { id: existing.id },
        data: { type: period.type, name: period.name, startTime: period.startTime, endTime: period.endTime },
      });
      updatedCount += 1;
      continue;
    }
    await prisma.attendancePeriod.create({ data: { schoolId, ...period } });
    createdCount += 1;
  }

  await Promise.all([invalidateAttendanceCache(schoolId), invalidateTimetableCache(schoolId)]);
  const periods = await prisma.attendancePeriod.findMany({
    where: { schoolId },
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
    select: attendancePeriodLegacySelect,
  });

  res.status(200).json({ createdCount, updatedCount, skippedCount: skipped.length, skipped, periods: periods.map((period) => toLegacyTimePeriodRow(period, true)) });
};

export const deleteTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.attendancePeriod.findFirst({ where: { id, schoolId }, include: { _count: { select: { timetableEntries: true, sessions: true } } } });
  if (!existing) throw new HttpError(404, 'Time period not found');
  if (existing._count.timetableEntries > 0 || existing._count.sessions > 0) throw new HttpError(409, 'Cannot delete time period while routine entries exist');
  await prisma.attendancePeriod.delete({ where: { id } });
  await Promise.all([invalidateAttendanceCache(schoolId), invalidateTimetableCache(schoolId)]);
  res.status(204).send();
};

const assignSubjectsSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  replace: z.boolean().optional(),
  assignments: z.array(z.object({ subjectId: uuidSchema, teacherId: uuidSchema })).min(1).max(80),
});

export const listAssignSubjects = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupReadScope(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const items = await prisma.assignSubject.findMany({
    where: { schoolId, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true, type: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }, { subject: { name: 'asc' } }],
  });
  res.status(200).json(items);
};

export const saveAssignSubjects = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = assignSubjectsSchema.parse(req.body);
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);

  const subjectIds = [...new Set(payload.assignments.map((item) => item.subjectId))];
  const teacherIds = [...new Set(payload.assignments.map((item) => item.teacherId))];
  const duplicateSubjects = subjectIds.length !== payload.assignments.length;
  if (duplicateSubjects) throw new HttpError(400, 'Duplicate subjects are not allowed in one assignment save');
  const [subjects, teachers] = await Promise.all([
    prisma.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
    prisma.teacherProfile.findMany({ where: { schoolId, id: { in: teacherIds }, isActive: true }, select: { id: true } }),
  ]);
  if (subjects.length !== subjectIds.length) throw new HttpError(404, 'One or more subjects are invalid');
  if (teachers.length !== teacherIds.length) throw new HttpError(404, 'One or more teachers are invalid');

  await prisma.$transaction(async (tx) => {
    if (payload.replace) {
      await tx.assignSubject.deleteMany({ where: { schoolId, classId: payload.classId, sectionId: payload.sectionId } });
    }
    for (const item of payload.assignments) {
      await tx.assignSubject.upsert({
        where: { classId_sectionId_subjectId: { classId: payload.classId, sectionId: payload.sectionId, subjectId: item.subjectId } },
        update: { teacherId: item.teacherId },
        create: { schoolId, classId: payload.classId, sectionId: payload.sectionId, subjectId: item.subjectId, teacherId: item.teacherId },
      });
    }
  });

  req.query.classId = payload.classId;
  req.query.sectionId = payload.sectionId;
  return listAssignSubjects(req, res);
};

export const deleteAssignSubject = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.assignSubject.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Assigned subject not found');
  await prisma.assignSubject.delete({ where: { id } });
  res.status(204).send();
};

const classTeacherSchema = z.object({ classId: uuidSchema, sectionId: uuidSchema, teacherId: uuidSchema });

const assertClassTeacherAssignable = async (schoolId: string, classId: string, teacherId: string, excludeId?: string) => {
  const baseWhere = {
    schoolId,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };
  const classConflict = await prisma.classTeacher.findFirst({
    where: { ...baseWhere, classId },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  if (classConflict) {
    throw new HttpError(
      409,
      `${classConflict.class?.name ?? 'This class'} already has class teacher ${classConflict.teacher?.firstName ?? ''} ${classConflict.teacher?.lastName ?? ''}`.trim(),
    );
  }

  const teacherConflict = await prisma.classTeacher.findFirst({
    where: { ...baseWhere, teacherId },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  if (teacherConflict) {
    throw new HttpError(
      409,
      `${teacherConflict.teacher?.firstName ?? 'This teacher'} ${teacherConflict.teacher?.lastName ?? ''} is already assigned to ${teacherConflict.class?.name ?? 'another class'}`.trim(),
    );
  }
};

export const listClassTeachers = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const items = await prisma.classTeacher.findMany({
    where: { schoolId },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
    },
    orderBy: [{ class: { name: 'asc' } }, { section: { name: 'asc' } }],
  });
  res.status(200).json(items);
};

export const saveClassTeacher = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = classTeacherSchema.parse(req.body);
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);
  await assertTeacher(schoolId, payload.teacherId);
  await assertClassTeacherAssignable(schoolId, payload.classId, payload.teacherId);
  const item = await prisma.classTeacher.create({
    data: {
      schoolId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      teacherId: payload.teacherId,
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
    },
  });
  res.status(200).json(item);
};

export const updateClassTeacher = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const payload = classTeacherSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.classTeacher.findFirst({ where: { id, schoolId }, select: { id: true, classId: true, sectionId: true, teacherId: true } });
  if (!existing) throw new HttpError(404, 'Class teacher assignment not found');
  const classId = payload.classId ?? existing.classId;
  const sectionId = payload.sectionId ?? existing.sectionId;
  const teacherId = payload.teacherId ?? existing.teacherId;
  await assertClass(schoolId, classId);
  await assertSection(schoolId, sectionId);
  await assertClassSection(schoolId, classId, sectionId);
  await assertTeacher(schoolId, teacherId);
  await assertClassTeacherAssignable(schoolId, classId, teacherId, id);
  const item = await prisma.classTeacher.update({
    where: { id },
    data: { classId: payload.classId, sectionId: payload.sectionId, teacherId: payload.teacherId },
  });
  res.status(200).json(item);
};

export const deleteClassTeacher = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.classTeacher.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Class teacher assignment not found');
  await prisma.classTeacher.delete({ where: { id } });
  res.status(204).send();
};

const routineSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  timePeriodId: uuidSchema,
  dayOfWeek: z.coerce.number().int().min(1).max(7),
  subjectId: uuidSchema,
  teacherId: uuidSchema,
  classRoomId: uuidSchema.optional().nullable(),
});

const generateRoutineSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  classRoomId: uuidSchema.optional().nullable(),
  replaceExisting: z.boolean().optional().default(false),
  days: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7).optional(),
});

const validateRoutinePayload = async (schoolId: string, payload: z.infer<typeof routineSchema>) => {
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);
  await assertSubject(schoolId, payload.subjectId);
  await assertTeacher(schoolId, payload.teacherId);
  await assertClassRoom(schoolId, payload.classRoomId);
  const weekendValues = await getConfiguredWeekendValues(schoolId);
  if (weekendValues.has(payload.dayOfWeek)) throw new HttpError(400, 'Selected day is configured as weekend');
  const period = await assertTimePeriod(schoolId, payload.timePeriodId);
  if (period.type === 'BREAK') throw new HttpError(400, 'Break periods cannot be assigned as class routine');
  const subjectAssignment = await prisma.assignSubject.findFirst({
    where: { schoolId, classId: payload.classId, sectionId: payload.sectionId, subjectId: payload.subjectId, teacherId: payload.teacherId },
    select: { id: true },
  });
  if (!subjectAssignment) {
    throw new HttpError(400, 'Subject and teacher must be assigned to this class-section before routine creation');
  }
};

const assertRoutineAvailability = async (
  schoolId: string,
  timetableVersionId: string,
  payload: Pick<z.infer<typeof routineSchema>, 'teacherId' | 'classRoomId' | 'dayOfWeek' | 'timePeriodId'>,
  excludeId?: string,
) => {
  const sameSlotWhere = {
    schoolId,
    timetableVersionId,
    dayOfWeek: payload.dayOfWeek,
    attendancePeriodId: payload.timePeriodId,
    isActive: true,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const teacherConflict = await prisma.timetableEntry.findFirst({
    where: { ...sameSlotWhere, teacherId: payload.teacherId },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      period: { select: { name: true, startTime: true, endTime: true } },
    },
  });
  if (teacherConflict) {
    throw new HttpError(
      409,
      `Teacher already has ${teacherConflict.class.name}-${teacherConflict.section?.name ?? ''} in ${teacherConflict.period.name}`,
    );
  }

  if (!payload.classRoomId) return;
  const roomConflict = await prisma.timetableEntry.findFirst({
    where: { ...sameSlotWhere, classRoomId: payload.classRoomId },
    include: {
      class: { select: { name: true } },
      section: { select: { name: true } },
      classRoom: { select: { roomNumber: true } },
      period: { select: { name: true } },
    },
  });
  if (roomConflict) {
    throw new HttpError(
      409,
      `Room ${roomConflict.classRoom?.roomNumber ?? ''} is already used by ${roomConflict.class.name}-${roomConflict.section?.name ?? ''} in ${roomConflict.period.name}`,
    );
  }
};

export const listClassRoutines = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireAcademicSetupUser(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const teacherId = typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined;
  const version = await resolveDraftTimetableVersion({ schoolId, userId, classId, createIfMissing: false });
  if (!version) {
    res.status(200).json([]);
    return;
  }
  const routines = await prisma.timetableEntry.findMany({
    where: {
      schoolId,
      timetableVersionId: version.id,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(teacherId ? { teacherId } : {}),
    },
    include: timetableEntryLegacyInclude,
    orderBy: timetableEntryLegacyOrderBy,
  });
  res.status(200).json(routines.map(toLegacyRoutineRow));
};

export const createClassRoutine = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireAcademicSetupUser(req);
  const payload = routineSchema.parse(req.body);
  await validateRoutinePayload(schoolId, payload);
  const version = await resolveDraftTimetableVersion({ schoolId, userId, classId: payload.classId, createIfMissing: true });
  if (!version) throw new HttpError(400, 'Create an academic year before managing timetable entries');
  await assertRoutineAvailability(schoolId, version.id, payload);
  const room = payload.classRoomId
    ? await prisma.classRoom.findFirst({ where: { id: payload.classRoomId, schoolId }, select: { roomNumber: true } })
    : null;
  try {
    const item = await prisma.timetableEntry.create({
      data: {
        schoolId,
        timetableVersionId: version.id,
        academicYearId: version.academicYearId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        attendancePeriodId: payload.timePeriodId,
        dayOfWeek: payload.dayOfWeek,
        subjectId: payload.subjectId,
        teacherId: payload.teacherId,
        classRoomId: payload.classRoomId ?? null,
        room: room?.roomNumber ?? null,
      },
    });
    await invalidateTimetableCache(schoolId);
    res.status(201).json(toLegacyRoutineScalar(item));
  } catch (err) {
    handleUniqueError(err, 'Routine already exists for this day and period');
  }
};

export const updateClassRoutine = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.timetableEntry.findFirst({
    where: { id, schoolId },
    include: { version: { select: { id: true, status: true, academicYearId: true } } },
  });
  if (!existing) throw new HttpError(404, 'Routine not found');
  if (existing.version.status !== 'DRAFT') throw new HttpError(409, 'Only draft timetable entries can be edited');
  const payload = routineSchema.partial().parse(req.body);
  const merged = {
    classId: payload.classId ?? existing.classId,
    sectionId: payload.sectionId ?? existing.sectionId ?? '',
    timePeriodId: payload.timePeriodId ?? existing.attendancePeriodId,
    dayOfWeek: payload.dayOfWeek ?? existing.dayOfWeek,
    subjectId: payload.subjectId ?? existing.subjectId,
    teacherId: payload.teacherId ?? existing.teacherId,
    classRoomId: payload.classRoomId === undefined ? existing.classRoomId : payload.classRoomId,
  };
  await validateRoutinePayload(schoolId, merged);
  await assertRoutineAvailability(schoolId, existing.version.id, merged, id);
  const room = merged.classRoomId
    ? await prisma.classRoom.findFirst({ where: { id: merged.classRoomId, schoolId }, select: { roomNumber: true } })
    : null;
  try {
    const item = await prisma.timetableEntry.update({
      where: { id },
      data: {
        classId: payload.classId ?? undefined,
        sectionId: payload.sectionId === undefined ? undefined : payload.sectionId,
        attendancePeriodId: payload.timePeriodId ?? undefined,
        dayOfWeek: payload.dayOfWeek ?? undefined,
        subjectId: payload.subjectId ?? undefined,
        teacherId: payload.teacherId ?? undefined,
        classRoomId: payload.classRoomId === undefined ? undefined : payload.classRoomId,
        room: payload.classRoomId === undefined ? undefined : room?.roomNumber ?? null,
      },
    });
    await invalidateTimetableCache(schoolId);
    res.status(200).json(toLegacyRoutineScalar(item));
  } catch (err) {
    handleUniqueError(err, 'Routine already exists for this day and period');
  }
};

export const generateClassRoutine = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireAcademicSetupUser(req);
  const payload = generateRoutineSchema.parse(req.body);
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);
  await assertClassRoom(schoolId, payload.classRoomId);
  const version = await resolveDraftTimetableVersion({ schoolId, userId, classId: payload.classId, createIfMissing: true });
  if (!version) throw new HttpError(400, 'Create an academic year before generating timetable entries');
  const result = await modernTimetableGeneratorService.generate({
    schoolId,
    timetableVersionId: version.id,
    classId: payload.classId,
    sectionId: payload.sectionId,
    classRoomId: payload.classRoomId ?? null,
    replaceExisting: payload.replaceExisting,
    days: payload.days,
  });

  res.status(201).json({
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    skipped: result.skipped,
    routines: result.entries.map(toLegacyRoutineRow),
  });
};

export const deleteClassRoutine = async (req: Request, res: Response) => {
  const { schoolId } = requireAcademicSetupUser(req);
  const id = req.params.id;
  const existing = await prisma.timetableEntry.findFirst({
    where: { id, schoolId },
    include: { version: { select: { status: true } } },
  });
  if (!existing) throw new HttpError(404, 'Routine not found');
  if (existing.version.status !== 'DRAFT') throw new HttpError(409, 'Only draft timetable entries can be deleted');
  await prisma.timetableEntry.delete({ where: { id } });
  await invalidateTimetableCache(schoolId);
  res.status(204).send();
};
