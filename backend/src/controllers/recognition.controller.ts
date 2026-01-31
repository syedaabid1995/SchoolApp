import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { recognizeFace } from '../services/face-recognition.service';

const livenessSchema = z
  .object({
    blinkDetected: z.boolean().optional(),
    motionDetected: z.boolean().optional(),
    spoofDetected: z.boolean().optional(),
  })
  .optional();

const recognizeSchema = z.object({
  embedding: z.array(z.number()).min(1),
  threshold: z.number().min(0).max(1).optional(),
  enforceLiveness: z.boolean().optional(),
  liveness: livenessSchema,
  schoolId: z.string().uuid().optional(),
});

export const recognize = async (req: Request, res: Response) => {
  const payload = recognizeSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');

  const result = await recognizeFace({
    schoolId,
    embedding: payload.embedding,
    threshold: payload.threshold,
    enforceLiveness: payload.enforceLiveness,
    liveness: payload.liveness,
  });

  res.status(200).json(result);
};
