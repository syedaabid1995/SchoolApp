import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import {
  createStudent,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  linkParent,
  unlinkParent,
  changeStudentStatus,
  listTransferTargets,
  createTransferRequest,
  listIncomingTransferRequests,
  acceptTransferRequest,
  rejectTransferRequest,
  addStudentPhoto,
  deleteStudentPhoto,
  addStudentDocument,
  deleteStudentDocument,
  addStudentTimeline,
  deleteStudentTimeline,
  downloadStudentImportSample,
  importStudents,
  uploadStudentImportMiddleware,
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
import { HttpError } from '../middlewares/error.middleware';

export const studentRouter = Router();

studentRouter.use(authMiddleware);
studentRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role === 'SCHOOL_ADMIN' && req.auth.schoolId) {
    return next();
  }
  return next(new HttpError(403, 'Only School Admin can access student information'));
});

studentRouter.get('/students/import/sample', downloadStudentImportSample);
studentRouter.post('/students/import', uploadStudentImportMiddleware, importStudents);
studentRouter.post('/students', createStudent);
studentRouter.get('/students', listStudents);
studentRouter.get('/students/:id', getStudent);
studentRouter.patch('/students/:id', updateStudent);
studentRouter.delete('/students/:id', deleteStudent);
studentRouter.post('/students/:id/photos', addStudentPhoto);
studentRouter.delete('/students/:id/photos/:photoId', deleteStudentPhoto);
studentRouter.post('/students/:id/documents', addStudentDocument);
studentRouter.delete('/students/:id/documents/:documentId', deleteStudentDocument);
studentRouter.post('/students/:id/timeline', addStudentTimeline);
studentRouter.delete('/students/:id/timeline/:timelineId', deleteStudentTimeline);
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
