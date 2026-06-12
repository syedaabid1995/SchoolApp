import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../middlewares/rbac.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';
import {
  approveFace,
  enrollFace,
  getFaceProfile,
  getStudentFaceProfile,
  reEnroll,
  rejectFace,
} from '../controllers/face.controller';

export const faceRouter = Router();

faceRouter.use(authMiddleware);

faceRouter.post('/enroll', requirePermission(P.studentDocumentCreate, P.studentEdit), enrollFace);
faceRouter.post('/re-enroll', requirePermission(P.studentDocumentCreate, P.studentEdit), reEnroll);
faceRouter.post('/:id/approve', requirePermission(P.studentEdit), approveFace);
faceRouter.post('/:id/reject', requirePermission(P.studentEdit), rejectFace);
faceRouter.get('/:id', requirePermission(P.studentDocumentView, P.studentView), getFaceProfile);
faceRouter.get('/by-student/:studentId', requirePermission(P.studentDocumentView, P.studentView), getStudentFaceProfile);
