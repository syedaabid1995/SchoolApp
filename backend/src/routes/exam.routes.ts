import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
} from '../controllers/exam.controller';
import {
  createExamPaper,
  uploadMarks,
  moderateMark,
  requestRevaluation,
} from '../controllers/marks.controller';

export const examRouter = Router();

examRouter.use(authMiddleware);

examRouter.post('/', createExam);
examRouter.get('/', listExams);
examRouter.get('/:id', getExam);
examRouter.patch('/:id', updateExam);
examRouter.delete('/:id', deleteExam);

examRouter.post('/papers', createExamPaper);
examRouter.post('/marks/upload', uploadMarks);
examRouter.post('/marks/:id/moderate', moderateMark);
examRouter.post('/marks/:id/revaluation', requestRevaluation);
