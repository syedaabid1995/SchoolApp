import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HttpError } from '../middlewares/error.middleware';
import { createTeacherApi, listTeachersApi, updateTeacherApi, deleteTeacherApi, getTeacherApi } from '../controllers/teacher.controller';
import {
  confirmTeacherCredentialManualShareApi,
  getTeacherOnboardingApi,
  listTeacherOnboardingApi,
  recalculateTeacherOnboardingApi,
  resendTeacherCredentialsApi,
  updateTeacherOnboardingApi,
} from '../controllers/teacherOnboarding.controller';

export const teacherRouter = Router();

teacherRouter.use(authMiddleware);
teacherRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.schoolId) return next();
  return next(new HttpError(403, 'School scope is required to manage teachers'));
});

teacherRouter.get('/onboarding', listTeacherOnboardingApi);
teacherRouter.post('/', createTeacherApi);
teacherRouter.get('/', listTeachersApi);
teacherRouter.get('/:teacherId/onboarding', getTeacherOnboardingApi);
teacherRouter.post('/:teacherId/onboarding/recalculate', recalculateTeacherOnboardingApi);
teacherRouter.patch('/:teacherId/onboarding', updateTeacherOnboardingApi);
teacherRouter.post('/:teacherId/credentials/resend', resendTeacherCredentialsApi);
teacherRouter.post('/:teacherId/credentials/manual-share-confirm', confirmTeacherCredentialManualShareApi);
teacherRouter.get('/:id', getTeacherApi);
teacherRouter.patch('/:id', updateTeacherApi);
teacherRouter.delete('/:id', deleteTeacherApi);
