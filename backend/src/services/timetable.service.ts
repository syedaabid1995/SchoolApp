import { HttpError } from '../middlewares/error.middleware';
import { prisma } from '../config/db';
import { createAuditLog } from './auditLog.service';
import { invalidateTimetableCache } from './cache/cache.invalidation';

type UpsertTimetableEntryInput = {
  classId: string;
  sectionId?: string | null;
  attendancePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  room?: string | null;
  isActive?: boolean;
};

const toDateOnly = (value: string | Date) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Invalid date');
  }
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const toDayOfWeek = (date: Date) => {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
};

export const createTimetableVersion = async (params: {
  schoolId: string;
  academicYearId: string;
  name: string;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  actorId: string;
  actorRole: string;
}) => {
  const academicYear = await prisma.academicYear.findFirst({
    where: { id: params.academicYearId, schoolId: params.schoolId },
    select: { id: true },
  });
  if (!academicYear) throw new HttpError(404, 'Academic year not found');

  const effectiveFrom = toDateOnly(params.effectiveFrom);
  const effectiveTo = params.effectiveTo ? toDateOnly(params.effectiveTo) : null;
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new HttpError(400, 'effectiveTo cannot be earlier than effectiveFrom');
  }

  const version = await prisma.timetableVersion.create({
    data: {
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      name: params.name.trim(),
      effectiveFrom,
      effectiveTo,
      createdById: params.actorId,
    },
  });

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TimetableVersion',
    entityId: version.id,
    action: 'CREATE',
    afterState: {
      academicYearId: version.academicYearId,
      name: version.name,
      status: version.status,
      effectiveFrom: version.effectiveFrom.toISOString(),
      effectiveTo: version.effectiveTo?.toISOString() ?? null,
    },
  });

  return version;
};

export const listTimetableVersions = async (params: {
  schoolId: string;
  academicYearId?: string;
}) => {
  return prisma.timetableVersion.findMany({
    where: {
      schoolId: params.schoolId,
      ...(params.academicYearId ? { academicYearId: params.academicYearId } : {}),
    },
    include: {
      academicYear: { select: { id: true, name: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
};

const validateEntries = async (params: {
  schoolId: string;
  academicYearId: string;
  entries: UpsertTimetableEntryInput[];
}) => {
  const classIds = [...new Set(params.entries.map((entry) => entry.classId))];
  const sectionIds = [...new Set(params.entries.map((entry) => entry.sectionId).filter(Boolean) as string[])];
  const subjectIds = [...new Set(params.entries.map((entry) => entry.subjectId))];
  const teacherIds = [...new Set(params.entries.map((entry) => entry.teacherId))];
  const periodIds = [...new Set(params.entries.map((entry) => entry.attendancePeriodId))];

  const [classes, sections, subjects, teachers, periods] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: params.schoolId, academicYearId: params.academicYearId, id: { in: classIds } },
      select: { id: true },
    }),
    sectionIds.length
      ? prisma.section.findMany({
          where: { id: { in: sectionIds }, class: { schoolId: params.schoolId } },
          select: { id: true, classId: true },
        })
      : Promise.resolve([]),
    prisma.subject.findMany({
      where: { schoolId: params.schoolId, id: { in: subjectIds } },
      select: { id: true, classId: true, academicYearId: true },
    }),
    prisma.teacherProfile.findMany({
      where: { schoolId: params.schoolId, isActive: true, id: { in: teacherIds } },
      select: { id: true },
    }),
    prisma.attendancePeriod.findMany({
      where: { schoolId: params.schoolId, id: { in: periodIds } },
      select: { id: true },
    }),
  ]);

  if (classes.length !== classIds.length) throw new HttpError(404, 'One or more classes are invalid');
  if (subjects.length !== subjectIds.length) throw new HttpError(404, 'One or more subjects are invalid');
  if (teachers.length !== teacherIds.length) throw new HttpError(404, 'One or more teachers are invalid');
  if (periods.length !== periodIds.length) throw new HttpError(404, 'One or more attendance periods are invalid');

  const sectionsByClass = new Map<string, Set<string>>();
  for (const section of sections) {
    if (!sectionsByClass.has(section.classId)) sectionsByClass.set(section.classId, new Set());
    sectionsByClass.get(section.classId)?.add(section.id);
  }

  const sectionCounts = await prisma.section.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, class: { schoolId: params.schoolId } },
    _count: { _all: true },
  });
  const sectionCountByClass = new Map(sectionCounts.map((entry) => [entry.classId, entry._count._all]));

  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  for (const entry of params.entries) {
    if (entry.dayOfWeek < 1 || entry.dayOfWeek > 6) {
      throw new HttpError(400, 'dayOfWeek must be between 1 and 6');
    }

    if ((sectionCountByClass.get(entry.classId) ?? 0) > 0 && !entry.sectionId) {
      throw new HttpError(400, 'sectionId is required for classes that have sections');
    }

    if (entry.sectionId) {
      const validSectionIds = sectionsByClass.get(entry.classId);
      if (!validSectionIds || !validSectionIds.has(entry.sectionId)) {
        throw new HttpError(400, 'sectionId does not belong to class');
      }
    }

    const subject = subjectById.get(entry.subjectId);
    if (!subject) throw new HttpError(404, 'Subject not found');
    if (subject.classId && subject.classId !== entry.classId) {
      throw new HttpError(400, 'Subject is not mapped to the selected class');
    }
    if (subject.academicYearId && subject.academicYearId !== params.academicYearId) {
      throw new HttpError(400, 'Subject is not mapped to the selected academic year');
    }
  }

  const duplicateKeys = new Set<string>();
  for (const entry of params.entries) {
    const key = `${entry.classId}:${entry.sectionId ?? 'ALL'}:${entry.dayOfWeek}:${entry.attendancePeriodId}`;
    if (duplicateKeys.has(key)) throw new HttpError(409, 'Duplicate class/section/day/period entries are not allowed');
    duplicateKeys.add(key);
  }
};

export const bulkUpsertTimetableEntries = async (params: {
  schoolId: string;
  timetableVersionId: string;
  entries: UpsertTimetableEntryInput[];
  replace?: boolean;
  actorId: string;
  actorRole: string;
}) => {
  const version = await prisma.timetableVersion.findFirst({
    where: { id: params.timetableVersionId, schoolId: params.schoolId },
    select: { id: true, status: true, academicYearId: true },
  });
  if (!version) throw new HttpError(404, 'Timetable version not found');
  if (version.status !== 'DRAFT') throw new HttpError(409, 'Only draft timetable versions can be edited');

  await validateEntries({
    schoolId: params.schoolId,
    academicYearId: version.academicYearId,
    entries: params.entries,
  });

  const changedIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const entry of params.entries) {
      const upserted = await tx.timetableEntry.upsert({
        where: {
          timetableVersionId_classId_sectionId_dayOfWeek_attendancePeriodId: {
            timetableVersionId: version.id,
            classId: entry.classId,
            sectionId: entry.sectionId ?? null,
            dayOfWeek: entry.dayOfWeek,
            attendancePeriodId: entry.attendancePeriodId,
          },
        },
        update: {
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          room: entry.room?.trim() || null,
          isActive: entry.isActive ?? true,
        },
        create: {
          schoolId: params.schoolId,
          timetableVersionId: version.id,
          academicYearId: version.academicYearId,
          classId: entry.classId,
          sectionId: entry.sectionId ?? null,
          attendancePeriodId: entry.attendancePeriodId,
          dayOfWeek: entry.dayOfWeek,
          subjectId: entry.subjectId,
          teacherId: entry.teacherId,
          room: entry.room?.trim() || null,
          isActive: entry.isActive ?? true,
        },
      });
      changedIds.push(upserted.id);
    }

    if (params.replace) {
      await tx.timetableEntry.deleteMany({
        where: {
          timetableVersionId: version.id,
          ...(changedIds.length ? { id: { notIn: changedIds } } : {}),
        },
      });
    }
  });

  await invalidateTimetableCache(params.schoolId);
  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TimetableVersion',
    entityId: version.id,
    action: 'UPSERT_ENTRIES',
    afterState: {
      updatedEntries: changedIds.length,
      replace: params.replace ?? false,
    },
  });

  return prisma.timetableEntry.findMany({
    where: { id: { in: changedIds } },
    orderBy: [{ dayOfWeek: 'asc' }, { period: { startTime: 'asc' } }],
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      period: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });
};

const detectPublishConflicts = (entries: Array<{
  id: string;
  dayOfWeek: number;
  attendancePeriodId: string;
  teacherId: string;
  room: string | null;
  isActive: boolean;
}>) => {
  const teacherSet = new Set<string>();
  const roomSet = new Set<string>();
  const teacherConflicts: string[] = [];
  const roomConflicts: string[] = [];

  for (const entry of entries) {
    if (!entry.isActive) continue;
    const teacherKey = `${entry.dayOfWeek}:${entry.attendancePeriodId}:${entry.teacherId}`;
    if (teacherSet.has(teacherKey)) teacherConflicts.push(teacherKey);
    teacherSet.add(teacherKey);

    if (entry.room) {
      const roomKey = `${entry.dayOfWeek}:${entry.attendancePeriodId}:${entry.room.trim().toLowerCase()}`;
      if (roomSet.has(roomKey)) roomConflicts.push(roomKey);
      roomSet.add(roomKey);
    }
  }

  if (teacherConflicts.length > 0) {
    throw new HttpError(409, 'Teacher timetable conflicts found. Resolve overlaps before publishing.');
  }
  if (roomConflicts.length > 0) {
    throw new HttpError(409, 'Room timetable conflicts found. Resolve overlaps before publishing.');
  }
};

export const publishTimetableVersion = async (params: {
  schoolId: string;
  timetableVersionId: string;
  actorId: string;
  actorRole: string;
}) => {
  const version = await prisma.timetableVersion.findFirst({
    where: { id: params.timetableVersionId, schoolId: params.schoolId },
    include: {
      entries: {
        select: {
          id: true,
          dayOfWeek: true,
          attendancePeriodId: true,
          teacherId: true,
          room: true,
          isActive: true,
        },
      },
    },
  });
  if (!version) throw new HttpError(404, 'Timetable version not found');
  if (version.status !== 'DRAFT') throw new HttpError(409, 'Only draft timetable versions can be published');
  if (!version.entries.some((entry) => entry.isActive)) {
    throw new HttpError(400, 'Cannot publish an empty timetable');
  }

  detectPublishConflicts(version.entries);

  const publishedAt = new Date();
  const published = await prisma.$transaction(async (tx) => {
    await tx.timetableVersion.updateMany({
      where: {
        schoolId: params.schoolId,
        academicYearId: version.academicYearId,
        status: 'PUBLISHED',
        id: { not: version.id },
      },
      data: { status: 'ARCHIVED' },
    });

    return tx.timetableVersion.update({
      where: { id: version.id },
      data: { status: 'PUBLISHED', publishedAt },
      include: {
        _count: { select: { entries: true } },
      },
    });
  });

  await invalidateTimetableCache(params.schoolId);
  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    entityType: 'TimetableVersion',
    entityId: version.id,
    action: 'PUBLISH',
    beforeState: { status: version.status },
    afterState: { status: 'PUBLISHED', publishedAt: publishedAt.toISOString() },
  });

  return published;
};

export const listTimetableEntries = async (params: {
  schoolId: string;
  timetableVersionId: string;
  dayOfWeek?: number;
}) => {
  const version = await prisma.timetableVersion.findFirst({
    where: { id: params.timetableVersionId, schoolId: params.schoolId },
    select: { id: true },
  });
  if (!version) throw new HttpError(404, 'Timetable version not found');

  return prisma.timetableEntry.findMany({
    where: {
      timetableVersionId: params.timetableVersionId,
      schoolId: params.schoolId,
      ...(typeof params.dayOfWeek === 'number' ? { dayOfWeek: params.dayOfWeek } : {}),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      period: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { period: { startTime: 'asc' } }],
  });
};

const resolveAcademicYearForDate = async (params: {
  schoolId: string;
  date: Date;
  academicYearId?: string;
}) => {
  if (params.academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: params.academicYearId, schoolId: params.schoolId },
      select: { id: true, name: true },
    });
    if (!year) throw new HttpError(404, 'Academic year not found');
    return year;
  }

  const year = await prisma.academicYear.findFirst({
    where: {
      schoolId: params.schoolId,
      startDate: { lte: params.date },
      endDate: { gte: params.date },
    },
    select: { id: true, name: true },
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
  });

  if (!year) throw new HttpError(404, 'No academic year found for date');
  return year;
};

export const getTeacherTimetableByDate = async (params: {
  schoolId: string;
  userId: string;
  date?: string;
  academicYearId?: string;
}) => {
  const teacher = await prisma.teacherProfile.findFirst({
    where: { schoolId: params.schoolId, userId: params.userId, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!teacher) throw new HttpError(404, 'Teacher profile not found');

  const date = params.date ? toDateOnly(params.date) : toDateOnly(new Date());
  const academicYear = await resolveAcademicYearForDate({
    schoolId: params.schoolId,
    academicYearId: params.academicYearId,
    date,
  });
  const dayOfWeek = toDayOfWeek(date);

  const version = await prisma.timetableVersion.findFirst({
    where: {
      schoolId: params.schoolId,
      academicYearId: academicYear.id,
      status: 'PUBLISHED',
      effectiveFrom: { lte: date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, publishedAt: true },
  });

  if (!version) {
    return {
      teacher,
      academicYear,
      date: date.toISOString().slice(0, 10),
      dayOfWeek,
      version: null,
      periods: [],
    };
  }

  const periods = await prisma.timetableEntry.findMany({
    where: {
      timetableVersionId: version.id,
      teacherId: teacher.id,
      dayOfWeek,
      isActive: true,
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
    orderBy: [{ period: { startTime: 'asc' } }],
  });

  return {
    teacher,
    academicYear,
    date: date.toISOString().slice(0, 10),
    dayOfWeek,
    version,
    periods,
  };
};

export const listTimetableTeachers = async (params: {
  schoolId: string;
  query?: string;
}) => {
  return prisma.teacherProfile.findMany({
    where: {
      schoolId: params.schoolId,
      isActive: true,
      ...(params.query
        ? {
            OR: [
              { firstName: { contains: params.query, mode: 'insensitive' } },
              { lastName: { contains: params.query, mode: 'insensitive' } },
              { employeeNo: { contains: params.query, mode: 'insensitive' } },
              { user: { email: { contains: params.query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeNo: true,
      user: { select: { email: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    take: 300,
  });
};
