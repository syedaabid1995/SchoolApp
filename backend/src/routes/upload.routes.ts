import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.middleware';
import { resolveSchoolId } from '../utils/tenant';
import { getSignedUrlForKey, uploadBuffer, getBucketName } from '../services/s3.service';

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

export const uploadRouter = Router();

uploadRouter.get('/signed', async (req, res) => {
  const rawKey = req.query.key as string | undefined;
  const bucket = (req.query.bucket as string | undefined) ?? getBucketName();
  if (!rawKey) {
    res.status(400).json({ error: { message: 'key is required', details: null } });
    return;
  }
  if (bucket !== getBucketName()) {
    res.status(400).json({ error: { message: 'Invalid bucket', details: null } });
    return;
  }
  if (req.auth) {
    const parts = rawKey.split('/');
    if (parts[0] === 'schools' && parts[1]) {
      resolveSchoolId(req, parts[1]);
    }
  }
  try {
    const signed = await getSignedUrlForKey({ key: rawKey });
    res.redirect(302, signed);
  } catch (err) {
    res.status(500).json({ error: { message: 'Failed to sign url', details: (err as Error).message } });
  }
});

uploadRouter.use(authMiddleware);

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
