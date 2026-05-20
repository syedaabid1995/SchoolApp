import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  createAcademicYear,
  listAcademicYears,
  getAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} from '../controllers/academic-year.controller';
import {
  createTerm,
  listTerms,
  getTerm,
  updateTerm,
  deleteTerm,
} from '../controllers/term.controller';
import {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
} from '../controllers/class.controller';
import {
  createSection,
  listSections,
  getSection,
  updateSection,
  deleteSection,
} from '../controllers/section.controller';
import {
  createSubject,
  listSubjects,
  getSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subject.controller';
import { createExamType, listExamTypes, updateExamType } from '../controllers/exam-type.controller';
import {
  createAttendancePeriod,
  deleteAttendancePeriod,
  listAttendancePeriods,
} from '../controllers/attendance-period.controller';
import { getAttendanceMode, updateAttendanceMode } from '../controllers/attendance-mode.controller';
import {
  bulkUpsertTimetableEntriesApi,
  createTimetableVersionApi,
  getTeacherTimetableApi,
  listTimetableEntriesApi,
  listTimetableTeachersApi,
  listTimetableVersionsApi,
  publishTimetableVersionApi,
} from '../controllers/timetable.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HttpError } from '../middlewares/error.middleware';

export const academicRouter = Router();

academicRouter.use(authMiddleware);

const schoolAdminOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (req.auth?.role !== 'SCHOOL_ADMIN' || !req.auth.schoolId) {
    return next(new HttpError(403, 'Only School Admin can manage academic setup'));
  }
  return next();
};

academicRouter.post('/academic-years', schoolAdminOnly, createAcademicYear);
academicRouter.get('/academic-years', listAcademicYears);
academicRouter.get('/academic-years/:id', getAcademicYear);
academicRouter.patch('/academic-years/:id', schoolAdminOnly, updateAcademicYear);
academicRouter.delete('/academic-years/:id', schoolAdminOnly, deleteAcademicYear);

academicRouter.post('/terms', schoolAdminOnly, createTerm);
academicRouter.get('/terms', listTerms);
academicRouter.get('/terms/:id', getTerm);
academicRouter.patch('/terms/:id', schoolAdminOnly, updateTerm);
academicRouter.delete('/terms/:id', schoolAdminOnly, deleteTerm);

academicRouter.post('/classes', schoolAdminOnly, createClass);
academicRouter.get('/classes', listClasses);
academicRouter.get('/classes/:id', getClass);
academicRouter.patch('/classes/:id', schoolAdminOnly, updateClass);
academicRouter.delete('/classes/:id', schoolAdminOnly, deleteClass);

academicRouter.post('/sections', schoolAdminOnly, createSection);
academicRouter.get('/sections', listSections);
academicRouter.get('/sections/:id', getSection);
academicRouter.patch('/sections/:id', schoolAdminOnly, updateSection);
academicRouter.delete('/sections/:id', schoolAdminOnly, deleteSection);

academicRouter.post('/subjects', schoolAdminOnly, createSubject);
academicRouter.get('/subjects', listSubjects);
academicRouter.get('/subjects/:id', getSubject);
academicRouter.patch('/subjects/:id', schoolAdminOnly, updateSubject);
academicRouter.delete('/subjects/:id', schoolAdminOnly, deleteSubject);

academicRouter.get('/exam-types', listExamTypes);
academicRouter.post('/exam-types', schoolAdminOnly, createExamType);
academicRouter.patch('/exam-types/:id', schoolAdminOnly, updateExamType);
academicRouter.post('/attendance-periods', schoolAdminOnly, createAttendancePeriod);
academicRouter.get('/attendance-periods', listAttendancePeriods);
academicRouter.delete('/attendance-periods/:id', schoolAdminOnly, deleteAttendancePeriod);

academicRouter.get('/attendance-mode', getAttendanceMode);
academicRouter.put('/attendance-mode', schoolAdminOnly, updateAttendanceMode);

academicRouter.post('/timetable/versions', schoolAdminOnly, createTimetableVersionApi);
academicRouter.get('/timetable/versions', listTimetableVersionsApi);
academicRouter.post('/timetable/entries/bulk', schoolAdminOnly, bulkUpsertTimetableEntriesApi);
academicRouter.get('/timetable/entries', listTimetableEntriesApi);
academicRouter.get('/timetable/teachers', listTimetableTeachersApi);
academicRouter.post('/timetable/versions/:id/publish', schoolAdminOnly, publishTimetableVersionApi);
academicRouter.get('/timetable/teacher', getTeacherTimetableApi);
