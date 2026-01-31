import type { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { hashPassword } from '../utils/password';

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  createLogin: z.boolean().optional(),
  sendVia: z.enum(['SMS', 'EMAIL', 'BOTH']).optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(5).optional().nullable(),
  email: z.string().email().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  schoolId: z.string().uuid().optional(),
});
const idSchema = z.string().uuid();

export const createParent = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);

  if (payload.createLogin && !payload.phone) {
    throw new HttpError(400, 'Phone is required to create parent login');
  }

  if (payload.userId) {
    const user = await prisma.user.findFirst({
      where: { id: payload.userId },
      select: { id: true, schoolId: true },
    });

    if (!user) {
      throw new HttpError(404, 'User not found');
    }
  }

  const existingByPhone = payload.phone
    ? await prisma.parentProfile.findFirst({
        where: { schoolId, phone: payload.phone },
        select: { id: true },
      })
    : null;
  if (existingByPhone && payload.createLogin) {
    throw new HttpError(409, 'Parent with this phone already exists in this school');
  }

  const result = await prisma.$transaction(async (tx) => {
    let userId = payload.userId ?? null;
    let tempPassword: string | null = null;

    if (payload.createLogin) {
      const email = payload.email ?? `${payload.phone}@parent.local`;
      const existingUser = await tx.user.findFirst({
        where: { schoolId: null, email },
        select: { id: true },
      });
      if (existingUser) {
        userId = existingUser.id;
      } else {
        tempPassword = crypto.randomBytes(9).toString('base64url');
        const passwordHash = await hashPassword(tempPassword);
        const createdUser = await tx.user.create({
          data: {
            schoolId: null,
            email,
            passwordHash,
            mustChangePassword: true,
            status: 'ACTIVE',
            roles: {
              create: [{ role: { connect: { name: 'PARENT' } } }],
            },
          },
          select: { id: true },
        });
        userId = createdUser.id;
      }
    }

    const existingProfile = userId
      ? await tx.parentProfile.findFirst({
          where: { schoolId, userId },
          select: { id: true },
        })
      : null;
    if (existingProfile) {
      throw new HttpError(409, 'Parent already linked to this school');
    }

    const parent = await tx.parentProfile.create({
      data: {
        schoolId,
        userId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
      },
    });

    return { parent, tempPassword };
  });

  res.status(201).json({ ...result.parent, tempPassword: result.tempPassword, sendVia: payload.sendVia ?? null });
};

export const listParents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const parents = await prisma.parentProfile.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(parents);
};

export const lookupParentByPhone = async (req: Request, res: Response) => {
  const phone = z.string().min(10).parse(req.query.phone);
  const email = `${phone}@parent.local`;

  const user = await prisma.user.findFirst({
    where: { schoolId: null, email },
    select: { id: true, email: true },
  });

  if (!user) {
    res.status(200).json({ found: false });
    return;
  }

  const profile = await prisma.parentProfile.findFirst({
    where: { userId: user.id },
    select: { firstName: true, lastName: true },
  });

  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : user.email;

  res.status(200).json({
    found: true,
    userId: user.id,
    displayName,
    phone,
  });
};

export const getParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const id = idSchema.parse(req.params.id);

  const parent = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
  });

  if (!parent) {
    throw new HttpError(404, 'Parent not found');
  }

  res.status(200).json(parent);
};

export const updateParent = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const id = idSchema.parse(req.params.id);

  const existing = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  const parent = await prisma.parentProfile.update({
    where: { id },
    data: {
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      phone: payload.phone === undefined ? undefined : payload.phone,
      email: payload.email === undefined ? undefined : payload.email,
      userId: payload.userId === undefined ? undefined : payload.userId,
    },
  });

  res.status(200).json(parent);
};

export const deleteParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const id = idSchema.parse(req.params.id);

  const existing = await prisma.parentProfile.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  await prisma.parentProfile.delete({ where: { id } });

  res.status(204).send();
};
