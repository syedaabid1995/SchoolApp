import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
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

faceRouter.post('/enroll', enrollFace);
faceRouter.post('/re-enroll', reEnroll);
faceRouter.post('/:id/approve', approveFace);
faceRouter.post('/:id/reject', rejectFace);
faceRouter.get('/:id', getFaceProfile);
faceRouter.get('/by-student/:studentId', getStudentFaceProfile);
