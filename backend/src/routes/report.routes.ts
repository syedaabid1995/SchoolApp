import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  downloadTermReport,
  downloadAnnualReport,
  downloadRankCard,
  exportReportCsvApi,
  exportReportPdfApi,
  getReportApi,
  listReportCatalogApi,
} from '../controllers/report.controller';

export const reportRouter = Router();

reportRouter.use(authMiddleware);

reportRouter.get('/term', downloadTermReport);
reportRouter.get('/annual', downloadAnnualReport);
reportRouter.get('/rank', downloadRankCard);
reportRouter.get('/catalog', listReportCatalogApi);
reportRouter.get('/:reportKey/export.csv', exportReportCsvApi);
reportRouter.get('/:reportKey/export.pdf', exportReportPdfApi);
reportRouter.get('/:reportKey', getReportApi);
