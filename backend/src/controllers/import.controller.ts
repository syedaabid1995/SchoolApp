import type { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { importRequestSchema } from '../validations/import.validation';
import { importQueue } from '../queues';
import { enforceLimits } from '../services/subscription.service';
import { buildRuntimeObjectKey, putRuntimeObject, sanitizeFilename } from '../services/runtimeStorage.service';

const requireSchoolAdmin = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  if (!req.auth.schoolId) {
    throw new HttpError(403, 'School scope is required to manage imports');
  }
  return req.auth;
};

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (!['.csv', '.xlsx'].includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('Unsupported file type'));
    return;
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
}).single('file');

const safeImportJob = <T extends { filePath?: string | null }>(job: T) => {
  const { filePath: _filePath, ...safeJob } = job;
  return safeJob;
};

export const createImport = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const payload = importRequestSchema.parse(req.body);
  if (!req.file) {
    throw new HttpError(400, 'file is required');
  }

  const schoolId = resolveSchoolId(req, payload.schoolId);
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, 'Unauthorized');
  }

  if (payload.type === 'STUDENT') {
    await enforceLimits(schoolId, 'students');
  }

  if (payload.type === 'TEACHER') {
    await enforceLimits(schoolId, 'teachers');
  }

  const key = buildRuntimeObjectKey({
    schoolId,
    category: 'imports',
    filename: req.file.originalname,
  });
  const uploaded = await putRuntimeObject({
    key,
    body: req.file.buffer,
    contentType: req.file.mimetype,
    metadata: {
      originalName: sanitizeFilename(req.file.originalname),
      importType: payload.type,
    },
  });

  const importJob = await prisma.importJob.create({
    data: {
      schoolId,
      createdById: auth.userId,
      type: payload.type,
      status: 'QUEUED',
      filePath: uploaded.storageRef,
      originalName: req.file.originalname,
      dryRun: payload.dryRun ?? false,
    },
  });

  await importQueue.add(
    'process',
    { importJobId: importJob.id },
    { jobId: importJob.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  );

  res.status(202).json(safeImportJob(importJob));
};

export const listImports = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const imports = await prisma.importJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(imports.map(safeImportJob));
};

export const getImport = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const importJob = await prisma.importJob.findFirst({
    where: { id, schoolId },
    include: { errors: true },
  });

  if (!importJob) {
    throw new HttpError(404, 'Import job not found');
  }

  res.status(200).json(safeImportJob(importJob));
};

export const listImportErrors = async (req: Request, res: Response) => {
  requireSchoolAdmin(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const importJob = await prisma.importJob.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!importJob) {
    throw new HttpError(404, 'Import job not found');
  }

  const errors = await prisma.importRowError.findMany({
    where: { importJobId: id },
    orderBy: { rowNumber: 'asc' },
  });

  res.status(200).json(errors);
};
