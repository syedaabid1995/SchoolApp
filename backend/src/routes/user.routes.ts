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

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', getMe);
userRouter.get('/me/assigned-students', listMyAssignedStudentsApi);
userRouter.get('/me/exam-papers', listMyExamPapersApi);
userRouter.post('/school-users', createSchoolUserApi);
userRouter.get('/employee-permissions', listEmployeePermissionsApi);
userRouter.put('/employee-permissions', updateEmployeePermissionsApi);
userRouter.get('/:id', getUserById);
