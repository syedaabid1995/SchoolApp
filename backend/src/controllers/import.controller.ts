import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { importRequestSchema } from '../validations/import.validation';
import { importQueue } from '../queues';
import { enforceLimits } from '../services/subscription.service';

const uploadRoot = path.join(process.cwd(), 'uploads', 'imports');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadRoot, { recursive: true });
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = crypto.randomUUID();
    cb(null, `${id}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.csv', '.xlsx'].includes(ext)) {
    cb(new Error('Unsupported file type'));
    return;
  }
  cb(null, true);
};

export const uploadMiddleware = multer({ storage, fileFilter }).single('file');

export const createImport = async (req: Request, res: Response) => {
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

  const importJob = await prisma.importJob.create({
    data: {
      schoolId,
      createdById: auth.userId,
      type: payload.type,
      status: 'QUEUED',
      filePath: req.file.path,
      originalName: req.file.originalname,
      dryRun: payload.dryRun ?? false,
    },
  });

  await importQueue.add(
    'process',
    { importJobId: importJob.id },
    { jobId: importJob.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  );

  res.status(202).json(importJob);
};

export const listImports = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);

  const imports = await prisma.importJob.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(imports);
};

export const getImport = async (req: Request, res: Response) => {
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const importJob = await prisma.importJob.findFirst({
    where: { id, schoolId },
    include: { errors: true },
  });

  if (!importJob) {
    throw new HttpError(404, 'Import job not found');
  }

  res.status(200).json(importJob);
};

export const listImportErrors = async (req: Request, res: Response) => {
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
