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
  listMarks,
  uploadMarks,
  moderateMark,
  requestRevaluation,
} from '../controllers/marks.controller';
import {
  getExamGradingSettingsApi,
  updateExamGradingSettingsApi,
} from '../controllers/examGrading.controller';
import {
  autoAssignExamInvigilatorsApi,
  assignExamInvigilatorApi,
  clearExamSeatingApi,
  createExamCenterApi,
  createExamRoomApi,
  deleteExamCenterApi,
  deleteExamRoomApi,
  downloadHallTicketPdfApi,
  generateExamSeatingApi,
  getExamSeatingApi,
  listExamCentersApi,
  listExamInvigilatorsApi,
  listExamRoomsApi,
  listHallTicketsApi,
  removeExamInvigilatorApi,
  updateExamCenterApi,
  updateExamRoomApi,
} from '../controllers/examOperations.controller';
import { blockSuperAdminSchoolOperations } from '../middlewares/rbac.middleware';

export const examRouter = Router();

examRouter.use(authMiddleware);
examRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage exams, marks, or hall-ticket operations inside a school'));

examRouter.post('/', createExam);
examRouter.get('/', listExams);
examRouter.get('/grading-settings', getExamGradingSettingsApi);
examRouter.put('/grading-settings', updateExamGradingSettingsApi);
examRouter.get('/marks', listMarks);
examRouter.get('/centers', listExamCentersApi);
examRouter.post('/centers', createExamCenterApi);
examRouter.patch('/centers/:centerId', updateExamCenterApi);
examRouter.delete('/centers/:centerId', deleteExamCenterApi);
examRouter.get('/rooms', listExamRoomsApi);
examRouter.post('/rooms', createExamRoomApi);
examRouter.patch('/rooms/:roomId', updateExamRoomApi);
examRouter.delete('/rooms/:roomId', deleteExamRoomApi);
examRouter.post('/:examId/seating/generate', generateExamSeatingApi);
examRouter.get('/:examId/seating', getExamSeatingApi);
examRouter.delete('/:examId/seating', clearExamSeatingApi);
examRouter.post('/:examId/invigilators/auto-assign', autoAssignExamInvigilatorsApi);
examRouter.post('/:examId/invigilators/assign', assignExamInvigilatorApi);
examRouter.get('/:examId/invigilators', listExamInvigilatorsApi);
examRouter.delete('/:examId/invigilators/:assignmentId', removeExamInvigilatorApi);
examRouter.get('/:examId/hall-tickets', listHallTicketsApi);
examRouter.get('/:examId/hall-tickets/:studentId/pdf', downloadHallTicketPdfApi);
examRouter.get('/:id', getExam);
examRouter.patch('/:id', updateExam);
examRouter.delete('/:id', deleteExam);

examRouter.post('/papers', createExamPaper);
examRouter.post('/marks/upload', uploadMarks);
examRouter.post('/marks/:id/moderate', moderateMark);
examRouter.post('/marks/:id/revaluation', requestRevaluation);
