import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  commitImport,
  createImport,
  downloadImportTemplate,
  getImport,
  listImportTypes,
  listImports,
  listImportErrors,
  previewImport,
  uploadMiddleware,
} from '../controllers/import.controller';

export const importRouter = Router();

importRouter.use(authMiddleware);

importRouter.get('/types', listImportTypes);
importRouter.get('/templates/:type', downloadImportTemplate);
importRouter.post('/preview', uploadMiddleware, previewImport);
importRouter.post('/commit', uploadMiddleware, commitImport);
importRouter.post('/', uploadMiddleware, createImport);
importRouter.get('/', listImports);
importRouter.get('/:id', getImport);
importRouter.get('/:id/errors', listImportErrors);
