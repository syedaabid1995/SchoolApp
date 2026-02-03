import { Router } from 'express';
import { createSchoolUserApi, getMe, getUserById } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', getMe);
userRouter.post('/school-users', requireRole('SCHOOL_ADMIN'), createSchoolUserApi);
userRouter.get('/:id', getUserById);
