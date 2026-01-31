import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  setTeacherStatus,
  assignClass,
  unassignClass,
  assignSubject,
  unassignSubject,
} from '../controllers/teacherAssignment.controller';

export const teacherAssignmentRouter = Router();

teacherAssignmentRouter.use(authMiddleware);

teacherAssignmentRouter.patch('/teachers/:teacherId/status', setTeacherStatus);
teacherAssignmentRouter.post('/classes/assign', assignClass);
teacherAssignmentRouter.post('/classes/unassign', unassignClass);
teacherAssignmentRouter.post('/subjects/assign', assignSubject);
teacherAssignmentRouter.post('/subjects/unassign', unassignSubject);
