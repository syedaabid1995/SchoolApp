import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import {
  assignExamInvigilator,
  buildHallTicketPdf,
  clearExamSeating,
  createExamCenter,
  createExamRoom,
  deleteExamCenter,
  deleteExamRoom,
  generateExamSeating,
  getExamSeating,
  listExamCenters,
  listExamInvigilators,
  listExamRooms,
  listHallTickets,
  removeExamInvigilator,
  updateExamCenter,
  updateExamRoom,
} from '../services/examOperations.service';
import type { ExamCenterPayload, ExamRoomPayload } from '../services/examOperations.service';

const centerCreateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().min(1),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const centerUpdateSchema = centerCreateSchema.partial();

const roomCreateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  centerId: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  floor: z.string().optional().nullable(),
  capacity: z.coerce.number().int().positive(),
  rows: z.coerce.number().int().positive(),
  columns: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
});

const roomUpdateSchema = roomCreateSchema.partial();

const seatingGenerateSchema = z.object({
  schoolId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional().nullable(),
  roomIds: z.array(z.string().uuid()).optional(),
  force: z.boolean().optional(),
});

const invigilatorAssignSchema = z.object({
  schoolId: z.string().uuid().optional(),
  teacherId: z.string().uuid(),
  roomId: z.string().uuid(),
});

type CenterCreateInput = z.infer<typeof centerCreateSchema>;
type CenterUpdateInput = z.infer<typeof centerUpdateSchema>;
type RoomCreateInput = z.infer<typeof roomCreateSchema>;
type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;

const toCenterCreatePayload = (payload: CenterCreateInput, schoolId: string): ExamCenterPayload => ({
  schoolId,
  name: payload.name,
  code: payload.code,
  address: payload.address,
  contactPerson: payload.contactPerson,
  phone: payload.phone,
  isActive: payload.isActive,
});

const toCenterUpdatePayload = (payload: CenterUpdateInput) => ({
  ...(payload.name !== undefined ? { name: payload.name } : {}),
  ...(payload.code !== undefined ? { code: payload.code } : {}),
  ...(payload.address !== undefined ? { address: payload.address } : {}),
  ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson } : {}),
  ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
  ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
});

const toRoomCreatePayload = (payload: RoomCreateInput, schoolId: string): ExamRoomPayload => ({
  schoolId,
  centerId: payload.centerId,
  name: payload.name,
  code: payload.code,
  floor: payload.floor,
  capacity: payload.capacity,
  rows: payload.rows,
  columns: payload.columns,
  isActive: payload.isActive,
});

const toRoomUpdatePayload = (payload: RoomUpdateInput) => ({
  ...(payload.centerId !== undefined ? { centerId: payload.centerId } : {}),
  ...(payload.name !== undefined ? { name: payload.name } : {}),
  ...(payload.code !== undefined ? { code: payload.code } : {}),
  ...(payload.floor !== undefined ? { floor: payload.floor } : {}),
  ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
  ...(payload.rows !== undefined ? { rows: payload.rows } : {}),
  ...(payload.columns !== undefined ? { columns: payload.columns } : {}),
  ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
});

export const listExamCentersApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json(await listExamCenters(schoolId));
};

export const createExamCenterApi = async (req: Request, res: Response) => {
  const payload = centerCreateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  res.status(201).json(await createExamCenter(req, toCenterCreatePayload(payload, schoolId)));
};

export const updateExamCenterApi = async (req: Request, res: Response) => {
  const payload = centerUpdateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  res.status(200).json(await updateExamCenter(req, schoolId, req.params.centerId, toCenterUpdatePayload(payload)));
};

export const deleteExamCenterApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  await deleteExamCenter(req, schoolId, req.params.centerId);
  res.status(204).send();
};

export const listExamRoomsApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json(await listExamRooms(schoolId, req.query.centerId as string | undefined));
};

export const createExamRoomApi = async (req: Request, res: Response) => {
  const payload = roomCreateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  res.status(201).json(await createExamRoom(req, toRoomCreatePayload(payload, schoolId)));
};

export const updateExamRoomApi = async (req: Request, res: Response) => {
  const payload = roomUpdateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  res.status(200).json(await updateExamRoom(req, schoolId, req.params.roomId, toRoomUpdatePayload(payload)));
};

export const deleteExamRoomApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  await deleteExamRoom(req, schoolId, req.params.roomId);
  res.status(204).send();
};

export const getExamSeatingApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json(await getExamSeating(schoolId, req.params.examId));
};

export const generateExamSeatingApi = async (req: Request, res: Response) => {
  const payload = seatingGenerateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  res.status(201).json(
    await generateExamSeating(req, schoolId, req.params.examId, {
      classId: payload.classId,
      sectionId: payload.sectionId ?? undefined,
      roomIds: payload.roomIds,
      force: payload.force,
    }),
  );
};

export const clearExamSeatingApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  await clearExamSeating(req, schoolId, req.params.examId);
  res.status(204).send();
};

export const listExamInvigilatorsApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json(await listExamInvigilators(schoolId, req.params.examId));
};

export const assignExamInvigilatorApi = async (req: Request, res: Response) => {
  const payload = invigilatorAssignSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  res.status(201).json(await assignExamInvigilator(req, schoolId, req.params.examId, {
    teacherId: payload.teacherId,
    roomId: payload.roomId,
  }));
};

export const removeExamInvigilatorApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  await removeExamInvigilator(req, schoolId, req.params.examId, req.params.assignmentId);
  res.status(204).send();
};

export const listHallTicketsApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  res.status(200).json(await listHallTickets(schoolId, req.params.examId));
};

export const downloadHallTicketPdfApi = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const pdf = await buildHallTicketPdf(req, schoolId, req.params.examId, req.params.studentId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="hall-ticket-${req.params.studentId}.pdf"`);
  res.status(200).send(pdf);
};
