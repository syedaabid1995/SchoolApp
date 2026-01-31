import { Router } from 'express';
import {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  linkParent,
  unlinkParent,
  changeStudentStatus,
} from '../controllers/student.controller';
import {
  createParent,
  listParents,
  getParent,
  updateParent,
  deleteParent,
} from '../controllers/parent.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const studentRouter = Router();

studentRouter.use(authMiddleware);

studentRouter.post('/students', createStudent);
studentRouter.get('/students', listStudents);
studentRouter.get('/students/:id', getStudent);
studentRouter.patch('/students/:id', updateStudent);
studentRouter.post('/students/:id/parents', linkParent);
studentRouter.delete('/students/:id/parents/:parentId', unlinkParent);
studentRouter.post('/students/:id/status', changeStudentStatus);

studentRouter.post('/parents', createParent);
studentRouter.get('/parents', listParents);
studentRouter.get('/parents/:id', getParent);
studentRouter.patch('/parents/:id', updateParent);
studentRouter.delete('/parents/:id', deleteParent);
