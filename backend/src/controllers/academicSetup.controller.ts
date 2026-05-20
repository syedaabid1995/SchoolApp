import type { Request, Response } from 'express';
import { Prisma, SubjectType, TimePeriodType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm time format');

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    throw new HttpError(403, 'Only School Admin can manage academic setup');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');

const ensureEndAfterStart = (startTime: string, endTime: string) => {
  if (endTime <= startTime) {
    throw new HttpError(400, 'End time must be after start time');
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
  const found = await prisma.timePeriod.findFirst({
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

const classSchema = z.object({
  name: z.string().min(1).max(80),
  academicYearId: uuidSchema.optional().nullable(),
  sectionIds: z.array(uuidSchema).max(40).optional(),
});

const updateClassSchema = classSchema.partial();

export const listSetupClasses = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
          classRoutines: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  res.status(200).json(classes);
};

export const createSetupClass = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.class.findFirst({
    where: { id, schoolId },
    include: {
      _count: { select: { students: true, subjects: true, timetableEntries: true, assignSubjects: true, classTeachers: true, classRoutines: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Class not found');
  const blockers = existing._count.students + existing._count.subjects + existing._count.timetableEntries + existing._count.assignSubjects + existing._count.classTeachers + existing._count.classRoutines;
  if (blockers > 0) throw new HttpError(409, 'Cannot delete class while students, routine, subjects, or assignments exist');
  await prisma.class.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'CLASS', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

const sectionSchema = z.object({ name: z.string().min(1).max(80) });

export const listSetupSections = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.section.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { students: true, classSections: true, assignSubjects: true, classTeachers: true, classRoutines: true } } },
  });
  if (!existing) throw new HttpError(404, 'Section not found');
  const blockers = existing._count.students + existing._count.classSections + existing._count.assignSubjects + existing._count.classTeachers + existing._count.classRoutines;
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
  const { schoolId } = requireSchoolAdmin(req);
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
    include: { _count: { select: { assignSubjects: true, classRoutines: true, examPapers: true, timetableEntries: true } } },
    orderBy: [{ name: 'asc' }],
  });
  res.status(200).json(subjects);
};

export const createSetupSubject = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.subject.findFirst({
    where: { id, schoolId },
    include: {
      _count: { select: { assignSubjects: true, classRoutines: true, examPapers: true, teacherAssignments: true, timetableEntries: true } },
    },
  });
  if (!existing) throw new HttpError(404, 'Subject not found');
  const blockers = existing._count.assignSubjects + existing._count.classRoutines + existing._count.examPapers + existing._count.teacherAssignments + existing._count.timetableEntries;
  if (blockers > 0) throw new HttpError(409, 'Cannot delete subject while exams, routine, or assignments exist');
  await prisma.subject.delete({ where: { id } });
  res.status(204).send();
};

const roomSchema = z.object({
  roomNumber: z.string().min(1).max(50),
  capacity: z.coerce.number().int().min(1).max(10000),
});

export const listClassRooms = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const rooms = await prisma.classRoom.findMany({
    where: { schoolId, ...(search ? { roomNumber: { contains: search, mode: 'insensitive' } } : {}) },
    include: { _count: { select: { classRoutines: true } } },
    orderBy: { roomNumber: 'asc' },
  });
  res.status(200).json(rooms);
};

export const createClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = roomSchema.parse(req.body);
  try {
    const room = await prisma.classRoom.create({
      data: { schoolId, roomNumber: normalizeText(payload.roomNumber), capacity: payload.capacity },
    });
    res.status(201).json(room);
  } catch (err) {
    handleUniqueError(err, 'Room number already exists for this school');
  }
};

export const updateClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = roomSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.classRoom.findFirst({ where: { id, schoolId }, select: { id: true } });
  if (!existing) throw new HttpError(404, 'Class room not found');
  try {
    const room = await prisma.classRoom.update({
      where: { id },
      data: {
        roomNumber: payload.roomNumber === undefined ? undefined : normalizeText(payload.roomNumber),
        capacity: payload.capacity ?? undefined,
      },
    });
    res.status(200).json(room);
  } catch (err) {
    handleUniqueError(err, 'Room number already exists for this school');
  }
};

export const deleteClassRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.classRoom.findFirst({ where: { id, schoolId }, include: { _count: { select: { classRoutines: true } } } });
  if (!existing) throw new HttpError(404, 'Class room not found');
  if (existing._count.classRoutines > 0) throw new HttpError(409, 'Cannot delete room while routine entries exist');
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
  const { schoolId } = requireSchoolAdmin(req);
  const periods = await prisma.timePeriod.findMany({
    where: { schoolId },
    include: { _count: { select: { classRoutines: true } } },
    orderBy: [{ startTime: 'asc' }, { name: 'asc' }],
  });
  res.status(200).json(periods);
};

export const createTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = timePeriodSchema.parse(req.body);
  ensureEndAfterStart(payload.startTime, payload.endTime);
  try {
    const period = await prisma.timePeriod.create({
      data: { schoolId, type: payload.type, name: normalizeText(payload.name), startTime: payload.startTime, endTime: payload.endTime },
    });
    res.status(201).json(period);
  } catch (err) {
    handleUniqueError(err, 'Time period already exists for this school');
  }
};

export const updateTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = timePeriodSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.timePeriod.findFirst({ where: { id, schoolId }, select: { id: true, startTime: true, endTime: true } });
  if (!existing) throw new HttpError(404, 'Time period not found');
  ensureEndAfterStart(payload.startTime ?? existing.startTime, payload.endTime ?? existing.endTime);
  try {
    const period = await prisma.timePeriod.update({
      where: { id },
      data: {
        type: payload.type ?? undefined,
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        startTime: payload.startTime ?? undefined,
        endTime: payload.endTime ?? undefined,
      },
    });
    res.status(200).json(period);
  } catch (err) {
    handleUniqueError(err, 'Time period already exists for this school');
  }
};

export const deleteTimePeriod = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.timePeriod.findFirst({ where: { id, schoolId }, include: { _count: { select: { classRoutines: true } } } });
  if (!existing) throw new HttpError(404, 'Time period not found');
  if (existing._count.classRoutines > 0) throw new HttpError(409, 'Cannot delete time period while routine entries exist');
  await prisma.timePeriod.delete({ where: { id } });
  res.status(204).send();
};

const assignSubjectsSchema = z.object({
  classId: uuidSchema,
  sectionId: uuidSchema,
  replace: z.boolean().optional(),
  assignments: z.array(z.object({ subjectId: uuidSchema, teacherId: uuidSchema })).min(1).max(80),
});

export const listAssignSubjects = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.assignSubject.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Assigned subject not found');
  await prisma.assignSubject.delete({ where: { id } });
  res.status(204).send();
};

const classTeacherSchema = z.object({ classId: uuidSchema, sectionId: uuidSchema, teacherId: uuidSchema });

export const listClassTeachers = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  const { schoolId } = requireSchoolAdmin(req);
  const payload = classTeacherSchema.parse(req.body);
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);
  await assertTeacher(schoolId, payload.teacherId);
  const item = await prisma.classTeacher.upsert({
    where: { classId_sectionId: { classId: payload.classId, sectionId: payload.sectionId } },
    update: { teacherId: payload.teacherId },
    create: {
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
  const { schoolId } = requireSchoolAdmin(req);
  const payload = classTeacherSchema.partial().parse(req.body);
  const id = req.params.id;
  const existing = await prisma.classTeacher.findFirst({ where: { id, schoolId }, select: { id: true, classId: true, sectionId: true } });
  if (!existing) throw new HttpError(404, 'Class teacher assignment not found');
  const classId = payload.classId ?? existing.classId;
  const sectionId = payload.sectionId ?? existing.sectionId;
  await assertClass(schoolId, classId);
  await assertSection(schoolId, sectionId);
  await assertClassSection(schoolId, classId, sectionId);
  if (payload.teacherId) await assertTeacher(schoolId, payload.teacherId);
  const item = await prisma.classTeacher.update({
    where: { id },
    data: { classId: payload.classId, sectionId: payload.sectionId, teacherId: payload.teacherId },
  });
  res.status(200).json(item);
};

export const deleteClassTeacher = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
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
  dayOfWeek: z.coerce.number().int().min(1).max(6),
  subjectId: uuidSchema,
  teacherId: uuidSchema,
  classRoomId: uuidSchema.optional().nullable(),
});

const validateRoutinePayload = async (schoolId: string, payload: z.infer<typeof routineSchema>) => {
  await assertClass(schoolId, payload.classId);
  await assertSection(schoolId, payload.sectionId);
  await assertClassSection(schoolId, payload.classId, payload.sectionId);
  await assertSubject(schoolId, payload.subjectId);
  await assertTeacher(schoolId, payload.teacherId);
  await assertClassRoom(schoolId, payload.classRoomId);
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

export const listClassRoutines = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const routines = await prisma.classRoutine.findMany({
    where: { schoolId, ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      timePeriod: true,
      subject: { select: { id: true, name: true, code: true, type: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
      classRoom: { select: { id: true, roomNumber: true, capacity: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { timePeriod: { startTime: 'asc' } }],
  });
  res.status(200).json(routines);
};

export const createClassRoutine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = routineSchema.parse(req.body);
  await validateRoutinePayload(schoolId, payload);
  try {
    const item = await prisma.classRoutine.create({
      data: {
        schoolId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        timePeriodId: payload.timePeriodId,
        dayOfWeek: payload.dayOfWeek,
        subjectId: payload.subjectId,
        teacherId: payload.teacherId,
        classRoomId: payload.classRoomId ?? null,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Routine already exists for this day and period');
  }
};

export const updateClassRoutine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.classRoutine.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Routine not found');
  const payload = routineSchema.partial().parse(req.body);
  const merged = {
    classId: payload.classId ?? existing.classId,
    sectionId: payload.sectionId ?? existing.sectionId,
    timePeriodId: payload.timePeriodId ?? existing.timePeriodId,
    dayOfWeek: payload.dayOfWeek ?? existing.dayOfWeek,
    subjectId: payload.subjectId ?? existing.subjectId,
    teacherId: payload.teacherId ?? existing.teacherId,
    classRoomId: payload.classRoomId === undefined ? existing.classRoomId : payload.classRoomId,
  };
  await validateRoutinePayload(schoolId, merged);
  try {
    const item = await prisma.classRoutine.update({
      where: { id },
      data: payload,
    });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Routine already exists for this day and period');
  }
};

export const deleteClassRoutine = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const id = req.params.id;
  const existing = await prisma.classRoutine.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Routine not found');
  await prisma.classRoutine.delete({ where: { id } });
  res.status(204).send();
};
