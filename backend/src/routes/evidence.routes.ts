import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { createEvidence, listEvidence } from '../controllers/evidence.controller';

export const evidenceRouter = Router();

evidenceRouter.use(authMiddleware);

evidenceRouter.post('/', createEvidence);

evidenceRouter.get('/:recordId', listEvidence);
