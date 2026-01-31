import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { aiRateLimit } from '../middlewares/rate-limit.middleware';
import { aiProtection } from '../middlewares/ai-protection.middleware';
import { recognize } from '../controllers/recognition.controller';

export const recognitionRouter = Router();

recognitionRouter.use(authMiddleware);

recognitionRouter.post('/match', aiRateLimit(), aiProtection, recognize);
