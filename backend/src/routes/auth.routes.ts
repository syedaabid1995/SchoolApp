import { Router } from 'express';
import { login, refreshToken, logout, changePassword } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const authRouter = Router();

authRouter.post('/login', login);

authRouter.post('/refresh', refreshToken);

authRouter.post('/logout', logout);

authRouter.post('/change-password', authMiddleware, changePassword);
