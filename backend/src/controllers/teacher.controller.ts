import type { Request, Response } from 'express';
import { z } from 'zod';
import { resolveSchoolId } from '../utils/tenant';
import { createTeacher, listTeachers, updateTeacher } from '../services/teacher.service';
import { HttpError } from '../middlewares/error.middleware';

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  employeeNo: z.string().min(1).optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  bankDetails: z
    .object({
      accountHolderName: z.string().min(1).optional().nullable(),
      accountNumber: z.string().min(1).optional().nullable(),
      ifscCode: z.string().min(1).optional().nullable(),
      accountType: z.string().min(1).optional().nullable(),
      bankName: z.string().min(1).optional().nullable(),
      branchName: z.string().min(1).optional().nullable(),
      panNumber: z.string().min(1).optional().nullable(),
    })
    .optional(),
  schoolId: z.string().uuid().optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

const updateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  employeeNo: z.string().min(1).optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  address: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  schoolId: z.string().uuid().optional(),
});

export const createTeacherApi = async (req: Request, res: Response) => {
  const payload = createSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const teacher = await createTeacher({
    schoolId,
    email: payload.email,
    password: payload.password,
    firstName: payload.firstName,
    lastName: payload.lastName,
    employeeNo: payload.employeeNo ?? null,
    phone: payload.phone ?? null,
    address: payload.address ?? null,
    bankDetails: payload.bankDetails
      ? {
          accountHolderName: payload.bankDetails.accountHolderName ?? null,
          accountNumber: payload.bankDetails.accountNumber ?? null,
          ifscCode: payload.bankDetails.ifscCode ?? null,
          accountType: payload.bankDetails.accountType ?? null,
          bankName: payload.bankDetails.bankName ?? null,
          branchName: payload.bankDetails.branchName ?? null,
          panNumber: payload.bankDetails.panNumber ?? null,
        }
      : undefined,
  });
  res.status(201).json(teacher);
};

export const listTeachersApi = async (req: Request, res: Response) => {
  const payload = listSchema.parse(req.query);
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const result = await listTeachers({
    schoolId,
    page: payload.page,
    limit: payload.limit,
    query: payload.query,
    isActive: payload.isActive,
  });
  res.status(200).json(result);
};

export const updateTeacherApi = async (req: Request, res: Response) => {
  const payload = updateSchema.parse(req.body);
  const schoolId = resolveSchoolId(req, payload.schoolId ?? (req.query.schoolId as string | undefined));
  try {
    const updated = await updateTeacher(req.params.id, schoolId, payload);
    res.status(200).json(updated);
  } catch (err) {
    throw new HttpError(404, 'Teacher not found');
  }
};
