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
  updateAttendancePeriod,
} from '../controllers/attendance-period.controller';
import { getAttendanceMode, updateAttendanceMode } from '../controllers/attendance-mode.controller';
import {
  bulkUpsertTimetableEntriesApi,
  createTimetableVersionApi,
  deleteTimetableEntryApi,
  generateTimetableEntriesApi,
  getTeacherTimetableApi,
  listTimetableEntriesApi,
  listTimetableTeachersApi,
  listTimetableVersionsApi,
  publishTimetableVersionApi,
  updateTimetableEntryApi,
} from '../controllers/timetable.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { HttpError } from '../middlewares/error.middleware';

export const academicRouter = Router();

academicRouter.use(authMiddleware);

const schoolScopedOnly = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth?.schoolId) {
    return next(new HttpError(403, 'School scope is required to manage academic setup'));
  }
  return next();
};

academicRouter.post('/academic-years', schoolScopedOnly, createAcademicYear);
academicRouter.get('/academic-years', listAcademicYears);
academicRouter.get('/academic-years/:id', getAcademicYear);
academicRouter.patch('/academic-years/:id', schoolScopedOnly, updateAcademicYear);
academicRouter.delete('/academic-years/:id', schoolScopedOnly, deleteAcademicYear);

academicRouter.post('/terms', schoolScopedOnly, createTerm);
academicRouter.get('/terms', listTerms);
academicRouter.get('/terms/:id', getTerm);
academicRouter.patch('/terms/:id', schoolScopedOnly, updateTerm);
academicRouter.delete('/terms/:id', schoolScopedOnly, deleteTerm);

academicRouter.post('/classes', schoolScopedOnly, createClass);
academicRouter.get('/classes', listClasses);
academicRouter.get('/classes/:id', getClass);
academicRouter.patch('/classes/:id', schoolScopedOnly, updateClass);
academicRouter.delete('/classes/:id', schoolScopedOnly, deleteClass);

academicRouter.post('/sections', schoolScopedOnly, createSection);
academicRouter.get('/sections', listSections);
academicRouter.get('/sections/:id', getSection);
academicRouter.patch('/sections/:id', schoolScopedOnly, updateSection);
academicRouter.delete('/sections/:id', schoolScopedOnly, deleteSection);

academicRouter.post('/subjects', schoolScopedOnly, createSubject);
academicRouter.get('/subjects', listSubjects);
academicRouter.get('/subjects/:id', getSubject);
academicRouter.patch('/subjects/:id', schoolScopedOnly, updateSubject);
academicRouter.delete('/subjects/:id', schoolScopedOnly, deleteSubject);

academicRouter.get('/exam-types', listExamTypes);
academicRouter.post('/exam-types', schoolScopedOnly, createExamType);
academicRouter.patch('/exam-types/:id', schoolScopedOnly, updateExamType);
academicRouter.post('/attendance-periods', schoolScopedOnly, createAttendancePeriod);
academicRouter.get('/attendance-periods', listAttendancePeriods);
academicRouter.patch('/attendance-periods/:id', schoolScopedOnly, updateAttendancePeriod);
academicRouter.delete('/attendance-periods/:id', schoolScopedOnly, deleteAttendancePeriod);

academicRouter.get('/attendance-mode', getAttendanceMode);
academicRouter.put('/attendance-mode', schoolScopedOnly, updateAttendanceMode);

academicRouter.post('/timetable/versions', schoolScopedOnly, createTimetableVersionApi);
academicRouter.get('/timetable/versions', listTimetableVersionsApi);
academicRouter.post('/timetable/entries/bulk', schoolScopedOnly, bulkUpsertTimetableEntriesApi);
academicRouter.post('/timetable/entries/generate', schoolScopedOnly, generateTimetableEntriesApi);
academicRouter.get('/timetable/entries', listTimetableEntriesApi);
academicRouter.patch('/timetable/entries/:id', schoolScopedOnly, updateTimetableEntryApi);
academicRouter.delete('/timetable/entries/:id', schoolScopedOnly, deleteTimetableEntryApi);
academicRouter.get('/timetable/teachers', listTimetableTeachersApi);
academicRouter.post('/timetable/versions/:id/publish', schoolScopedOnly, publishTimetableVersionApi);
academicRouter.get('/timetable/teacher', getTeacherTimetableApi);
