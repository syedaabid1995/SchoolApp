import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { createTeacherApi, listTeachersApi, updateTeacherApi, deleteTeacherApi, getTeacherApi } from '../controllers/teacher.controller';

export const teacherRouter = Router();

teacherRouter.use(authMiddleware);
teacherRouter.use(requireRole('SCHOOL_ADMIN'));

teacherRouter.post('/', createTeacherApi);
teacherRouter.get('/', listTeachersApi);
teacherRouter.get('/:id', getTeacherApi);
teacherRouter.patch('/:id', updateTeacherApi);
teacherRouter.delete('/:id', deleteTeacherApi);
