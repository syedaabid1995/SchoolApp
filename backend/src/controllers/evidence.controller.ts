import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';

const createSchema = z.object({
  recordId: z.string().uuid(),
  imageUrl: z.string().url().optional(),
  confidence: z.number().min(0).max(1).optional(),
  modelVersion: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  schoolId: z.string().uuid().optional(),
});

export const createEvidence = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  const record = await prisma.attendanceRecord.findFirst({
    where: { id: payload.recordId, session: { schoolId } },
    select: { id: true },
  });

  if (!record) {
    throw new HttpError(404, 'Attendance record not found');
  }

  const evidence = await prisma.attendanceEvidence.create({
    data: {
      recordId: payload.recordId,
      imageUrl: payload.imageUrl ?? null,
      confidence: payload.confidence ?? null,
      modelVersion: payload.modelVersion ?? null,
      metadata: payload.metadata ?? null,
    },
  });

  res.status(201).json(evidence);
};

export const listEvidence = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { recordId } = req.params;

  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, session: { schoolId } },
    select: { id: true },
  });

  if (!record) {
    throw new HttpError(404, 'Attendance record not found');
  }

  const evidence = await prisma.attendanceEvidence.findMany({
    where: { recordId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(evidence);
};
