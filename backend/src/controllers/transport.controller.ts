import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';
import { logAudit } from '../utils/audit';

const uuidSchema = z.string().uuid();

const normalizeText = (value: string) => value.trim().replace(/\s+/g, ' ');
const nullableText = (value?: string | null) => {
  const normalized = value?.trim().replace(/\s+/g, ' ');
  return normalized || null;
};

const getRequestedSchoolId = (req: Request, bodySchoolId?: string | null) =>
  bodySchoolId ?? (typeof req.query.schoolId === 'string' ? req.query.schoolId : undefined);

const requireTransportManager = (req: Request, requestedSchoolId?: string | null) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');

  if (req.auth.role === 'SCHOOL_ADMIN' && req.auth.schoolId) {
    if (requestedSchoolId && requestedSchoolId !== req.auth.schoolId) {
      throw new HttpError(403, 'Tenant scope violation');
    }
    return { schoolId: req.auth.schoolId, userId: req.auth.userId };
  }

  if (req.auth.role === 'SUPER_ADMIN') {
    if (!requestedSchoolId) throw new HttpError(400, 'schoolId is required');
    return { schoolId: requestedSchoolId, userId: req.auth.userId };
  }

  throw new HttpError(403, 'Only school admins can manage transport');
};

const handleUniqueError = (err: unknown, message: string) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, message);
  }
  throw err;
};

const routeSchema = z.object({
  title: z.string().min(1).max(160),
  fare: z.coerce.number().min(0).max(100000000),
  schoolId: uuidSchema.optional(),
});

const vehicleSchema = z.object({
  vehicleNumber: z.string().min(1).max(80),
  vehicleModel: z.string().min(1).max(120),
  yearMade: z.coerce.number().int().min(1900).max(3000).optional().nullable(),
  driverName: z.string().min(1).max(160),
  driverLicense: z.string().min(1).max(120),
  driverContact: z.string().min(1).max(60),
  note: z.string().max(1000).optional().nullable(),
  schoolId: uuidSchema.optional(),
});

const assignmentSchema = z.object({
  routeId: uuidSchema,
  vehicleIds: z.array(uuidSchema).min(1),
  replace: z.boolean().optional(),
  schoolId: uuidSchema.optional(),
});

const assignmentUpdateSchema = z.object({
  routeId: uuidSchema.optional(),
  vehicleId: uuidSchema.optional(),
  schoolId: uuidSchema.optional(),
});

const assertRoute = async (schoolId: string, routeId: string) => {
  const found = await prisma.transportRoute.findFirst({
    where: { id: routeId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Transport route not found');
};

const assertVehicle = async (schoolId: string, vehicleId: string) => {
  const found = await prisma.transportVehicle.findFirst({
    where: { id: vehicleId, schoolId },
    select: { id: true },
  });
  if (!found) throw new HttpError(404, 'Transport vehicle not found');
};

const assertVehicles = async (schoolId: string, vehicleIds: string[]) => {
  const vehicles = await prisma.transportVehicle.findMany({
    where: { schoolId, id: { in: vehicleIds } },
    select: { id: true },
  });
  if (vehicles.length !== vehicleIds.length) {
    throw new HttpError(404, 'One or more transport vehicles were not found');
  }
};

export const listTransportRoutes = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.transportRoute.findMany({
    where: {
      schoolId,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    include: {
      _count: { select: { vehicleAssignments: true, studentAssignments: true } },
    },
    orderBy: { title: 'asc' },
  });

  res.status(200).json(items);
};

export const createTransportRoute = async (req: Request, res: Response) => {
  const payload = routeSchema.parse(req.body);
  const { schoolId } = requireTransportManager(req, payload.schoolId);

  try {
    const item = await prisma.transportRoute.create({
      data: {
        schoolId,
        title: normalizeText(payload.title),
        fare: new Prisma.Decimal(payload.fare),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'TRANSPORT_ROUTE',
      entityId: item.id,
      action: 'CREATE',
      afterState: item,
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Route title already exists for this school');
  }
};

export const updateTransportRoute = async (req: Request, res: Response) => {
  const payload = routeSchema.partial().parse(req.body);
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.transportRoute.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Transport route not found');

  try {
    const item = await prisma.transportRoute.update({
      where: { id },
      data: {
        title: payload.title === undefined ? undefined : normalizeText(payload.title),
        fare: payload.fare === undefined ? undefined : new Prisma.Decimal(payload.fare),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'TRANSPORT_ROUTE',
      entityId: id,
      action: 'UPDATE',
      beforeState: existing,
      afterState: item,
    });

    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Route title already exists for this school');
  }
};

export const deleteTransportRoute = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.transportRoute.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { vehicleAssignments: true, studentAssignments: true } } },
  });
  if (!existing) throw new HttpError(404, 'Transport route not found');
  if (existing._count.vehicleAssignments + existing._count.studentAssignments > 0) {
    throw new HttpError(409, 'Cannot delete route while vehicles or students use it');
  }

  await prisma.transportRoute.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'TRANSPORT_ROUTE', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

export const listTransportVehicles = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.transportVehicle.findMany({
    where: {
      schoolId,
      ...(search
        ? {
            OR: [
              { vehicleNumber: { contains: search, mode: 'insensitive' } },
              { vehicleModel: { contains: search, mode: 'insensitive' } },
              { driverName: { contains: search, mode: 'insensitive' } },
              { driverContact: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { routeAssignments: true, studentAssignments: true } },
    },
    orderBy: { vehicleNumber: 'asc' },
  });

  res.status(200).json(items);
};

export const createTransportVehicle = async (req: Request, res: Response) => {
  const payload = vehicleSchema.parse(req.body);
  const { schoolId } = requireTransportManager(req, payload.schoolId);

  try {
    const item = await prisma.transportVehicle.create({
      data: {
        schoolId,
        vehicleNumber: normalizeText(payload.vehicleNumber),
        vehicleModel: normalizeText(payload.vehicleModel),
        yearMade: payload.yearMade ?? null,
        driverName: normalizeText(payload.driverName),
        driverLicense: normalizeText(payload.driverLicense),
        driverContact: normalizeText(payload.driverContact),
        note: nullableText(payload.note),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'TRANSPORT_VEHICLE',
      entityId: item.id,
      action: 'CREATE',
      afterState: item,
    });

    res.status(201).json(item);
  } catch (err) {
    handleUniqueError(err, 'Vehicle number already exists for this school');
  }
};

export const updateTransportVehicle = async (req: Request, res: Response) => {
  const payload = vehicleSchema.partial().parse(req.body);
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.transportVehicle.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Transport vehicle not found');

  try {
    const item = await prisma.transportVehicle.update({
      where: { id },
      data: {
        vehicleNumber: payload.vehicleNumber === undefined ? undefined : normalizeText(payload.vehicleNumber),
        vehicleModel: payload.vehicleModel === undefined ? undefined : normalizeText(payload.vehicleModel),
        yearMade: payload.yearMade === undefined ? undefined : payload.yearMade,
        driverName: payload.driverName === undefined ? undefined : normalizeText(payload.driverName),
        driverLicense: payload.driverLicense === undefined ? undefined : normalizeText(payload.driverLicense),
        driverContact: payload.driverContact === undefined ? undefined : normalizeText(payload.driverContact),
        note: payload.note === undefined ? undefined : nullableText(payload.note),
      },
    });

    await logAudit(req, {
      schoolId,
      entityType: 'TRANSPORT_VEHICLE',
      entityId: id,
      action: 'UPDATE',
      beforeState: existing,
      afterState: item,
    });

    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Vehicle number already exists for this school');
  }
};

export const deleteTransportVehicle = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.transportVehicle.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { routeAssignments: true, studentAssignments: true } } },
  });
  if (!existing) throw new HttpError(404, 'Transport vehicle not found');
  if (existing._count.routeAssignments + existing._count.studentAssignments > 0) {
    throw new HttpError(409, 'Cannot delete vehicle while routes or students use it');
  }

  await prisma.transportVehicle.delete({ where: { id } });
  await logAudit(req, { schoolId, entityType: 'TRANSPORT_VEHICLE', entityId: id, action: 'DELETE', beforeState: existing });
  res.status(204).send();
};

export const listTransportAssignments = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  const items = await prisma.transportRouteVehicle.findMany({
    where: {
      schoolId,
      ...(search
        ? {
            OR: [
              { route: { title: { contains: search, mode: 'insensitive' } } },
              { vehicle: { vehicleNumber: { contains: search, mode: 'insensitive' } } },
              { vehicle: { driverName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      route: { select: { id: true, title: true, fare: true } },
      vehicle: {
        select: {
          id: true,
          vehicleNumber: true,
          vehicleModel: true,
          yearMade: true,
          driverName: true,
          driverLicense: true,
          driverContact: true,
        },
      },
    },
    orderBy: [{ route: { title: 'asc' } }, { vehicle: { vehicleNumber: 'asc' } }],
  });

  res.status(200).json(items);
};

export const assignVehiclesToRoute = async (req: Request, res: Response) => {
  const payload = assignmentSchema.parse(req.body);
  const { schoolId } = requireTransportManager(req, payload.schoolId);
  const vehicleIds = Array.from(new Set(payload.vehicleIds));

  await assertRoute(schoolId, payload.routeId);
  await assertVehicles(schoolId, vehicleIds);

  await prisma.$transaction(async (tx) => {
    if (payload.replace) {
      await tx.transportRouteVehicle.deleteMany({
        where: {
          schoolId,
          routeId: payload.routeId,
          vehicleId: { notIn: vehicleIds },
        },
      });
    }

    await tx.transportRouteVehicle.createMany({
      data: vehicleIds.map((vehicleId) => ({
        schoolId,
        routeId: payload.routeId,
        vehicleId,
      })),
      skipDuplicates: true,
    });
  });

  const items = await prisma.transportRouteVehicle.findMany({
    where: { schoolId, routeId: payload.routeId },
    include: {
      route: { select: { id: true, title: true, fare: true } },
      vehicle: { select: { id: true, vehicleNumber: true, vehicleModel: true, driverName: true, driverContact: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  await logAudit(req, {
    schoolId,
    entityType: 'TRANSPORT_ROUTE_VEHICLE',
    entityId: payload.routeId,
    action: 'UPSERT',
    afterState: items,
  });

  res.status(200).json(items);
};

export const updateTransportAssignment = async (req: Request, res: Response) => {
  const payload = assignmentUpdateSchema.parse(req.body);
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req, payload.schoolId));
  const id = req.params.id;

  const existing = await prisma.transportRouteVehicle.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Transport assignment not found');

  const routeId = payload.routeId ?? existing.routeId;
  const vehicleId = payload.vehicleId ?? existing.vehicleId;
  await assertRoute(schoolId, routeId);
  await assertVehicle(schoolId, vehicleId);

  try {
    const item = await prisma.transportRouteVehicle.update({
      where: { id },
      data: {
        routeId: payload.routeId ?? undefined,
        vehicleId: payload.vehicleId ?? undefined,
      },
      include: {
        route: { select: { id: true, title: true, fare: true } },
        vehicle: { select: { id: true, vehicleNumber: true, vehicleModel: true, driverName: true, driverContact: true } },
      },
    });

    res.status(200).json(item);
  } catch (err) {
    handleUniqueError(err, 'Vehicle is already assigned to this route');
  }
};

export const deleteTransportAssignment = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const id = req.params.id;

  const existing = await prisma.transportRouteVehicle.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Transport assignment not found');

  await prisma.transportRouteVehicle.delete({ where: { id } });
  res.status(204).send();
};

export const getStudentTransportReport = async (req: Request, res: Response) => {
  const { schoolId } = requireTransportManager(req, getRequestedSchoolId(req));
  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
  const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
  const routeId = typeof req.query.routeId === 'string' ? req.query.routeId : undefined;
  const vehicleId = typeof req.query.vehicleId === 'string' ? req.query.vehicleId : undefined;

  if (classId) {
    const foundClass = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
    if (!foundClass) throw new HttpError(404, 'Class not found');
  }
  if (sectionId) {
    const foundSection = await prisma.section.findFirst({ where: { id: sectionId, schoolId }, select: { id: true } });
    if (!foundSection) throw new HttpError(404, 'Section not found');
  }
  if (routeId) await assertRoute(schoolId, routeId);
  if (vehicleId) await assertVehicle(schoolId, vehicleId);

  const items = await prisma.studentTransportAssignment.findMany({
    where: {
      schoolId,
      active: true,
      ...(routeId ? { routeId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      student: {
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
    },
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          rollNo: true,
          fullName: true,
          phone: true,
          fatherName: true,
          fatherPhone: true,
          motherName: true,
          motherPhone: true,
          parentPhone: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      },
      route: { select: { id: true, title: true, fare: true } },
      vehicle: { select: { id: true, vehicleNumber: true, driverName: true, driverContact: true } },
    },
    orderBy: [{ student: { class: { name: 'asc' } } }, { student: { section: { name: 'asc' } } }, { student: { fullName: 'asc' } }],
  });

  res.status(200).json(items);
};
