import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { prisma } from '../config/db';
import {
  assignTeacherToClass,
  unassignTeacherFromClass,
  assignTeacherToSubject,
  unassignTeacherFromSubject,
  setTeacherActive,
} from '../services/teacherAssignment.service';

const activateSchema = z.object({
  isActive: z.boolean(),
  schoolId: z.string().uuid().optional(),
});

const classSchema = z.object({
  teacherId: z.string().uuid(),
  classId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const subjectSchema = z.object({
  teacherId: z.string().uuid(),
  subjectId: z.string().uuid(),
  schoolId: z.string().uuid().optional(),
});

const resolveActorRole = async (userId: string) => {
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { role: { select: { name: true } } },
  });
  const names = roles.map((r) => r.role.name);
  if (names.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  if (names.includes('SCHOOL_ADMIN')) return 'SCHOOL_ADMIN';
  if (names.includes('TEACHER')) return 'TEACHER';
  if (names.includes('PARENT')) return 'PARENT';
  return 'UNKNOWN';
};

export const setTeacherStatus = async (req: Request, res: Response) => {
  const payload = activateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const actorRole = await resolveActorRole(auth.userId);

  const updated = await setTeacherActive({
    schoolId,
    teacherId: req.params.teacherId,
    actorId: auth.userId,
    actorRole,
    isActive: payload.isActive,
  });

  res.status(200).json(updated);
};

export const assignClass = async (req: Request, res: Response) => {
  const payload = classSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const actorRole = await resolveActorRole(auth.userId);

  const assignment = await assignTeacherToClass({
    schoolId,
    teacherId: payload.teacherId,
    classId: payload.classId,
    actorId: auth.userId,
    actorRole,
  });

  res.status(201).json(assignment);
};

export const unassignClass = async (req: Request, res: Response) => {
  const payload = classSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const actorRole = await resolveActorRole(auth.userId);

  const result = await unassignTeacherFromClass({
    schoolId,
    teacherId: payload.teacherId,
    classId: payload.classId,
    actorId: auth.userId,
    actorRole,
  });

  res.status(200).json(result);
};

export const assignSubject = async (req: Request, res: Response) => {
  const payload = subjectSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const actorRole = await resolveActorRole(auth.userId);

  const assignment = await assignTeacherToSubject({
    schoolId,
    teacherId: payload.teacherId,
    subjectId: payload.subjectId,
    actorId: auth.userId,
    actorRole,
  });

  res.status(201).json(assignment);
};

export const unassignSubject = async (req: Request, res: Response) => {
  const payload = subjectSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) throw new HttpError(401, 'Unauthorized');
  const actorRole = await resolveActorRole(auth.userId);

  const result = await unassignTeacherFromSubject({
    schoolId,
    teacherId: payload.teacherId,
    subjectId: payload.subjectId,
    actorId: auth.userId,
    actorRole,
  });

  res.status(200).json(result);
};
