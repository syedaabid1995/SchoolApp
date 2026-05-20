import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireSchoolAdminOrSuperAdmin } from '../middlewares/rbac.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { getSignedUrlForKey, uploadBuffer, getBucketName } from '../services/s3.service';
import { prisma } from '../config/db';
import {
  BRANDING_ASSET_MIME_TYPES,
  brandingAssetProxyUrl,
  extensionForBrandingMimeType,
  isBrandingAssetType,
  isBrandingMimeType,
  validateBrandingImage,
} from '../utils/brandingAssets';

const imageOnlyFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed'));
  }
};

const documentFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  if (allowed.includes(file.mimetype)) {
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

uploadRouter.use(authMiddleware);

const isSafeStorageKey = (key: string) => {
  if (!key || key.length > 512) return false;
  if (key.startsWith('/') || key.includes('\\')) return false;
  if (key.split('/').some((part) => part === '..' || part === '')) return false;
  return /^[a-zA-Z0-9/_.,=@-]+$/.test(key);
};

uploadRouter.get('/signed', async (req, res) => {
  const rawKey = req.query.key as string | undefined;
  const bucket = (req.query.bucket as string | undefined) ?? getBucketName();
  if (!rawKey) {
    res.status(400).json({ error: { message: 'key is required', details: null } });
    return;
  }
  if (!isSafeStorageKey(rawKey)) {
    res.status(400).json({ error: { message: 'Invalid key', details: null } });
    return;
  }
  if (bucket !== getBucketName()) {
    res.status(400).json({ error: { message: 'Invalid bucket', details: null } });
    return;
  }
  const parts = rawKey.split('/');
  if (parts[0] === 'schools' && parts[1]) {
    resolveSchoolId(req, parts[1]);
  }
  try {
    const signed = await getSignedUrlForKey({ key: rawKey });
    res.redirect(302, signed);
  } catch {
    res.status(500).json({ error: { message: 'Failed to sign url', details: null } });
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

uploadRouter.post('/branding', requireSchoolAdminOrSuperAdmin, runBrandingUpload, async (req, res) => {
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

uploadRouter.post('/photos', upload.single('file'), (req, res) => {
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

uploadRouter.post('/documents', docUpload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded', details: null } });
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
