import { Router } from 'express';
import {
  createSchoolUserApi,
  getMe,
  getUserById,
  listMyAssignedStudentsApi,
  listMyExamPapersApi,
  listEmployeePermissionsApi,
  updateEmployeePermissionsApi,
} from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', getMe);
userRouter.get('/me/assigned-students', listMyAssignedStudentsApi);
userRouter.get('/me/exam-papers', listMyExamPapersApi);
userRouter.post('/school-users', requireRole('SCHOOL_ADMIN'), createSchoolUserApi);
userRouter.get('/employee-permissions', requireRole('SCHOOL_ADMIN'), listEmployeePermissionsApi);
userRouter.put('/employee-permissions', requireRole('SCHOOL_ADMIN'), updateEmployeePermissionsApi);
userRouter.get('/:id', getUserById);
