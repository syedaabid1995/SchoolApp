import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createImport,
  getImport,
  listImports,
  listImportErrors,
  uploadMiddleware,
} from '../controllers/import.controller';

export const importRouter = Router();

importRouter.use(authMiddleware);

importRouter.post('/', uploadMiddleware, createImport);
importRouter.get('/', listImports);
importRouter.get('/:id', getImport);
importRouter.get('/:id/errors', listImportErrors);
