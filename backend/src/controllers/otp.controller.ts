import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { requestOtp, verifyOtp } from '../services/otp.service';
import { resolveSchoolId } from '../utils/tenant';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../middlewares/error.middleware';
import { hashPassword } from '../utils/password';

const requestSchema = z.object({
  phone: z.string().min(8),
  schoolId: z.string().uuid().optional(),
});

const verifySchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4),
  schoolId: z.string().uuid().optional(),
});

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';

const normalizePhone = (phone: string) => phone.replace(/\s+/g, '');

const resolveSchoolForPhone = async (req: Request, phone: string, schoolId?: string) => {
  if (req.auth?.schoolId) {
    return resolveSchoolId(req, schoolId ?? req.auth.schoolId);
  }
  if (schoolId) {
    return resolveSchoolId(req, schoolId);
  }
  const parents = await prisma.parentProfile.findMany({
    where: { phone: normalizePhone(phone) },
    select: { schoolId: true },
  });
  const unique = Array.from(new Set(parents.map((parent) => parent.schoolId)));
  if (unique.length === 1) {
    return unique[0];
  }
  if (unique.length === 0) {
    throw new HttpError(404, 'Parent not found');
  }
  throw new HttpError(400, 'Multiple schools found. Provide schoolId.');
};

const signToken = (payload: { sub: string; schoolId: string | null; role: string | null; email?: string | null; typ: 'access' | 'refresh' }, expiresIn: string) =>
  jwt.sign(payload, env.JWT_SECRET, { expiresIn });

export const requestOtpApi = async (req: Request, res: Response) => {
  const payload = requestSchema.parse(req.body);
  const schoolId = await resolveSchoolForPhone(req, payload.phone, payload.schoolId ?? (req.query.schoolId as string | undefined));

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
  const schoolId = await resolveSchoolForPhone(req, payload.phone, payload.schoolId ?? (req.query.schoolId as string | undefined));

  const result = await verifyOtp({
    schoolId,
    phone: payload.phone,
    code: payload.code,
  });

  const phone = normalizePhone(payload.phone);
  const parentProfile = await prisma.parentProfile.findFirst({
    where: { phone, schoolId },
  });
  if (!parentProfile) {
    throw new HttpError(404, 'Parent not found');
  }

  let userId = parentProfile.userId;
  if (!userId) {
    const email = `parent-${phone}@parent.local`;
    const passwordHash = await hashPassword(`${phone}-${Date.now()}`);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    userId = user.id;
    await prisma.parentProfile.update({
      where: { id: parentProfile.id },
      data: { userId },
    });
    const role = await prisma.role.findFirst({ where: { name: 'PARENT' } });
    if (role) {
      await prisma.userRole.create({
        data: { userId, roleId: role.id },
      });
    }
  }

  const roleRow = await prisma.userRole.findFirst({
    where: { userId },
    select: { role: { select: { name: true } } },
  });

  const payloadBase = {
    sub: userId,
    schoolId: null,
    role: roleRow?.role.name ?? 'PARENT',
    email: parentProfile.email ?? undefined,
  };

  const accessToken = signToken({ ...payloadBase, typ: 'access' }, ACCESS_TOKEN_TTL);
  const refreshToken = signToken({ ...payloadBase, typ: 'refresh' }, REFRESH_TOKEN_TTL);

  res.status(200).json({
    ...result,
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL,
  });
};
