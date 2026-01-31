import type { Request, Response } from 'express';
import { z } from 'zod';
import { requestOtp, verifyOtp } from '../services/otp.service';
import { resolveSchoolId } from '../utils/tenant';

const requestSchema = z.object({
  phone: z.string().min(8),
  schoolId: z.string().uuid().optional(),
});

const verifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
  schoolId: z.string().uuid().optional(),
});

export const requestOtpApi = async (req: Request, res: Response) => {
  const payload = requestSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));

  const result = await requestOtp({
    schoolId,
    phone: payload.phone,
    actorId: req.auth?.userId,
    actorRole: req.auth ? 'PARENT' : undefined,
  });

  res.status(202).json(result);
};

export const verifyOtpApi = async (req: Request, res: Response) => {
  const payload = verifySchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));

  const result = await verifyOtp({
    schoolId,
    phone: payload.phone,
    code: payload.code,
  });

  res.status(200).json(result);
};
