import { Router } from 'express';
import {
  createSchoolUserApi,
  getMe,
  getMyTimetableApi,
  getUserById,
  listMyAssignedClassesApi,
  listMyAssignedStudentsApi,
  listMyExamPapersApi,
  listEmployeePermissionsApi,
  updateMeProfile,
  updateEmployeePermissionsApi,
} from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', getMe);
userRouter.patch('/me', updateMeProfile);
userRouter.get('/me/timetable', getMyTimetableApi);
userRouter.get('/me/assigned-classes', listMyAssignedClassesApi);
userRouter.get('/me/assigned-students', listMyAssignedStudentsApi);
userRouter.get('/me/exam-papers', listMyExamPapersApi);
userRouter.post('/school-users', createSchoolUserApi);
userRouter.get('/employee-permissions', listEmployeePermissionsApi);
userRouter.put('/employee-permissions', updateEmployeePermissionsApi);
userRouter.get('/:id', getUserById);
