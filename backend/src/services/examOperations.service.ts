import PDFDocument from 'pdfkit';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const normalizeCode = (value: string) => value.trim().toUpperCase();

const validateRoomShape = (capacity: number, rows: number, columns: number) => {
  if (capacity <= 0) throw new HttpError(400, 'Room capacity must be greater than zero');
  if (rows <= 0 || columns <= 0) throw new HttpError(400, 'Room rows and columns must be greater than zero');
  if (rows * columns < capacity) {
    throw new HttpError(400, 'Room rows and columns must provide at least the configured capacity');
  }
};

export type ExamCenterPayload = {
  schoolId: string;
  name: string;
  code: string;
  address: string;
  contactPerson?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

export const listExamCenters = async (schoolId: string) => {
  return prisma.examCenter.findMany({
    where: { schoolId },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: { _count: { select: { rooms: true } } },
  });
};

export const createExamCenter = async (req: Request, payload: ExamCenterPayload) => {
  const center = await prisma.examCenter.create({
    data: {
      schoolId: payload.schoolId,
      name: payload.name.trim(),
      code: normalizeCode(payload.code),
      address: payload.address.trim(),
      contactPerson: payload.contactPerson?.trim() || null,
      phone: payload.phone?.trim() || null,
      isActive: payload.isActive ?? true,
    },
  });
  await logAudit(req, {
    schoolId: payload.schoolId,
    entityType: 'EXAM_CENTER',
    entityId: center.id,
    action: 'CREATE',
    afterState: center as unknown as Prisma.InputJsonValue,
  });
  return center;
};

export const updateExamCenter = async (req: Request, schoolId: string, centerId: string, payload: Partial<ExamCenterPayload>) => {
  const existing = await prisma.examCenter.findFirst({ where: { id: centerId, schoolId } });
  if (!existing) throw new HttpError(404, 'Exam center not found');
  const updated = await prisma.examCenter.update({
    where: { id: centerId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.code !== undefined ? { code: normalizeCode(payload.code) } : {}),
      ...(payload.address !== undefined ? { address: payload.address.trim() } : {}),
      ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson?.trim() || null } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
  });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_CENTER',
    entityId: centerId,
    action: 'UPDATE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });
  return updated;
};

export const deleteExamCenter = async (req: Request, schoolId: string, centerId: string) => {
  const existing = await prisma.examCenter.findFirst({ where: { id: centerId, schoolId } });
  if (!existing) throw new HttpError(404, 'Exam center not found');
  const [rooms, seating, invigilators] = await Promise.all([
    prisma.examRoom.count({ where: { centerId, schoolId } }),
    prisma.examSeatingAllocation.count({ where: { centerId, schoolId } }),
    prisma.examInvigilatorAssignment.count({ where: { centerId, schoolId } }),
  ]);
  if (rooms || seating || invigilators) {
    throw new HttpError(409, 'Center is in use and cannot be deleted');
  }
  await prisma.examCenter.delete({ where: { id: centerId } });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_CENTER',
    entityId: centerId,
    action: 'DELETE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
  });
};

export type ExamRoomPayload = {
  schoolId: string;
  centerId: string;
  name: string;
  code: string;
  floor?: string | null;
  capacity: number;
  rows: number;
  columns: number;
  isActive?: boolean;
};

export const listExamRooms = async (schoolId: string, centerId?: string) => {
  return prisma.examRoom.findMany({
    where: { schoolId, ...(centerId ? { centerId } : {}) },
    orderBy: [{ center: { name: 'asc' } }, { name: 'asc' }],
    include: { center: true },
  });
};

export const createExamRoom = async (req: Request, payload: ExamRoomPayload) => {
  validateRoomShape(payload.capacity, payload.rows, payload.columns);
  const center = await prisma.examCenter.findFirst({ where: { id: payload.centerId, schoolId: payload.schoolId } });
  if (!center) throw new HttpError(404, 'Exam center not found');
  const room = await prisma.examRoom.create({
    data: {
      schoolId: payload.schoolId,
      centerId: payload.centerId,
      name: payload.name.trim(),
      code: normalizeCode(payload.code),
      floor: payload.floor?.trim() || null,
      capacity: payload.capacity,
      rows: payload.rows,
      columns: payload.columns,
      isActive: payload.isActive ?? true,
    },
    include: { center: true },
  });
  await logAudit(req, {
    schoolId: payload.schoolId,
    entityType: 'EXAM_ROOM',
    entityId: room.id,
    action: 'CREATE',
    afterState: room as unknown as Prisma.InputJsonValue,
  });
  return room;
};

export const updateExamRoom = async (req: Request, schoolId: string, roomId: string, payload: Partial<ExamRoomPayload>) => {
  const existing = await prisma.examRoom.findFirst({ where: { id: roomId, schoolId } });
  if (!existing) throw new HttpError(404, 'Exam room not found');
  const next = {
    capacity: payload.capacity ?? existing.capacity,
    rows: payload.rows ?? existing.rows,
    columns: payload.columns ?? existing.columns,
  };
  validateRoomShape(next.capacity, next.rows, next.columns);
  if (payload.centerId) {
    const center = await prisma.examCenter.findFirst({ where: { id: payload.centerId, schoolId } });
    if (!center) throw new HttpError(404, 'Exam center not found');
  }
  const updated = await prisma.examRoom.update({
    where: { id: roomId },
    data: {
      ...(payload.centerId !== undefined ? { centerId: payload.centerId } : {}),
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.code !== undefined ? { code: normalizeCode(payload.code) } : {}),
      ...(payload.floor !== undefined ? { floor: payload.floor?.trim() || null } : {}),
      ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
      ...(payload.rows !== undefined ? { rows: payload.rows } : {}),
      ...(payload.columns !== undefined ? { columns: payload.columns } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    include: { center: true },
  });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_ROOM',
    entityId: roomId,
    action: 'UPDATE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
    afterState: updated as unknown as Prisma.InputJsonValue,
  });
  return updated;
};

export const deleteExamRoom = async (req: Request, schoolId: string, roomId: string) => {
  const existing = await prisma.examRoom.findFirst({ where: { id: roomId, schoolId } });
  if (!existing) throw new HttpError(404, 'Exam room not found');
  const [seating, invigilators] = await Promise.all([
    prisma.examSeatingAllocation.count({ where: { roomId, schoolId } }),
    prisma.examInvigilatorAssignment.count({ where: { roomId, schoolId } }),
  ]);
  if (seating || invigilators) throw new HttpError(409, 'Room is in use and cannot be deleted');
  await prisma.examRoom.delete({ where: { id: roomId } });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_ROOM',
    entityId: roomId,
    action: 'DELETE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
  });
};

const getExamOrThrow = async (schoolId: string, examId: string) => {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { papers: { include: { subject: true } }, class: true, section: true, academicYear: true, school: true },
  });
  if (!exam) throw new HttpError(404, 'Exam not found');
  return exam;
};

export const getExamSeating = async (schoolId: string, examId: string) => {
  await getExamOrThrow(schoolId, examId);
  const allocations = await prisma.examSeatingAllocation.findMany({
    where: { schoolId, examId },
    orderBy: [{ room: { center: { name: 'asc' } } }, { room: { name: 'asc' } }, { seatRow: 'asc' }, { seatColumn: 'asc' }],
    include: {
      center: true,
      room: true,
      student: { select: { id: true, admissionNo: true, rollNo: true, fullName: true, class: true, section: true } },
    },
  });
  const rooms = await prisma.examRoom.findMany({
    where: { schoolId, isActive: true, center: { isActive: true } },
    include: { center: true },
    orderBy: [{ center: { name: 'asc' } }, { name: 'asc' }],
  });
  return {
    allocations,
    summary: {
      allocated: allocations.length,
      activeCapacity: rooms.reduce((sum, room) => sum + room.capacity, 0),
      rooms: rooms.map((room) => ({
        roomId: room.id,
        roomName: room.name,
        centerName: room.center.name,
        capacity: room.capacity,
        allocated: allocations.filter((entry) => entry.roomId === room.id).length,
      })),
    },
  };
};

export const generateExamSeating = async (
  req: Request,
  schoolId: string,
  examId: string,
  params: { classId?: string; sectionId?: string; roomIds?: string[]; force?: boolean },
) => {
  const exam = await getExamOrThrow(schoolId, examId);
  const classId = params.classId ?? exam.classId;
  const sectionId = params.sectionId ?? exam.sectionId;
  if (!classId) throw new HttpError(400, 'Class is required for seating allocation');

  const [existingCount, rooms, students] = await Promise.all([
    prisma.examSeatingAllocation.count({ where: { schoolId, examId } }),
    prisma.examRoom.findMany({
      where: {
        schoolId,
        isActive: true,
        center: { isActive: true },
        ...(params.roomIds?.length ? { id: { in: params.roomIds } } : {}),
      },
      include: { center: true },
      orderBy: [{ center: { code: 'asc' } }, { code: 'asc' }],
    }),
    prisma.student.findMany({
      where: {
        schoolId,
        classId,
        ...(sectionId ? { sectionId } : {}),
        status: 'ENROLLED',
      },
      orderBy: [{ rollNo: 'asc' }, { admissionNo: 'asc' }, { fullName: 'asc' }],
      select: { id: true, admissionNo: true, rollNo: true, fullName: true },
    }),
  ]);

  if (existingCount > 0 && !params.force) {
    throw new HttpError(409, 'Seating already exists. Confirm regeneration to replace it.');
  }
  if (!students.length) throw new HttpError(400, 'No active students found for this exam');
  if (!rooms.length) throw new HttpError(400, 'No active exam rooms are available');

  const capacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
  if (students.length > capacity) {
    throw new HttpError(400, 'Active room capacity is insufficient for selected students', {
      students: students.length,
      capacity,
    });
  }

  const rows: Prisma.ExamSeatingAllocationCreateManyInput[] = [];
  let studentIndex = 0;
  for (const room of rooms) {
    for (let seat = 1; seat <= room.capacity && studentIndex < students.length; seat += 1) {
      const seatRow = Math.ceil(seat / room.columns);
      const seatColumn = ((seat - 1) % room.columns) + 1;
      rows.push({
        schoolId,
        examId,
        studentId: students[studentIndex].id,
        centerId: room.centerId,
        roomId: room.id,
        seatRow,
        seatColumn,
        seatNumber: `${room.code}-${String(seat).padStart(3, '0')}`,
      });
      studentIndex += 1;
    }
  }

  await prisma.$transaction(async (tx) => {
    if (existingCount) {
      await tx.examSeatingAllocation.deleteMany({ where: { schoolId, examId } });
    }
    await tx.examSeatingAllocation.createMany({ data: rows });
  });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_SEATING',
    entityId: examId,
    action: existingCount ? 'REGENERATE' : 'GENERATE',
    afterState: { examId, classId, sectionId, students: students.length, rooms: rooms.length, capacity },
  });

  return getExamSeating(schoolId, examId);
};

export const clearExamSeating = async (req: Request, schoolId: string, examId: string) => {
  await getExamOrThrow(schoolId, examId);
  const existing = await prisma.examSeatingAllocation.findMany({ where: { schoolId, examId } });
  await prisma.examSeatingAllocation.deleteMany({ where: { schoolId, examId } });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_SEATING',
    entityId: examId,
    action: 'CLEAR',
    beforeState: { count: existing.length },
  });
};

const examSlotKeys = (exam: { scheduledAt: Date | null; papers?: Array<{ scheduledAt: Date | null }> }) => {
  const keys = new Set<string>();
  if (exam.scheduledAt) keys.add(exam.scheduledAt.toISOString());
  exam.papers?.forEach((paper) => {
    if (paper.scheduledAt) keys.add(paper.scheduledAt.toISOString());
  });
  return keys;
};

export const listExamInvigilators = async (schoolId: string, examId: string) => {
  await getExamOrThrow(schoolId, examId);
  return prisma.examInvigilatorAssignment.findMany({
    where: { schoolId, examId },
    orderBy: [{ center: { name: 'asc' } }, { room: { name: 'asc' } }],
    include: { center: true, room: true, teacher: { include: { user: { select: { email: true } } } } },
  });
};

export const assignExamInvigilator = async (
  req: Request,
  schoolId: string,
  examId: string,
  payload: { teacherId: string; roomId: string },
) => {
  const exam = await getExamOrThrow(schoolId, examId);
  const [teacher, room, sameExamExisting, roomExisting, teacherAssignments] = await Promise.all([
    prisma.teacherProfile.findFirst({ where: { id: payload.teacherId, schoolId, isActive: true } }),
    prisma.examRoom.findFirst({ where: { id: payload.roomId, schoolId, isActive: true, center: { isActive: true } } }),
    prisma.examInvigilatorAssignment.findFirst({ where: { schoolId, examId, teacherId: payload.teacherId } }),
    prisma.examInvigilatorAssignment.findFirst({ where: { schoolId, examId, roomId: payload.roomId } }),
    prisma.examInvigilatorAssignment.findMany({
      where: { schoolId, teacherId: payload.teacherId, examId: { not: examId } },
      include: { exam: { include: { papers: true } } },
    }),
  ]);
  if (!teacher) throw new HttpError(404, 'Active invigilator not found');
  if (!room) throw new HttpError(404, 'Active exam room not found');
  if (sameExamExisting) throw new HttpError(409, 'Invigilator is already assigned in this exam');
  if (roomExisting) throw new HttpError(409, 'Room already has an invigilator for this exam');

  const currentSlots = examSlotKeys(exam);
  const conflict = teacherAssignments.find((assignment) => {
    const otherSlots = examSlotKeys(assignment.exam);
    return [...currentSlots].some((slot) => otherSlots.has(slot));
  });
  if (conflict) throw new HttpError(409, 'Invigilator is double-booked for an overlapping exam slot');

  const assignment = await prisma.examInvigilatorAssignment.create({
    data: {
      schoolId,
      examId,
      teacherId: payload.teacherId,
      centerId: room.centerId,
      roomId: room.id,
    },
    include: { center: true, room: true, teacher: true },
  });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_INVIGILATOR',
    entityId: assignment.id,
    action: 'ASSIGN',
    afterState: assignment as unknown as Prisma.InputJsonValue,
  });
  return assignment;
};

export const removeExamInvigilator = async (req: Request, schoolId: string, examId: string, assignmentId: string) => {
  const existing = await prisma.examInvigilatorAssignment.findFirst({ where: { id: assignmentId, schoolId, examId } });
  if (!existing) throw new HttpError(404, 'Invigilator assignment not found');
  await prisma.examInvigilatorAssignment.delete({ where: { id: assignmentId } });
  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_INVIGILATOR',
    entityId: assignmentId,
    action: 'REMOVE',
    beforeState: existing as unknown as Prisma.InputJsonValue,
  });
};

export const listHallTickets = async (schoolId: string, examId: string) => {
  await getExamOrThrow(schoolId, examId);
  const students = await prisma.student.findMany({
    where: { schoolId, marks: { some: { examPaper: { examId } } } },
    orderBy: [{ rollNo: 'asc' }, { admissionNo: 'asc' }],
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      fullName: true,
      class: true,
      section: true,
      examSeatingAllocations: {
        where: { examId },
        include: { center: true, room: true },
        take: 1,
      },
    },
  });
  if (students.length) return students;
  const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { classId: true, sectionId: true } });
  return prisma.student.findMany({
    where: {
      schoolId,
      status: 'ENROLLED',
      ...(exam?.classId ? { classId: exam.classId } : {}),
      ...(exam?.sectionId ? { sectionId: exam.sectionId } : {}),
    },
    orderBy: [{ rollNo: 'asc' }, { admissionNo: 'asc' }],
    select: {
      id: true,
      admissionNo: true,
      rollNo: true,
      fullName: true,
      class: true,
      section: true,
      examSeatingAllocations: {
        where: { examId },
        include: { center: true, room: true },
        take: 1,
      },
    },
  });
};

export const buildHallTicketPdf = async (req: Request, schoolId: string, examId: string, studentId: string) => {
  const exam = await getExamOrThrow(schoolId, examId);
  const allocation = await prisma.examSeatingAllocation.findFirst({
    where: { schoolId, examId, studentId },
    include: {
      center: true,
      room: true,
      student: { include: { class: true, section: true } },
    },
  });
  if (!allocation) throw new HttpError(400, 'Hall ticket cannot be generated before seating allocation');
  if (!exam.scheduledAt && !exam.papers.some((paper) => paper.scheduledAt)) {
    throw new HttpError(400, 'Hall ticket requires an exam schedule');
  }
  if (!allocation.center || !allocation.room) throw new HttpError(400, 'Hall ticket requires assigned center and room');

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(exam.school.name, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(15).text('Hall Ticket', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Exam: ${exam.name}`);
    doc.text(`Student: ${allocation.student.fullName}`);
    doc.text(`Admission No: ${allocation.student.admissionNo}`);
    doc.text(`Roll No: ${allocation.student.rollNo ?? '-'}`);
    doc.text(`Class/Section: ${allocation.student.class?.name ?? '-'} / ${allocation.student.section?.name ?? '-'}`);
    doc.text(`Center: ${allocation.center.name} (${allocation.center.code})`);
    doc.text(`Address: ${allocation.center.address}`);
    doc.text(`Room: ${allocation.room.name} (${allocation.room.code})`);
    doc.text(`Seat: ${allocation.seatNumber} - Row ${allocation.seatRow}, Column ${allocation.seatColumn}`);
    doc.moveDown();
    doc.fontSize(12).text('Schedule', { underline: true });
    if (exam.scheduledAt) doc.fontSize(10).text(`${exam.name}: ${exam.scheduledAt.toLocaleString('en-IN')}`);
    exam.papers.forEach((paper) => {
      doc.fontSize(10).text(`${paper.subject.name}: ${paper.scheduledAt ? paper.scheduledAt.toLocaleString('en-IN') : 'Schedule pending'}`);
    });
    doc.moveDown();
    doc.fontSize(12).text('Instructions', { underline: true });
    [
      'Carry this hall ticket and a valid school ID card.',
      'Report to the exam center at least 30 minutes before the scheduled time.',
      'Electronic devices and unauthorized materials are not permitted.',
    ].forEach((line) => doc.fontSize(10).text(`- ${line}`));
    doc.end();
  });

  await logAudit(req, {
    schoolId,
    entityType: 'EXAM_HALL_TICKET',
    entityId: `${examId}:${studentId}`,
    action: 'DOWNLOAD',
    afterState: { examId, studentId, allocationId: allocation.id },
  });

  return buffer;
};
