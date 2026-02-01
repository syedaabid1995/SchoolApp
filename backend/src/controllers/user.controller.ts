import type { Request, Response } from 'express';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export const getMe = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: {
      id: true,
      email: true,
      schoolId: true,
      teacherProfile: { select: { firstName: true, lastName: true } },
      parentProfiles: { select: { firstName: true, lastName: true }, take: 1 },
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  const role = user.roles[0]?.role.name ?? null;
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : null;
  const parentName = user.parentProfiles?.[0]
    ? `${user.parentProfiles[0].firstName} ${user.parentProfiles[0].lastName}`.trim()
    : null;
  const displayName = teacherName || parentName || user.email;

  res.status(200).json({
    id: user.id,
    email: user.email,
    schoolId: user.schoolId,
    role,
    displayName,
  });
};

export const getUserById = async (req: Request, res: Response) => {
  if (!req.auth?.userId) {
    throw new HttpError(401, 'Unauthorized');
  }

  const requester = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { id: true, schoolId: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      schoolId: true,
      teacherProfile: { select: { firstName: true, lastName: true, phone: true, address: true } },
      parentProfiles: { select: { firstName: true, lastName: true, phone: true, email: true } },
      roles: { select: { role: { select: { name: true } } } },
      createdAt: true,
    },
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  const requesterSchoolId = requester?.schoolId ?? null;
  const isSuperAdmin = requesterSchoolId === null;
  const sameSchoolUser = requesterSchoolId && user.schoolId === requesterSchoolId;
  const hasParentProfileInSchool = requesterSchoolId
    ? await prisma.studentParent.findFirst({
        where: {
          parent: { userId: user.id },
          student: { schoolId: requesterSchoolId },
        },
        select: { studentId: true },
      })
    : null;

  if (!isSuperAdmin && !sameSchoolUser && !hasParentProfileInSchool) {
    throw new HttpError(403, 'Forbidden');
  }

  const role = user.roles[0]?.role.name ?? null;
  const teacherName = user.teacherProfile
    ? `${user.teacherProfile.firstName} ${user.teacherProfile.lastName}`.trim()
    : null;
  const parentName = user.parentProfiles[0]
    ? `${user.parentProfiles[0].firstName} ${user.parentProfiles[0].lastName}`.trim()
    : null;

  res.status(200).json({
    id: user.id,
    email: user.email,
    schoolId: user.schoolId,
    role,
    teacherProfile: user.teacherProfile,
    parentProfiles: user.parentProfiles,
    displayName: teacherName || parentName || user.email,
    createdAt: user.createdAt,
  });
};
