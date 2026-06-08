import type { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { handleAiAssistantChat } from '../services/aiAssistant.service';

export const chatWithAiAssistant = async (req: Request, res: Response) => {
  if (!req.auth?.userId) throw new HttpError(401, 'Unauthorized');
  const result = await handleAiAssistantChat(
    {
      auth: req.auth,
      role: req.auth.role ?? null,
      schoolId: req.auth.schoolId ?? null,
      userId: req.auth.userId,
    },
    req.body,
  );
  res.status(200).json(result);
};
