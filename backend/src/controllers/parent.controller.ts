import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { hashPassword } from '../utils/password';
import { logAudit } from '../utils/audit';
import { invalidateStudentCache } from '../services/cache/cache.invalidation';
import { sendAccountCreatedWhatsapp } from '../services/accountOnboardingWhatsapp.service';
import {
  parseOffsetPagination,
  setOffsetPaginationHeaders,
  toOffsetPageInfo,
} from '../utils/pagination';
import {
  decryptParentProfileSensitiveFieldList,
  decryptParentProfileSensitiveFields,
  encryptParentProfileSensitiveFields,
  parentProfileAnyContactWhere,
  parentProfileContactWhere,
} from '../modules/students/utils/parent-profile-sensitive-fields';

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

const buildParentTempPassword = (firstName: string, lastName: string, phone?: string | null) => {
  const namePart = `${firstName}${lastName}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toLowerCase();
  const phonePart = String(phone ?? '').replace(/\D/g, '').slice(-4);
  if (!namePart || phonePart.length < 4) {
    throw new HttpError(400, 'Parent name and last 4 mobile digits are required to create parent login password');
  }
  return `${namePart}@${phonePart}`;
};

const parentProfileSelect = {
  id: true,
  userId: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

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

  const result = await prisma.$transaction(async (tx) => {
    let userId = payload.userId ?? null;
    let tempPassword: string | null = null;
    let created = false;
    const contactMatches = [
      ...(payload.phone ? parentProfileContactWhere('phone', [payload.phone]) : []),
      ...(payload.email ? parentProfileContactWhere('email', [payload.email]) : []),
    ];
    const existingContactProfile = contactMatches.length
      ? await tx.parentProfile.findFirst({
          where: { OR: contactMatches },
          select: parentProfileSelect,
        })
      : null;

    if (payload.createLogin) {
      await tx.role.upsert({
        where: { name: 'PARENT' },
        update: {},
        create: { name: 'PARENT' },
      });
      const email = payload.email ?? `${payload.phone}@parent.local`;
      if (existingContactProfile?.userId) {
        userId = existingContactProfile.userId;
      }
      if (!userId) {
        const existingUser = await tx.user.findFirst({
          where: { schoolId: null, email },
          select: { id: true },
        });
        if (existingUser) {
          userId = existingUser.id;
        }
      }
      if (!userId) {
        tempPassword = buildParentTempPassword(payload.firstName, payload.lastName, payload.phone);
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

    if (existingContactProfile) {
      const needsUserLink = userId && existingContactProfile.userId !== userId;
      const needsContactUpdate =
        (payload.phone && !existingContactProfile.phone) ||
        (payload.email && !existingContactProfile.email);
      if (needsUserLink || needsContactUpdate) {
        const updatedProfile = await tx.parentProfile.update({
          where: { id: existingContactProfile.id },
          data: encryptParentProfileSensitiveFields({
            userId: needsUserLink ? userId : undefined,
            phone: payload.phone && !existingContactProfile.phone ? payload.phone : undefined,
            email: payload.email && !existingContactProfile.email ? payload.email : undefined,
          }),
          select: parentProfileSelect,
        });
        return { parent: updatedProfile, tempPassword, created: false };
      }
      return { parent: existingContactProfile, tempPassword: null, created: false };
    }

    const existingProfile = userId
      ? await tx.parentProfile.findFirst({
          where: { userId },
          select: parentProfileSelect,
        })
      : null;
    if (existingProfile) {
      return { parent: existingProfile, tempPassword: null, created: false };
    }

    const parent = await tx.parentProfile.create({
      data: encryptParentProfileSensitiveFields({
        userId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
      }),
    });

    created = true;
    return { parent, tempPassword, created };
  });

  const responseParent = decryptParentProfileSensitiveFields(result.parent);

  if (result.created) {
    await logAudit(req, {
      schoolId,
      entityType: 'PARENT',
      entityId: responseParent.id,
      action: 'CREATE',
      afterState: {
        firstName: responseParent.firstName,
        lastName: responseParent.lastName,
        phone: responseParent.phone,
        email: responseParent.email,
        userId: responseParent.userId,
      },
    });
  }
  await invalidateStudentCache(schoolId);

  const whatsapp = result.tempPassword
    ? await sendAccountCreatedWhatsapp({
        role: 'PARENT',
        schoolId,
        email: responseParent.email ?? `${responseParent.phone ?? 'parent'}@parent.local`,
        mobile: responseParent.phone,
        tempPassword: result.tempPassword,
        fullName: `${responseParent.firstName} ${responseParent.lastName}`.trim(),
      })
    : null;

  res.status(result.created ? 201 : 200).json({
    ...responseParent,
    mappedSchoolId: schoolId,
    tempPassword: result.tempPassword,
    reusedExisting: !result.created,
    sendVia: payload.sendVia ?? null,
    whatsappSentTo: whatsapp?.sentTo ?? null,
    manualShareRequired: whatsapp?.manualShareRequired ?? false,
    manualShareText: whatsapp?.manualShareText ?? null,
    manualShareUrl: whatsapp?.manualShareUrl ?? null,
    notificationDeliveries: whatsapp?.deliveries ?? null,
  });
};

export const listParents = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const pagination = parseOffsetPagination(req.query, { defaultLimit: 50, maxLimit: 100 });
  const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
  const where = {
    links: { some: { student: { schoolId } } },
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' as const } },
            { lastName: { contains: query, mode: 'insensitive' as const } },
            ...parentProfileAnyContactWhere(query),
            { phone: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { links: { some: { student: { admissionNo: { contains: query, mode: 'insensitive' as const } } } } },
            { links: { some: { student: { fullName: { contains: query, mode: 'insensitive' as const } } } } },
          ],
        }
      : {}),
  };

  const [parents, total] = await Promise.all([
    prisma.parentProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.parentProfile.count({ where }),
  ]);
  setOffsetPaginationHeaders(res, toOffsetPageInfo(pagination, total));

  res.status(200).json(decryptParentProfileSensitiveFieldList(parents));
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
    where: { id, links: { some: { student: { schoolId } } } },
  });

  if (!parent) {
    throw new HttpError(404, 'Parent not found');
  }

  res.status(200).json(decryptParentProfileSensitiveFields(parent));
};

export const updateParent = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const id = idSchema.parse(req.params.id);

  const existing = await prisma.parentProfile.findFirst({
    where: { id, links: { some: { student: { schoolId } } } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, userId: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  const parent = await prisma.parentProfile.update({
    where: { id },
    data: encryptParentProfileSensitiveFields({
      firstName: payload.firstName ?? undefined,
      lastName: payload.lastName ?? undefined,
      phone: payload.phone === undefined ? undefined : payload.phone,
      email: payload.email === undefined ? undefined : payload.email,
      userId: payload.userId === undefined ? undefined : payload.userId,
    }),
  });
  const decryptedExisting = decryptParentProfileSensitiveFields(existing);
  const decryptedParent = decryptParentProfileSensitiveFields(parent);

  await logAudit(req, {
    schoolId,
    entityType: 'PARENT',
    entityId: decryptedParent.id,
    action: 'UPDATE',
    beforeState: decryptedExisting,
    afterState: {
      firstName: decryptedParent.firstName,
      lastName: decryptedParent.lastName,
      phone: decryptedParent.phone,
      email: decryptedParent.email,
      userId: decryptedParent.userId,
    },
  });
  await invalidateStudentCache(schoolId);

  res.status(200).json(decryptedParent);
};

export const deleteParent = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const id = idSchema.parse(req.params.id);

  const existing = await prisma.parentProfile.findFirst({
    where: { id, links: { some: { student: { schoolId } } } },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, userId: true },
  });

  if (!existing) {
    throw new HttpError(404, 'Parent not found');
  }

  await prisma.parentProfile.delete({ where: { id } });

  await logAudit(req, {
    schoolId,
    entityType: 'PARENT',
    entityId: id,
    action: 'DELETE',
    beforeState: decryptParentProfileSensitiveFields(existing),
  });
  await invalidateStudentCache(schoolId);

  res.status(204).send();
};
