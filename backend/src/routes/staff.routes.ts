import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HttpError } from '../middlewares/error.middleware';
import {
  addStaffDocument,
  addStaffTimeline,
  createDepartment,
  createDesignation,
  createStaff,
  deleteStaff,
  deleteStaffDocument,
  deleteStaffTimeline,
  generatePayroll,
  getPayrollReport,
  getStaff,
  getStaffAttendanceReport,
  listDepartments,
  listDesignations,
  listPayroll,
  listStaff,
  loadStaffAttendance,
  payPayroll,
  saveStaffAttendance,
  seedStaffDefaults,
  updateStaff,
  uploadStaffDocumentMiddleware,
} from '../controllers/staff.controller';

export const staffRouter = Router();

staffRouter.use(authMiddleware);
staffRouter.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.schoolId) return next();
  return next(new HttpError(403, 'School scope is required to manage staff'));
});

staffRouter.get('/departments', listDepartments);
staffRouter.post('/departments', createDepartment);
staffRouter.get('/designations', listDesignations);
staffRouter.post('/designations', createDesignation);
staffRouter.post('/defaults', seedStaffDefaults);

staffRouter.get('/attendance', loadStaffAttendance);
staffRouter.post('/attendance', saveStaffAttendance);
staffRouter.get('/attendance/report', getStaffAttendanceReport);

staffRouter.get('/payroll', listPayroll);
staffRouter.post('/payroll/generate', generatePayroll);
staffRouter.get('/payroll/report', getPayrollReport);
staffRouter.post('/payroll/:id/pay', payPayroll);

staffRouter.get('/', listStaff);
staffRouter.post('/', createStaff);
staffRouter.get('/:id', getStaff);
staffRouter.patch('/:id', updateStaff);
staffRouter.delete('/:id', deleteStaff);
staffRouter.post('/:id/documents', uploadStaffDocumentMiddleware, addStaffDocument);
staffRouter.delete('/:id/documents/:documentId', deleteStaffDocument);
staffRouter.post('/:id/timeline', addStaffTimeline);
staffRouter.delete('/:id/timeline/:timelineId', deleteStaffTimeline);
