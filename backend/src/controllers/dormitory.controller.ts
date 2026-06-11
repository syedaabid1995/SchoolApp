import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireDormitoryManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'School scope is required to manage dormitories');
};

const handleUniqueError = (err: unknown, message: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, message);
  }
  throw err;
};

const assertDormitory = async (schoolId: string, dormitoryId: string) => {
  const found = await prisma.dormitory.findFirst({
    where: { id: dormitoryId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Dormitory not found');
};

const assertRoomType = async (schoolId: string, roomTypeId: string) => {
  const found = await prisma.dormitoryRoomType.findFirst({
    where: { id: roomTypeId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Room type not found');
};

const dormitorySchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(1).max(80),
  intake: z.coerce.number().int().min(1).max(100000),
  address: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const roomTypeSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const roomSchema = z.object({
  dormitoryId: uuidSchema,
  roomTypeId: uuidSchema,
  roomNumber: z.string().min(1).max(50),
  bedCount: z.coerce.number().int().min(1).max(1000),
  costPerBed: z.coerce.number().min(0).max(100000000),
  description: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const studentAssignmentSchema = z.object({
  studentId: uuidSchema,
  dormitoryId: uuidSchema,
  roomId: uuidSchema.optional().nullable(),
  active: z.boolean().optional(),
  note: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const assertStudent = async (schoolId: string, studentId: string) => {
  const found = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Student not found');
};

const assertRoomInDormitory = async (schoolId: string, dormitoryId: string, roomId?: string | null, currentAssignmentId?: string) => {
  if (!roomId) return;

  const room = await prisma.dormitoryRoom.findFirst({
    where: { id: roomId, schoolId, dormitoryId },
    select: { id: true, bedCount: true },
  });
  if (!room) throw new HttpError(400, 'Selected room does not belong to this dormitory');

  const activeAssignments = await prisma.studentDormitoryAssignment.count({
    where: {
      schoolId,
      roomId,
      active: true,
      ...(currentAssignmentId ? { id: { not: currentAssignmentId } } : {}),
    },
  });
  if (activeAssignments >= room.bedCount) {
    throw new HttpError(409, 'Selected room has no available beds');
  }
};

export const listDormitories = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const dormitories = await prisma.dormitory.findMany({
    where: {
      schoolId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { type: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { rooms: true, assignments: true } },
    },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(dormitories);
};

export const createDormitory = async (req: Request, res: Response) => {
  const payload = dormitorySchema.parse(req.body);
  const { schoolId } = requireDormitoryManager(req, payload.schoolId);

  try {
    const item = await prisma.dormitory.create({
      data: {
        schoolId,
        name: normalizeText(payload.name),
        type: normalizeText(payload.type),
        intake: payload.intake,
        address: nullableText(payload.address),
        description: nullableText(payload.description),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'DORMITORY',
      entityId: item.id,
      action: 'CREATE',
      afterState: item,
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Dormitory name already exists for this school');
  }
};

export const updateDormitory = async (req: Request, res: Response) => {
  const payload = dormitorySchema.partial().parse(req.body);
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.dormitory.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Dormitory not found');

  try {
    const item = await prisma.dormitory.update({
      where: { id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        type: payload.type === undefined ? undefined : normalizeText(payload.type),
        intake: payload.intake ?? undefined,
        address: payload.address === undefined ? undefined : nullableText(payload.address),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'DORMITORY',
      entityId: id,
      action: 'UPDATE',
      beforeState: existing,
      afterState: item,
    });

    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Dormitory name already exists for this school');
  }
};

export const deleteDormitory = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.dormitory.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { rooms: true, assignments: true } } },
  });
  if (!existing) throw new HttpError(404, 'Dormitory not found');
  if (existing._count.rooms + existing._count.assignments > 0) {
    throw new HttpError(409, 'Cannot delete dormitory while rooms or student assignments exist');
  }

  await prisma.dormitory.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'DORMITORY', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

export const listDormitoryRoomTypes = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.dormitoryRoomType.findMany({
    where: {
      schoolId,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: { _count: { select: { rooms: true } } },
    orderBy: { name: 'asc' },
  });

  res.status(200).json(items);
};

export const createDormitoryRoomType = async (req: Request, res: Response) => {
  const payload = roomTypeSchema.parse(req.body);
  const { schoolId } = requireDormitoryManager(req, payload.schoolId);

  try {
    const item = await prisma.dormitoryRoomType.create({
      data: {
        schoolId,
        name: normalizeText(payload.name),
        description: nullableText(payload.description),
      },
    });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Room type already exists for this school');
  }
};

export const updateDormitoryRoomType = async (req: Request, res: Response) => {
  const payload = roomTypeSchema.partial().parse(req.body);
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.dormitoryRoomType.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Room type not found');

  try {
    const item = await prisma.dormitoryRoomType.update({
      where: { id },
      data: {
        name: payload.name === undefined ? undefined : normalizeText(payload.name),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
      },
    });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Room type already exists for this school');
  }
};

export const deleteDormitoryRoomType = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.dormitoryRoomType.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { rooms: true } } },
  });
  if (!existing) throw new HttpError(404, 'Room type not found');
  if (existing._count.rooms > 0) throw new HttpError(409, 'Cannot delete room type while dormitory rooms use it');

  await prisma.dormitoryRoomType.delete({ where: { id } });
  res.status(204).send();
};

export const listDormitoryRooms = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.dormitoryRoom.findMany({
    where: {
      schoolId,
      ...(search
        ? {
            OR: [
              { roomNumber: { contains: search, mode: 'insensitive' } },
              { dormitory: { name: { contains: search, mode: 'insensitive' } } },
              { roomType: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      dormitory: { select: { id: true, name: true, type: true } },
      roomType: { select: { id: true, name: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ dormitory: { name: 'asc' } }, { roomNumber: 'asc' }],
  });

  res.status(200).json(items);
};

export const createDormitoryRoom = async (req: Request, res: Response) => {
  const payload = roomSchema.parse(req.body);
  const { schoolId } = requireDormitoryManager(req, payload.schoolId);

  await assertDormitory(schoolId, payload.dormitoryId);
  await assertRoomType(schoolId, payload.roomTypeId);

  try {
    const item = await prisma.dormitoryRoom.create({
      data: {
        schoolId,
        dormitoryId: payload.dormitoryId,
        roomTypeId: payload.roomTypeId,
        roomNumber: normalizeText(payload.roomNumber),
        bedCount: payload.bedCount,
        costPerBed: new Prisma.Decimal(payload.costPerBed),
        description: nullableText(payload.description),
      },
    });
    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Dormitory room already exists for this room type');
  }
};

export const updateDormitoryRoom = async (req: Request, res: Response) => {
  const payload = roomSchema.partial().parse(req.body);
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.dormitoryRoom.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Dormitory room not found');
  const dormitoryId = payload.dormitoryId ?? existing.dormitoryId;
  const roomTypeId = payload.roomTypeId ?? existing.roomTypeId;

  await assertDormitory(schoolId, dormitoryId);
  await assertRoomType(schoolId, roomTypeId);

  try {
    const item = await prisma.dormitoryRoom.update({
      where: { id },
      data: {
        dormitoryId: payload.dormitoryId ?? undefined,
        roomTypeId: payload.roomTypeId ?? undefined,
        roomNumber: payload.roomNumber === undefined ? undefined : normalizeText(payload.roomNumber),
        bedCount: payload.bedCount ?? undefined,
        costPerBed: payload.costPerBed === undefined ? undefined : new Prisma.Decimal(payload.costPerBed),
        description: payload.description === undefined ? undefined : nullableText(payload.description),
      },
    });
    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Dormitory room already exists for this room type');
  }
};

export const deleteDormitoryRoom = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.dormitoryRoom.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { assignments: true } } },
  });
  if (!existing) throw new HttpError(404, 'Dormitory room not found');
  if (existing._count.assignments > 0) {
    throw new HttpError(409, 'Cannot delete room while student assignments exist');
  }

  await prisma.dormitoryRoom.delete({ where: { id } });
  res.status(204).send();
};

export const listStudentDormitoryAssignments = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const dormitoryId = typeof req.query.dormitoryId === 'string' ? req.query.dormitoryId : undefined;
  const roomId = typeof req.query.roomId === 'string' ? req.query.roomId : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const active = req.query.active === 'all' ? undefined : req.query.active === 'false' ? false : true;

  if (classId) {
    const foundClass = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
    if (!foundClass) throw new HttpError(404, 'Class not found');
  }
  if (sectionId) {
    const foundSection = await prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
    if (!foundSection) throw new HttpError(404, 'Section not found');
  }
  if (dormitoryId) await assertDormitory(schoolId, dormitoryId);

  const items = await prisma.studentDormitoryAssignment.findMany({
    where: {
      schoolId,
      ...(active === undefined ? {} : { active }),
      ...(dormitoryId ? { dormitoryId } : {}),
      ...(roomId ? { roomId } : {}),
      student: {
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { admissionNo: { contains: search, mode: 'insensitive' } },
                { rollNo: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          rollNo: true,
          fullName: true,
          phone: true,
          parentPhone: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      dormitory: { select: { id: true, name: true } },
      room: {
        select: {
          id: true,
          roomNumber: true,
          bedCount: true,
          costPerBed: true,
          roomType: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ student: { class: { name: 'asc' } } }, { student: { section: { name: 'asc' } } }, { student: { fullName: 'asc' } }],
  });

  res.status(200).json(items);
};

export const createStudentDormitoryAssignment = async (req: Request, res: Response) => {
  const payload = studentAssignmentSchema.parse(req.body);
  const { schoolId } = requireDormitoryManager(req, payload.schoolId);
  const roomId = payload.roomId || null;

  await assertStudent(schoolId, payload.studentId);
  await assertDormitory(schoolId, payload.dormitoryId);

  const existing = await prisma.studentDormitoryAssignment.findFirst({
    where: { schoolId, studentId: payload.studentId, active: true },
  });

  await assertRoomInDormitory(schoolId, payload.dormitoryId, roomId, existing?.id);

  const include = {
    student: { select: { id: true, admissionNo: true, rollNo: true, fullName: true, phone: true, parentPhone: true, class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } } },
    dormitory: { select: { id: true, name: true } },
    room: { select: { id: true, roomNumber: true, bedCount: true, costPerBed: true, roomType: { select: { id: true, name: true } } } },
  };

  const item = existing
    ? await prisma.studentDormitoryAssignment.update({
        where: { id: existing.id },
        data: {
          dormitoryId: payload.dormitoryId,
          roomId,
          active: payload.active ?? true,
          vacatedAt: payload.active === false ? new Date() : null,
          note: nullableText(payload.note),
        },
        include,
      })
    : await prisma.studentDormitoryAssignment.create({
        data: {
          schoolId,
          studentId: payload.studentId,
          dormitoryId: payload.dormitoryId,
          roomId,
          active: payload.active ?? true,
          vacatedAt: payload.active === false ? new Date() : null,
          note: nullableText(payload.note),
        },
        include,
      });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_DORMITORY_ASSIGNMENT',
    entityId: item.id,
    action: existing ? 'UPDATE' : 'CREATE',
    beforeState: existing,
    afterState: item,
  });

  res.status(existing ? 200 : 201).json(item);
};

export const updateStudentDormitoryAssignment = async (req: Request, res: Response) => {
  const payload = studentAssignmentSchema.partial().parse(req.body);
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.studentDormitoryAssignment.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Student dormitory assignment not found');

  const dormitoryId = payload.dormitoryId ?? existing.dormitoryId;
  const roomId = payload.roomId === undefined ? existing.roomId : payload.roomId || null;

  if (payload.studentId) await assertStudent(schoolId, payload.studentId);
  await assertDormitory(schoolId, dormitoryId);
  await assertRoomInDormitory(schoolId, dormitoryId, roomId, id);

  const item = await prisma.studentDormitoryAssignment.update({
    where: { id },
    data: {
      studentId: payload.studentId ?? undefined,
      dormitoryId: payload.dormitoryId ?? undefined,
      roomId: payload.roomId === undefined ? undefined : roomId,
      active: payload.active ?? undefined,
      vacatedAt: payload.active === false ? new Date() : payload.active === true ? null : undefined,
      note: payload.note === undefined ? undefined : nullableText(payload.note),
    },
    include: {
      student: { select: { id: true, admissionNo: true, rollNo: true, fullName: true, phone: true, parentPhone: true, class: { select: { id: true, name: true } }, section: { select: { id: true, name: true } } } },
      dormitory: { select: { id: true, name: true } },
      room: { select: { id: true, roomNumber: true, bedCount: true, costPerBed: true, roomType: { select: { id: true, name: true } } } },
    },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_DORMITORY_ASSIGNMENT',
    entityId: id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: item,
  });

  res.status(200).json(item);
};

export const deleteStudentDormitoryAssignment = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.studentDormitoryAssignment.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Student dormitory assignment not found');

  const item = await prisma.studentDormitoryAssignment.update({
    where: { id },
    data: { active: false, vacatedAt: new Date() },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'STUDENT_DORMITORY_ASSIGNMENT',
    entityId: id,
    action: 'UPDATE',
    beforeState: existing,
    afterState: item,
  });

  res.status(204).send();
};

export const getStudentDormitoryReport = async (req: Request, res: Response) => {
  const { schoolId } = requireDormitoryManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const dormitoryId = typeof req.query.dormitoryId === 'string' ? req.query.dormitoryId : undefined;

  if (classId) {
    const foundClass = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
    if (!foundClass) throw new HttpError(404, 'Class not found');
  }
  if (sectionId) {
    const foundSection = await prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
    if (!foundSection) throw new HttpError(404, 'Section not found');
  }
  if (dormitoryId) {
    await assertDormitory(schoolId, dormitoryId);
  }

  const items = await prisma.studentDormitoryAssignment.findMany({
    where: {
      schoolId,
      active: true,
      ...(dormitoryId ? { dormitoryId } : {}),
      student: {
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          rollNo: true,
          fullName: true,
          phone: true,
          parentPhone: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      dormitory: { select: { id: true, name: true } },
      room: {
        select: {
          id: true,
          roomNumber: true,
          bedCount: true,
          costPerBed: true,
          roomType: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ student: { class: { name: 'asc' } } }, { student: { section: { name: 'asc' } } }, { student: { fullName: 'asc' } }],
  });

  res.status(200).json(items);
};
