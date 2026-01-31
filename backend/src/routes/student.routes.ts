import { Router } from 'express';
import {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  linkParent,
  unlinkParent,
  changeStudentStatus,
  listTransferTargets,
  createTransferRequest,
  listIncomingTransferRequests,
  acceptTransferRequest,
  rejectTransferRequest,
} from '../controllers/student.controller';
import {
  createParent,
  listParents,
  lookupParentByPhone,
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
studentRouter.get('/transfer-targets', listTransferTargets);
studentRouter.post('/students/:id/transfer-requests', createTransferRequest);
studentRouter.get('/transfer-requests', listIncomingTransferRequests);
studentRouter.post('/transfer-requests/:id/accept', acceptTransferRequest);
studentRouter.post('/transfer-requests/:id/reject', rejectTransferRequest);

studentRouter.post('/parents', createParent);
studentRouter.get('/parents', listParents);
studentRouter.get('/parents/lookup', lookupParentByPhone);
studentRouter.get('/parents/:id', getParent);
studentRouter.patch('/parents/:id', updateParent);
studentRouter.delete('/parents/:id', deleteParent);
