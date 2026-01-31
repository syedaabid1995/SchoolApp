import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getJobStatus } from '../controllers/job.controller';

export const jobRouter = Router();

jobRouter.use(authMiddleware);

jobRouter.get('/:queue/:id', getJobStatus);
