import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { chatWithAiAssistant } from '../controllers/aiAssistant.controller';

export const aiAssistantRouter = Router();

aiAssistantRouter.use(authMiddleware);
aiAssistantRouter.post('/chat', chatWithAiAssistant);
