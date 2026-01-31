import { Router } from 'express';
import { login, refreshToken, logout } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/login', login);

authRouter.post('/refresh', refreshToken);

authRouter.post('/logout', logout);
