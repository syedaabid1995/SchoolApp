import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { authMiddleware } from '../middlewares/auth.middleware';
import { resolveSchoolId } from '../utils/tenant';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
      const category = String(req.query.category ?? 'students');
      const studentId = req.query.studentId as string | undefined;
      let targetDir = path.join(uploadDir, `school_${schoolId}`, category);
      if (category === 'documents' && studentId) {
        targetDir = path.join(uploadDir, `school_${schoolId}`, 'documents', studentId);
      }
      if (category === 'students' && studentId) {
        targetDir = path.join(uploadDir, `school_${schoolId}`, 'students', studentId);
      }
      ensureDir(targetDir);
      cb(null, targetDir);
    } catch (err) {
      cb(err as Error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${crypto.randomUUID()}${ext || ''}`;
    cb(null, name);
  },
});

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
  storage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadRouter = Router();

uploadRouter.use(authMiddleware);

uploadRouter.post('/photos', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No file uploaded', details: null } });
    return;
  }
  const schoolId = resolveSchoolId(req, req.query.schoolId as string | undefined);
  const category = String(req.query.category ?? 'students');
  const studentId = req.query.studentId as string | undefined;
  const url =
    category === 'students' && studentId
      ? `/uploads/school_${schoolId}/students/${studentId}/${req.file.filename}`
      : `/uploads/school_${schoolId}/${category}/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename });
});

const docUpload = multer({
  storage,
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
  const url = `/uploads/school_${schoolId}/documents/${studentId}/${req.file.filename}`;
  res.status(201).json({ url, filename: req.file.filename });
});
