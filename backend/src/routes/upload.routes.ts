import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations, requirePermission, requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import { resolveSchoolId } from '../utils/tenant';
import { getObjectForKey, getSignedUrlForStoredUrl, uploadBuffer, verifyLocalSignedStorageUrl } from '../services/s3.service';
import { prisma } from '../config/db';
import { AuthorizationService } from '../services/authorization.service';
import { HttpError } from '../middlewares/error.middleware';
import {
  BRANDING_ASSET_MIME_TYPES,
  brandingAssetProxyUrl,
  extensionForBrandingMimeType,
  isBrandingAssetType,
  isBrandingMimeType,
  validateBrandingImage,
} from '../utils/brandingAssets';
import { isAllowedDocumentMimeType, validateUploadedDocumentFile } from '../utils/documentUploadValidation';
import { normalizeStudentDocumentFiles } from '../modules/students/utils/student-document-files';

const imageOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed'));
  }
};

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (isAllowedDocumentMimeType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported document type'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const brandingImageFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if ((BRANDING_ASSET_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('Only PNG, JPG, and WebP images are allowed'));
};

const brandingUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: brandingImageFilter,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uploadRouter = Router();

const requireValidLocalSignedStorageUrl = (req: Request, res: Response, next: NextFunction) => {
  const key = typeof req.query.key === 'string' ? req.query.key : '';
  const expires = typeof req.query.expires === 'string' ? req.query.expires : '';
  const signature = typeof req.query.signature === 'string' ? req.query.signature : '';

  if (!key || !expires || !signature || !verifyLocalSignedStorageUrl({ key, expires, signature })) {
    res.status(403).json({ error: { message: 'Invalid or expired signed URL', details: null } });
    return;
  }

  res.locals.localSignedStorageKey = key;
  next();
};

uploadRouter.get('/local-signed', requireValidLocalSignedStorageUrl, async (_req, res) => {
  const key = typeof res.locals.localSignedStorageKey === 'string' ? res.locals.localSignedStorageKey : '';

  try {
    const object = await getObjectForKey({ key });
    res.setHeader('Content-Type', object.contentType ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (object.contentLength) {
      res.setHeader('Content-Length', String(object.contentLength));
    }

    const body = object.body;
    if (body instanceof Readable) {
      body.pipe(res);
      return;
    }

    if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      res.send(Buffer.from(bytes));
      return;
    }

    res.status(404).json({ error: { message: 'Asset not found', details: null } });
  } catch {
    res.status(404).json({ error: { message: 'Asset not found', details: null } });
  }
});

uploadRouter.use(authMiddleware);

const signedAssetQuerySchema = z.object({
  type: z.enum(['student-document', 'student-photo', 'staff-document', 'staff-photo', 'school-document', 'attendance-evidence']),
  id: z.string().uuid(),
});

const assertSignedAssetPermission = async (req: Request, schoolId: string, permission: string | string[]) => {
  if (!req.auth) throw new HttpError(401, 'Unauthorized');
  if (await AuthorizationService.isSuperAdmin(req.auth)) return;
  if (req.auth.schoolId !== schoolId) throw new HttpError(403, 'Forbidden');
  if (!await AuthorizationService.hasAnyEffectivePermission(req.auth, permission)) {
    throw new HttpError(403, 'Forbidden');
  }
};

const resolveSignedAsset = async (req: Request) => {
  if (typeof req.query.key === 'string') {
    throw new HttpError(400, 'Signing raw storage keys is no longer supported');
  }

  const payload = signedAssetQuerySchema.parse({
    type: req.query.type ?? req.query.assetType,
    id: req.query.id ?? req.query.documentId ?? req.query.photoId,
  });

  if (payload.type === 'student-document') {
    const document = await prisma.studentDocument.findFirst({
      where: { id: payload.id },
      select: { schoolId: true, url: true, fileName: true, mimeType: true, sizeBytes: true, files: true },
    });
    if (!document) throw new HttpError(404, 'Asset not found');
    await assertSignedAssetPermission(req, document.schoolId, P.studentDocumentView);
    const files = normalizeStudentDocumentFiles(document);
    if (!files.length) throw new HttpError(404, 'Asset not found');
    const rawIndex = typeof req.query.fileIndex === 'string' ? Number(req.query.fileIndex) : 0;
    const index = Number.isFinite(rawIndex) ? Math.max(0, Math.floor(rawIndex)) : 0;
    return files[Math.min(index, files.length - 1)].url;
  }

  if (payload.type === 'student-photo') {
    const photo = await prisma.studentPhoto.findFirst({
      where: { id: payload.id },
      select: { url: true, student: { select: { schoolId: true } } },
    });
    if (photo) {
      await assertSignedAssetPermission(req, photo.student.schoolId, P.studentDocumentView);
      return photo.url;
    }

    const student = await prisma.student.findFirst({
      where: { id: payload.id },
      select: { schoolId: true, photoUrl: true },
    });
    if (!student?.photoUrl) throw new HttpError(404, 'Asset not found');
    await assertSignedAssetPermission(req, student.schoolId, P.studentDocumentView);
    return student.photoUrl;
  }

  if (payload.type === 'staff-document') {
    const document = await prisma.staffDocument.findFirst({
      where: { id: payload.id },
      select: { schoolId: true, fileUrl: true },
    });
    if (!document) throw new HttpError(404, 'Asset not found');
    await assertSignedAssetPermission(req, document.schoolId, P.staffDocumentView);
    return document.fileUrl;
  }

  if (payload.type === 'staff-photo') {
    const staff = await prisma.teacherProfile.findFirst({
      where: { id: payload.id },
      select: { schoolId: true, photoUrl: true },
    });
    if (!staff?.photoUrl) throw new HttpError(404, 'Asset not found');
    await assertSignedAssetPermission(req, staff.schoolId, P.staffView);
    return staff.photoUrl;
  }

  if (payload.type === 'school-document') {
    const document = await prisma.schoolDocument.findFirst({
      where: { id: payload.id },
      select: { schoolId: true, fileUrl: true },
    });
    if (!document) throw new HttpError(404, 'Asset not found');
    await assertSignedAssetPermission(req, document.schoolId, P.settingsAccess);
    return document.fileUrl;
  }

  const evidence = await prisma.attendanceEvidence.findFirst({
    where: { id: payload.id },
    select: {
      imageUrl: true,
      record: { select: { session: { select: { schoolId: true } } } },
    },
  });
  if (!evidence?.imageUrl) throw new HttpError(404, 'Asset not found');
  await assertSignedAssetPermission(req, evidence.record.session.schoolId, P.attendanceView);
  return evidence.imageUrl;
};

uploadRouter.get('/signed', requirePermission(P.studentDocumentView, P.staffDocumentView, P.staffView, P.settingsAccess, P.attendanceView), async (req, res) => {
  const storedUrl = await resolveSignedAsset(req);
  try {
    const signed = await getSignedUrlForStoredUrl({ url: storedUrl });
    res.redirect(302, signed);
  } catch {
    res.status(400).json({ error: { message: 'Asset cannot be signed', details: null } });
  }
});

const runBrandingUpload = (req: Request, res: Response, next: NextFunction) => {
  brandingUpload.single('file')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    const message =
      err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'Branding image is too large'
        : err instanceof Error
          ? err.message
          : 'Invalid branding image upload';
    res.status(400).json({ error: { message, details: null } });
  });
};

uploadRouter.post('/branding', requirePermission(P.settingsAccess), requireSchoolAdminOrSuperAdmin, runBrandingUpload, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded', details: null } });
    return;
  }

  const assetType = req.body.assetType ?? req.query.assetType;
  if (!isBrandingAssetType(assetType)) {
    res.status(400).json({ error: { message: 'Invalid branding asset type', details: null } });
    return;
  }

  if (!isBrandingMimeType(req.file.mimetype)) {
    res.status(400).json({ error: { message: 'Only PNG, JPG, and WebP images are allowed', details: null } });
    return;
  }

  const originalExt = path.extname(req.file.originalname).toLowerCase();
  const expectedExt = extensionForBrandingMimeType(req.file.mimetype);
  const validExtension =
    (req.file.mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(originalExt)) ||
    originalExt === expectedExt;
  if (!validExtension) {
    res.status(400).json({ error: { message: 'Image extension does not match the uploaded file type', details: null } });
    return;
  }

  const validation = validateBrandingImage(req.file.buffer, req.file.mimetype, assetType);
  if (!validation.valid) {
    res.status(400).json({ error: { message: validation.message, details: null } });
    return;
  }

  const requestedSchoolId = (req.body.schoolId ?? req.query.schoolId) as string | undefined;
  if (requestedSchoolId && !uuidPattern.test(requestedSchoolId)) {
    res.status(400).json({ error: { message: 'Invalid schoolId', details: null } });
    return;
  }
  const roles = await prisma.userRole.findMany({
    where: { userId: req.auth!.userId },
    select: { role: { select: { name: true } } },
  });
  const isSuperAdmin = roles.some((entry) => entry.role.name === 'SUPER_ADMIN');
  const schoolId = isSuperAdmin && !requestedSchoolId ? null : resolveSchoolId(req, requestedSchoolId);

  if (schoolId) {
    const schoolExists = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!schoolExists) {
      res.status(404).json({ error: { message: 'School not found', details: null } });
      return;
    }
  }

  const folder = schoolId ? `schools/${schoolId}` : 'platform';
  const name = `${crypto.randomUUID()}${expectedExt}`;
  const key = `branding/${folder}/${assetType}/${name}`;
  const result = await uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype });

  res.status(201).json({
    url: brandingAssetProxyUrl(result.key),
    key: result.key,
    filename: name,
    assetType,
    contentType: req.file.mimetype,
    size: req.file.size,
    dimensions: validation.dimensions,
  });
});

const blockSuperAdminDailyAssetUpload = blockSuperAdminSchoolOperations(
  'Super Admin cannot upload school daily-operation photos or documents',
);

uploadRouter.post('/photos', requirePermission(P.studentDocumentCreate, P.staffDocumentCreate), blockSuperAdminDailyAssetUpload, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded', details: null } });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const category = String(req.query.category ?? 'students');
  const studentId = req.query.studentId as string | undefined;
  const ext = path.extname(req.file.originalname);
  const name = `${crypto.randomUUID()}${ext || ''}`;
  let key = `schools/${schoolId}/${category}/${name}`;
  if (category === 'students' && studentId) {
    key = `schools/${schoolId}/students/${studentId}/${name}`;
  }
  if (category === 'documents' && studentId) {
    key = `schools/${schoolId}/documents/${studentId}/${name}`;
  }

  uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype })
    .then((result) => res.status(201).json({ url: result.url, filename: name }))
    .catch((err) => res.status(500).json({ error: { message: 'Upload failed', details: err.message } }));
});

const docUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

uploadRouter.post('/documents', requirePermission(P.studentDocumentCreate), blockSuperAdminDailyAssetUpload, docUpload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded', details: null } });
    return;
  }
  try {
    validateUploadedDocumentFile(req.file);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid document upload';
    res.status(error instanceof HttpError ? error.statusCode : 400).json({ error: { message, details: null } });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const studentId = req.query.studentId as string | undefined;
  if (!studentId) {
    res.status(400).json({ error: { message: 'studentId is required for documents', details: null } });
    return;
  }
  const ext = path.extname(req.file.originalname);
  const name = `${crypto.randomUUID()}${ext || ''}`;
  const key = `schools/${schoolId}/documents/${studentId}/${name}`;

  uploadBuffer({ key, body: req.file.buffer, contentType: req.file.mimetype })
    .then((result) => res.status(201).json({ url: result.url, filename: name }))
    .catch((err) => res.status(500).json({ error: { message: 'Upload failed', details: err.message } }));
});
