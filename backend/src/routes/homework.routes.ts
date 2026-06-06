import { Router } from 'express';
import {
  createHomework,
  deleteHomework,
  getHomeworkEvaluation,
  getHomeworkEvaluationReport,
  homeworkAttachmentUpload,
  listHomeworks,
  saveHomeworkEvaluation,
  updateHomework,
  uploadHomeworkAttachment,
} from '../controllers/homework.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations } from '../middlewares/rbac.middleware';

export const homeworkRouter = Router();

homeworkRouter.use(authMiddleware);
homeworkRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage school homework'));

homeworkRouter.post('/attachments', homeworkAttachmentUpload.single('file'), uploadHomeworkAttachment);
homeworkRouter.get('/evaluation-report', getHomeworkEvaluationReport);

homeworkRouter.get('/', listHomeworks);
homeworkRouter.post('/', createHomework);
homeworkRouter.patch('/:id', updateHomework);
homeworkRouter.delete('/:id', deleteHomework);
homeworkRouter.get('/:id/evaluations', getHomeworkEvaluation);
homeworkRouter.post('/:id/evaluations', saveHomeworkEvaluation);
