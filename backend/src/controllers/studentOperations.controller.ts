import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';
import { invalidateStudentCache } from '../services/cache/cache.invalidation';

const uuidSchema = z.string().uuid();
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use date format YYYY-MM-DD');

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (req.auth.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    throw new HttpError(403, 'Only School Admin can manage student operations');
  }
  return { schoolId: req.auth.schoolId, userId: req.auth.userId };
};

const dayStart = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Invalid date');
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim().replace(/\s+/g, ' ');
  return trimmed || undefined;
};

const assertAcademicScope = async (
  schoolId: string,
  payload: { academicSessionId: string; classId: string; sectionId?: string | null },
) => {
  const [session, cls] = await Promise.all([
    prisma.academicYear.findFirst({ where: { id: payload.academicSessionId, schoolId }, select: { id: true } }),
    prisma.class.findFirst({ where: { id: payload.classId, schoolId }, select: { id: true } }),
  ]);
  if (!session) throw new HttpError(404, 'Academic session not found');
  if (!cls) throw new HttpError(404, 'Class not found');
  if (payload.sectionId) {
    const section = await prisma.section.findFirst({
      where: { id: payload.sectionId, schoolId },
      select: { id: true },
    });
    if (!section) throw new HttpError(404, 'Section not found');
    const link = await prisma.classSection.findFirst({
      where: { schoolId, classId: payload.classId, sectionId: payload.sectionId },
      select: { id: true },
    });
    if (!link) throw new HttpError(400, 'Section is not assigned to the selected class');
  }
};

const groupSchema = z.object({ name: z.string().trim().min(1).max(80) });
const categorySchema = z.object({ name: z.string().trim().min(1).max(80) });

export const listStudentGroups = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const groups = await prisma.studentGroup.findMany({
    where: {
      schoolId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { students: true } } },
    orderBy: { name: 'asc' },
  });
  res.status(200).json(groups);
};

export const createStudentGroup = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = groupSchema.parse(req.body);
  const name = normalizeText(payload.name)!;
  const existing = await prisma.studentGroup.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } } });
  if (existing) throw new HttpError(409, 'Student group already exists');
  const group = await prisma.studentGroup.create({ data: { schoolId, name } });
  res.status(201).json(group);
};

export const updateStudentGroup = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const payload = groupSchema.partial().parse(req.body);
  const existing = await prisma.studentGroup.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Student group not found');
  const name = normalizeText(payload.name);
  if (name) {
    const duplicate = await prisma.studentGroup.findFirst({
      where: { schoolId, id: { not: id }, name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate) throw new HttpError(409, 'Student group already exists');
  }
  const group = await prisma.studentGroup.update({ where: { id }, data: { ...(name ? { name } : {}) } });
  res.status(200).json(group);
};

export const deleteStudentGroup = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const group = await prisma.studentGroup.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { students: true } } },
  });
  if (!group) throw new HttpError(404, 'Student group not found');
  if (group._count.students > 0) throw new HttpError(409, 'Cannot delete group while linked with students');
  await prisma.studentGroup.delete({ where: { id } });
  res.status(204).send();
};

export const listStudentCategories = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const categories = await prisma.studentCategory.findMany({
    where: {
      schoolId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { students: true } } },
    orderBy: { name: 'asc' },
  });
  res.status(200).json(categories);
};

export const createStudentCategory = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const payload = categorySchema.parse(req.body);
  const name = normalizeText(payload.name)!;
  const existing = await prisma.studentCategory.findFirst({ where: { schoolId, name: { equals: name, mode: 'insensitive' } } });
  if (existing) throw new HttpError(409, 'Student category already exists');
  const category = await prisma.studentCategory.create({ data: { schoolId, name } });
  res.status(201).json(category);
};

export const updateStudentCategory = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const payload = categorySchema.partial().parse(req.body);
  const existing = await prisma.studentCategory.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Student category not found');
  const name = normalizeText(payload.name);
  if (name) {
    const duplicate = await prisma.studentCategory.findFirst({
      where: { schoolId, id: { not: id }, name: { equals: name, mode: 'insensitive' } },
    });
    if (duplicate) throw new HttpError(409, 'Student category already exists');
  }
  const category = await prisma.studentCategory.update({ where: { id }, data: { ...(name ? { name } : {}) } });
  res.status(200).json(category);
};

export const deleteStudentCategory = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const category = await prisma.studentCategory.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { students: true } } },
  });
  if (!category) throw new HttpError(404, 'Student category not found');
  if (category._count.students > 0) throw new HttpError(409, 'Cannot delete category while linked with students');
  await prisma.studentCategory.delete({ where: { id } });
  res.status(204).send();
};

const attendanceQuerySchema = z.object({
  academicSessionId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema,
  date: dateOnlySchema,
});

type AttendanceQuery = {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  date: string;
};

const attendanceSaveSchema = attendanceQuerySchema.extend({
  markHoliday: z.boolean().optional().default(false),
  holidayReason: z.string().max(500).optional().nullable(),
  records: z
    .array(
      z.object({
        studentId: uuidSchema,
        status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY']),
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .optional()
    .default([]),
});

type AttendanceSavePayload = AttendanceQuery & {
  markHoliday: boolean;
  holidayReason?: string | null;
  records: Array<{ studentId: string; status: 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY'; note?: string | null }>;
};

export const loadStudentAttendance = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = attendanceQuerySchema.parse(req.query) as AttendanceQuery;
  await assertAcademicScope(schoolId, query);
  const date = dayStart(query.date);

  const [students, attendance, holiday] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        sectionId: query.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true, firstName: true, lastName: true },
      orderBy: [{ rollNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.studentAttendance.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        sectionId: query.sectionId,
        attendanceDate: date,
      },
    }),
    prisma.attendanceHoliday.findUnique({
      where: {
        schoolId_academicSessionId_classId_sectionId_holidayDate: {
          schoolId,
          academicSessionId: query.academicSessionId,
          classId: query.classId,
          sectionId: query.sectionId,
          holidayDate: date,
        },
      },
    }),
  ]);

  const attendanceByStudent = new Map(attendance.map((item) => [item.studentId, item]));
  res.status(200).json({
    date: query.date,
    holiday,
    students: students.map((student) => {
      const record = attendanceByStudent.get(student.id);
      return {
        ...student,
        status: record?.status ?? 'PRESENT',
        note: record?.note ?? '',
        attendanceId: record?.id ?? null,
      };
    }),
  });
};

export const saveStudentAttendance = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = attendanceSaveSchema.parse(req.body) as AttendanceSavePayload;
  await assertAcademicScope(schoolId, payload);
  const date = dayStart(payload.date);

  const studentIds = [...new Set(payload.records.map((record) => record.studentId))];
  if (studentIds.length) {
    const count = await prisma.student.count({
      where: {
        schoolId,
        academicSessionId: payload.academicSessionId,
        classId: payload.classId,
        sectionId: payload.sectionId,
        id: { in: studentIds },
        status: { not: 'DISABLED' },
      },
    });
    if (count !== studentIds.length) throw new HttpError(400, 'One or more students are invalid for the selected class, section, and session');
  }

  const result = await prisma.$transaction(async (tx) => {
    let holiday = null;
    if (payload.markHoliday) {
      holiday = await tx.attendanceHoliday.upsert({
        where: {
          schoolId_academicSessionId_classId_sectionId_holidayDate: {
            schoolId,
            academicSessionId: payload.academicSessionId,
            classId: payload.classId,
            sectionId: payload.sectionId,
            holidayDate: date,
          },
        },
        update: { reason: normalizeText(payload.holidayReason) ?? null, createdById: userId },
        create: {
          schoolId,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          holidayDate: date,
          reason: normalizeText(payload.holidayReason) ?? null,
          createdById: userId,
        },
      });
      await tx.studentAttendance.deleteMany({
        where: { schoolId, academicSessionId: payload.academicSessionId, classId: payload.classId, sectionId: payload.sectionId, attendanceDate: date },
      });
      return { holiday, saved: 0 };
    }

    await tx.attendanceHoliday.deleteMany({
      where: { schoolId, academicSessionId: payload.academicSessionId, classId: payload.classId, sectionId: payload.sectionId, holidayDate: date },
    });
    for (const record of payload.records) {
      await tx.studentAttendance.upsert({
        where: {
          schoolId_academicSessionId_studentId_attendanceDate: {
            schoolId,
            academicSessionId: payload.academicSessionId,
            studentId: record.studentId,
            attendanceDate: date,
          },
        },
        update: {
          classId: payload.classId,
          sectionId: payload.sectionId,
          status: record.status,
          note: normalizeText(record.note) ?? null,
          markedById: userId,
        },
        create: {
          schoolId,
          academicSessionId: payload.academicSessionId,
          classId: payload.classId,
          sectionId: payload.sectionId,
          studentId: record.studentId,
          attendanceDate: date,
          status: record.status,
          note: normalizeText(record.note) ?? null,
          markedById: userId,
        },
      });
    }
    return { holiday: null, saved: payload.records.length };
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_ATTENDANCE',
    entityId: `${payload.classId}:${payload.sectionId}:${payload.date}`,
    action: payload.markHoliday ? 'MARK_HOLIDAY' : 'SAVE',
    afterState: {
      academicSessionId: payload.academicSessionId,
      classId: payload.classId,
      sectionId: payload.sectionId,
      date: payload.date,
      saved: result.saved,
    },
  });

  res.status(200).json(result);
};

const reportQuerySchema = z.object({
  academicSessionId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema,
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

type AttendanceReportQuery = {
  academicSessionId: string;
  classId: string;
  sectionId: string;
  month: number;
  year: number;
};

export const getStudentAttendanceReport = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = reportQuerySchema.parse(req.query) as AttendanceReportQuery;
  await assertAcademicScope(schoolId, query);
  const start = new Date(Date.UTC(query.year, query.month - 1, 1));
  const end = new Date(Date.UTC(query.year, query.month, 1));
  const daysInMonth = new Date(Date.UTC(query.year, query.month, 0)).getUTCDate();

  const [students, attendance, holidays] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        sectionId: query.sectionId,
        status: { not: 'DISABLED' },
      },
      select: { id: true, admissionNo: true, rollNo: true, fullName: true, firstName: true, lastName: true },
      orderBy: [{ rollNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.studentAttendance.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        sectionId: query.sectionId,
        attendanceDate: { gte: start, lt: end },
      },
    }),
    prisma.attendanceHoliday.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        sectionId: query.sectionId,
        holidayDate: { gte: start, lt: end },
      },
    }),
  ]);

  const holidayDays = new Set(holidays.map((holiday) => holiday.holidayDate.getUTCDate()));
  const byStudent = new Map<string, typeof attendance>();
  for (const record of attendance) {
    const records = byStudent.get(record.studentId) ?? [];
    records.push(record);
    byStudent.set(record.studentId, records);
  }

  const rows = students.map((student) => {
    const counts = { present: 0, late: 0, absent: 0, holiday: holidayDays.size, halfDay: 0 };
    const daily: Array<{ day: number; status: string; note?: string | null }> = [];
    const recordsByDay = new Map((byStudent.get(student.id) ?? []).map((record) => [record.attendanceDate.getUTCDate(), record]));
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (holidayDays.has(day)) {
        daily.push({ day, status: 'HOLIDAY' });
        continue;
      }
      const record = recordsByDay.get(day);
      const status = record?.status ?? 'UNMARKED';
      if (status === 'PRESENT') counts.present += 1;
      if (status === 'LATE') counts.late += 1;
      if (status === 'ABSENT') counts.absent += 1;
      if (status === 'HALF_DAY') counts.halfDay += 1;
      daily.push({ day, status, note: record?.note ?? null });
    }
    const workingDays = Math.max(0, daysInMonth - holidayDays.size);
    const attended = counts.present + counts.late + counts.halfDay * 0.5;
    const percentage = workingDays > 0 ? Math.round((attended / workingDays) * 10000) / 100 : 0;
    return {
      studentId: student.id,
      admissionNo: student.admissionNo,
      rollNo: student.rollNo,
      studentName: student.fullName || `${student.firstName} ${student.lastName}`.trim(),
      ...counts,
      percentage,
      daily,
    };
  });

  res.status(200).json({ daysInMonth, holidays, rows });
};

const promotionPreviewSchema = z.object({
  academicSessionId: uuidSchema,
  classId: uuidSchema,
  sectionId: uuidSchema.optional(),
});

type PromotionPreviewQuery = {
  academicSessionId: string;
  classId: string;
  sectionId?: string;
};

export const previewStudentPromotion = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const query = promotionPreviewSchema.parse(req.query) as PromotionPreviewQuery;
  await assertAcademicScope(schoolId, { ...query, sectionId: query.sectionId ?? null });

  const [students, currentSession, nextSession] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId,
        academicSessionId: query.academicSessionId,
        classId: query.classId,
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        status: { not: 'DISABLED' },
      },
      include: { class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } },
      orderBy: [{ rollNo: 'asc' }, { fullName: 'asc' }],
    }),
    prisma.academicYear.findFirst({ where: { id: query.academicSessionId, schoolId } }),
    prisma.academicYear.findFirst({
      where: { schoolId, id: { not: query.academicSessionId } },
      orderBy: [{ startDate: 'asc' }],
    }),
  ]);

  res.status(200).json({ currentSession, suggestedPromoteSession: nextSession, students });
};

const promotionSchema = z.object({
  fromAcademicSessionId: uuidSchema,
  toAcademicSessionId: uuidSchema,
  fromClassId: uuidSchema,
  toClassId: uuidSchema,
  fromSectionId: uuidSchema,
  toSectionId: uuidSchema,
  note: z.string().max(500).optional().nullable(),
  results: z.array(z.object({ studentId: uuidSchema, result: z.enum(['PASS', 'FAIL']) })).min(1),
});

export const promoteStudents = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const payload = promotionSchema.parse(req.body);
  if (payload.fromAcademicSessionId === payload.toAcademicSessionId) {
    throw new HttpError(400, 'Promote session must be different from current session');
  }
  await assertAcademicScope(schoolId, {
    academicSessionId: payload.fromAcademicSessionId,
    classId: payload.fromClassId,
    sectionId: payload.fromSectionId ?? null,
  });
  await assertAcademicScope(schoolId, {
    academicSessionId: payload.toAcademicSessionId,
    classId: payload.toClassId,
    sectionId: payload.toSectionId ?? null,
  });
  const studentIds = payload.results.map((item) => item.studentId);
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      id: { in: studentIds },
      academicSessionId: payload.fromAcademicSessionId,
      classId: payload.fromClassId,
      ...(payload.fromSectionId ? { sectionId: payload.fromSectionId } : {}),
      status: { not: 'DISABLED' },
    },
    select: { id: true, rollNo: true },
  });
  if (students.length !== studentIds.length) throw new HttpError(400, 'One or more selected students are invalid');
  const studentMap = new Map(students.map((student) => [student.id, student]));

  const promotion = await prisma.$transaction(async (tx) => {
    const created = await tx.studentPromotion.create({
      data: {
        schoolId,
        fromAcademicSessionId: payload.fromAcademicSessionId,
        toAcademicSessionId: payload.toAcademicSessionId,
        fromClassId: payload.fromClassId,
        toClassId: payload.toClassId,
        fromSectionId: payload.fromSectionId ?? null,
        toSectionId: payload.toSectionId ?? null,
        createdById: userId,
        note: normalizeText(payload.note) ?? null,
      },
    });

    for (const item of payload.results) {
      const student = studentMap.get(item.studentId)!;
      await tx.studentPromotionHistory.create({
        data: {
          schoolId,
          promotionId: created.id,
          studentId: item.studentId,
          fromAcademicSessionId: payload.fromAcademicSessionId,
          toAcademicSessionId: payload.toAcademicSessionId,
          fromClassId: payload.fromClassId,
          toClassId: item.result === 'PASS' ? payload.toClassId : null,
          fromSectionId: payload.fromSectionId ?? null,
          toSectionId: item.result === 'PASS' ? payload.toSectionId ?? null : null,
          result: item.result,
        },
      });

      if (item.result === 'PASS') {
        await tx.student.update({
          where: { id: item.studentId },
          data: {
            academicSessionId: payload.toAcademicSessionId,
            classId: payload.toClassId,
            sectionId: payload.toSectionId,
            status: 'ENROLLED',
          },
        });
        await tx.studentEnrollment.upsert({
          where: { studentId_academicSessionId: { studentId: item.studentId, academicSessionId: payload.toAcademicSessionId } },
          update: {
            classId: payload.toClassId,
            sectionId: payload.toSectionId,
            rollNo: student.rollNo,
            status: 'ENROLLED',
          },
          create: {
            schoolId,
            studentId: item.studentId,
            academicSessionId: payload.toAcademicSessionId,
            classId: payload.toClassId,
            sectionId: payload.toSectionId,
            rollNo: student.rollNo,
            status: 'ENROLLED',
          },
        });
      }
    }
    return created;
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_PROMOTION',
    entityId: promotion.id,
    action: 'CREATE',
    afterState: {
      fromAcademicSessionId: payload.fromAcademicSessionId,
      toAcademicSessionId: payload.toAcademicSessionId,
      count: payload.results.length,
    },
  });

  res.status(201).json(promotion);
};

export const listDisabledStudents = async (req: Request, res: Response) => {
  const { schoolId } = requireSchoolAdmin(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      status: 'DISABLED',
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(search
        ? {
            OR: [
              { admissionNo: { contains: search, mode: 'insensitive' } },
              { rollNo: { contains: search, mode: 'insensitive' } },
              { fullName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      class: { select: { id: true, name: true } },
      section: { select: { id: true, name: true } },
      disabledLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.status(200).json(students);
};

const disabledActionSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

export const disableStudent = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const payload = disabledActionSchema.parse(req.body);
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new HttpError(404, 'Student not found');
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.student.update({ where: { id }, data: { status: 'DISABLED' } });
    await tx.disabledStudentLog.create({
      data: { schoolId, studentId: id, action: 'DISABLED', reason: normalizeText(payload.reason) ?? null, actorId: userId },
    });
    return record;
  });
  await invalidateStudentCache(schoolId, id);
  res.status(200).json(updated);
};

export const restoreDisabledStudent = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const payload = disabledActionSchema.parse(req.body);
  const student = await prisma.student.findFirst({ where: { id, schoolId, status: 'DISABLED' } });
  if (!student) throw new HttpError(404, 'Disabled student not found');
  const updated = await prisma.$transaction(async (tx) => {
    const record = await tx.student.update({ where: { id }, data: { status: 'ENROLLED' } });
    await tx.disabledStudentLog.create({
      data: { schoolId, studentId: id, action: 'RESTORED', reason: normalizeText(payload.reason) ?? null, actorId: userId },
    });
    return record;
  });
  await invalidateStudentCache(schoolId, id);
  res.status(200).json(updated);
};

export const deleteDisabledStudent = async (req: Request, res: Response) => {
  const { schoolId, userId } = requireSchoolAdmin(req);
  const { id } = req.params;
  const student = await prisma.student.findFirst({ where: { id, schoolId, status: 'DISABLED' }, select: { id: true } });
  if (!student) throw new HttpError(404, 'Disabled student not found');
  await prisma.disabledStudentLog.create({ data: { schoolId, studentId: id, action: 'DELETED', actorId: userId } });
  await prisma.student.delete({ where: { id } });
  res.status(204).send();
};
