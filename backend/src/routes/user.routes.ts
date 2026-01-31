import { Router } from 'express';
import { getMe } from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', getMe);
