import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  approveFace,
  enrollFace,
  getFaceProfile,
  getStudentFaceProfile,
  registerStudentFaceImagesApi,
  reEnroll,
  rejectFace,
} from '../controllers/face.controller';

export const faceRouter = Router();

const faceImageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
});

faceRouter.use(authMiddleware);

faceRouter.post('/enroll', requirePermission(P.studentDocumentCreate, P.studentEdit), enrollFace);
faceRouter.post('/re-enroll', requirePermission(P.studentDocumentCreate, P.studentEdit), reEnroll);
faceRouter.post('/students/:studentId/register', requirePermission(P.studentDocumentCreate, P.studentEdit), faceImageUpload.any(), registerStudentFaceImagesApi);
faceRouter.post('/:id/approve', requirePermission(P.studentEdit), approveFace);
faceRouter.post('/:id/reject', requirePermission(P.studentEdit), rejectFace);
faceRouter.get('/:id', requirePermission(P.studentDocumentView, P.studentView), getFaceProfile);
faceRouter.get('/by-student/:studentId', requirePermission(P.studentDocumentView, P.studentView), getStudentFaceProfile);
