import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireModuleFeatureEnabled } from '../middlewares/feature-flag.middleware';
import { chatWithAiAssistant } from '../controllers/aiAssistant.controller';

export const aiAssistantRouter = Router();

aiAssistantRouter.use(authMiddleware);
aiAssistantRouter.use(requireModuleFeatureEnabled('module_ai_assistant', 'AI Assistant is disabled by the platform administrator'));
aiAssistantRouter.post('/chat', chatWithAiAssistant);
