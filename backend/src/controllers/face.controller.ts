import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import {
  approveFaceEnrollment,
  createFaceEnrollment,
  reEnrollFace,
  rejectFaceEnrollment,
} from '../services/face.service';
import { prisma } from '../config/db';

const sampleSchema = z.object({
  imageUrl: z.string().url(),
  embedding: z.array(z.number()).min(1),
});

const enrollSchema = z.object({
  studentId: z.string().uuid(),
  samples: z.array(sampleSchema).min(2),
  schoolId: z.string().uuid().optional(),
});

const approveSchema = z.object({
  schoolId: z.string().uuid().optional(),
});

const rejectSchema = z.object({
  schoolId: z.string().uuid().optional(),
  reason: z.string().min(1).optional(),
});

export const enrollFace = async (req: Request, res: Response) => {
  const payload = enrollSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const profile = await createFaceEnrollment({
    schoolId,
    studentId: payload.studentId,
    createdById: auth.userId,
    samples: payload.samples,
  });

  res.status(201).json(profile);
};

export const reEnroll = async (req: Request, res: Response) => {
  const payload = enrollSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const profile = await reEnrollFace({
    schoolId,
    studentId: payload.studentId,
    createdById: auth.userId,
    samples: payload.samples,
  });

  res.status(200).json(profile);
};

export const approveFace = async (req: Request, res: Response) => {
  const payload = approveSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const profile = await approveFaceEnrollment({
    schoolId,
    faceProfileId: req.params.id,
    approvedById: auth.userId,
  });

  res.status(200).json(profile);
};

export const rejectFace = async (req: Request, res: Response) => {
  const payload = rejectSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const profile = await rejectFaceEnrollment({
    schoolId,
    faceProfileId: req.params.id,
    approvedById: auth.userId,
    reason: payload.reason,
  });

  res.status(200).json(profile);
};

export const getFaceProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const profile = await prisma.faceProfile.findFirst({
    where: { id, schoolId },
    include: { samples: true, student: true },
  });

  if (!profile) {
    throw new HttpError(404, 'Face profile not found');
  }

  res.status(200).json(profile);
};

export const getStudentFaceProfile = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { studentId } = req.params;

  const profile = await prisma.faceProfile.findFirst({
    where: { studentId, schoolId },
    include: { samples: true, student: true },
  });

  if (!profile) {
    throw new HttpError(404, 'Face profile not found');
  }

  res.status(200).json(profile);
};
