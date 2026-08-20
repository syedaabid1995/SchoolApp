import type { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { prisma } from '../config/db';
import { resolveSchoolId } from '../utils/tenant';
import { HttpError } from '../middlewares/error.middleware';
import { PermissionCodes as P, type PermissionCode } from '../permissions/permission-manifest';
import { importRequestSchema } from '../validations/import.validation';
import { importQueue } from '../queues';
import { enforceLimits } from '../services/subscription.service';
import { AuthorizationService } from '../services/authorization.service';
import { assertModuleFeatureEnabled } from '../services/feature-flag.service';
import { buildRuntimeObjectKey, putRuntimeObject, sanitizeFilename } from '../services/runtimeStorage.service';
import {
  buildImportTemplateCsv,
  importDefinitions,
  loadBufferRows,
  processImportRows,
  type BulkImportType,
} from '../services/import.service';
import {
  DEFAULT_NESTED_LIST_LIMIT,
  cursorPrismaArgs,
  parseCursorPagination,
  setCursorPaginationHeaders,
  toCursorPage,
} from '../utils/pagination';

const requireImportUser = (req: Request) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  return req.auth;
};

const permissionForImportType = (type: BulkImportType): PermissionCode => {
  switch (type) {
    case 'CLASS': return P.academicClassCreate;
    case 'SECTION': return P.academicSectionCreate;
    case 'SUBJECT': return P.academicSubjectCreate;
    case 'STUDENT': return P.studentImport;
    case 'TEACHER': return P.teachersAdd;
    case 'EXPENSE_CATEGORY': return P.expensesCategoriesCreate;
    case 'EXPENSE': return P.expensesCreate;
    default: return P.studentImport;
  }
};

const assertImportPermission = async (req: Request, type: BulkImportType) => {
  const auth = requireImportUser(req);
  if (type === 'EXPENSE' || type === 'EXPENSE_CATEGORY') {
    await assertModuleFeatureEnabled({
      key: 'module_expenses',
      schoolId: auth.schoolId ?? null,
      userId: auth.userId,
      message: 'Expenses module is disabled by the platform administrator',
    });
  }
  await AuthorizationService.assertPermission(auth, permissionForImportType(type), {
    message: 'You do not have permission to import this module',
  });
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
  requireImportUser(req);
  const payload = importRequestSchema.parse(req.body);
  await assertImportPermission(req, payload.type as BulkImportType);
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
      type: payload.type as any,
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
  requireImportUser(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const pagination = parseCursorPagination(req.query, { defaultLimit: 50, maxLimit: 100 });

  const rows = await prisma.importJob.findMany({
    where: { schoolId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorPrismaArgs(pagination),
  });
  const { data: imports, pageInfo } = toCursorPage(rows, pagination.limit);
  setCursorPaginationHeaders(res, pageInfo);

  res.status(200).json(imports.map(safeImportJob));
};

export const getImport = async (req: Request, res: Response) => {
  requireImportUser(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const importJob = await prisma.importJob.findFirst({
    where: { id, schoolId },
    include: {
      errors: { orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }], take: DEFAULT_NESTED_LIST_LIMIT },
      _count: { select: { errors: true } },
    },
  });

  if (!importJob) {
    throw new HttpError(404, 'Import job not found');
  }

  const response = safeImportJob(importJob) as Omit<typeof importJob, 'filePath'> & {
    errorPageInfo?: { limit: number; hasNextPage: boolean; nextCursor: null };
  };
  response.errorPageInfo = {
    limit: DEFAULT_NESTED_LIST_LIMIT,
    hasNextPage: importJob._count.errors > importJob.errors.length,
    nextCursor: null,
  };

  res.status(200).json(response);
};

export const listImportErrors = async (req: Request, res: Response) => {
  requireImportUser(req);
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const { id } = req.params;

  const importJob = await prisma.importJob.findFirst({
    where: { id, schoolId },
    select: { id: true },
  });

  if (!importJob) {
    throw new HttpError(404, 'Import job not found');
  }

  const pagination = parseCursorPagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const rows = await prisma.importRowError.findMany({
    where: { importJobId: id },
    orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }],
    ...cursorPrismaArgs(pagination),
  });
  const { data: errors, pageInfo } = toCursorPage(rows, pagination.limit);
  setCursorPaginationHeaders(res, pageInfo);

  res.status(200).json(errors);
};

export const listImportTypes = async (_req: Request, res: Response) => {
  res.status(200).json(importDefinitions);
};

export const downloadImportTemplate = async (req: Request, res: Response) => {
  requireImportUser(req);
  const type = importRequestSchema.shape.type.parse(req.params.type) as BulkImportType;
  await assertImportPermission(req, type);
  const csv = buildImportTemplateCsv(type);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type.toLowerCase()}-import-template.csv"`);
  res.status(200).send(csv);
};

export const previewImport = async (req: Request, res: Response) => {
  requireImportUser(req);
  const payload = importRequestSchema.pick({ type: true, schoolId: true }).parse(req.body);
  await assertImportPermission(req, payload.type as BulkImportType);
  if (!req.file) throw new HttpError(400, 'file is required');
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const rows = await loadBufferRows(req.file);
  const result = await processImportRows({
    schoolId,
    userId: req.auth?.userId,
    type: payload.type as BulkImportType,
    rows,
    dryRun: true,
  });
  res.status(200).json({ ...result, type: payload.type, dryRun: true });
};

export const commitImport = async (req: Request, res: Response) => {
  const auth = requireImportUser(req);
  const payload = importRequestSchema.pick({ type: true, schoolId: true }).parse(req.body);
  await assertImportPermission(req, payload.type as BulkImportType);
  if (!req.file) throw new HttpError(400, 'file is required');
  const schoolId = resolveSchoolId(req, payload.schoolId);
  const rows = await loadBufferRows(req.file);

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
      type: payload.type as any,
      status: 'PROCESSING',
      filePath: uploaded.storageRef,
      originalName: req.file.originalname,
      dryRun: false,
      startedAt: new Date(),
    },
  });

  try {
    const result = await processImportRows({
      schoolId,
      userId: auth.userId,
      type: payload.type as BulkImportType,
      rows,
      dryRun: false,
    });

    if (result.errors.length) {
      await prisma.importRowError.createMany({
        data: result.errors.map((err) => ({
          importJobId: importJob.id,
          rowNumber: err.rowNumber,
          field: err.field ?? null,
          message: err.message,
          rawData: (err.rawData ?? null) as any,
        })),
      });
    }

    const updated = await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: 'COMPLETED',
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        successCount: result.successCount,
        errorCount: result.failedCount,
        finishedAt: new Date(),
      },
    });

    res.status(200).json({ job: safeImportJob(updated), ...result, type: payload.type });
  } catch (err) {
    await prisma.importJob.update({
      where: { id: importJob.id },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    throw err;
  }
};
