import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  downloadTermReport,
  downloadAnnualReport,
  downloadRankCard,
} from '../controllers/report.controller';

export const reportRouter = Router();

reportRouter.use(authMiddleware);

reportRouter.get('/term', downloadTermReport);
reportRouter.get('/annual', downloadAnnualReport);
reportRouter.get('/rank', downloadRankCard);
