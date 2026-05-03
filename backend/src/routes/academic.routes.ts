import { Router } from 'express';
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

export const academicRouter = Router();

academicRouter.use(authMiddleware);

academicRouter.post('/academic-years', createAcademicYear);
academicRouter.get('/academic-years', listAcademicYears);
academicRouter.get('/academic-years/:id', getAcademicYear);
academicRouter.patch('/academic-years/:id', updateAcademicYear);
academicRouter.delete('/academic-years/:id', deleteAcademicYear);

academicRouter.post('/terms', createTerm);
academicRouter.get('/terms', listTerms);
academicRouter.get('/terms/:id', getTerm);
academicRouter.patch('/terms/:id', updateTerm);
academicRouter.delete('/terms/:id', deleteTerm);

academicRouter.post('/classes', createClass);
academicRouter.get('/classes', listClasses);
academicRouter.get('/classes/:id', getClass);
academicRouter.patch('/classes/:id', updateClass);
academicRouter.delete('/classes/:id', deleteClass);

academicRouter.post('/sections', createSection);
academicRouter.get('/sections', listSections);
academicRouter.get('/sections/:id', getSection);
academicRouter.patch('/sections/:id', updateSection);
academicRouter.delete('/sections/:id', deleteSection);

academicRouter.post('/subjects', createSubject);
academicRouter.get('/subjects', listSubjects);
academicRouter.get('/subjects/:id', getSubject);
academicRouter.patch('/subjects/:id', updateSubject);
academicRouter.delete('/subjects/:id', deleteSubject);

academicRouter.get('/exam-types', listExamTypes);
academicRouter.post('/exam-types', createExamType);
academicRouter.patch('/exam-types/:id', updateExamType);
academicRouter.post('/attendance-periods', createAttendancePeriod);
academicRouter.get('/attendance-periods', listAttendancePeriods);
academicRouter.delete('/attendance-periods/:id', deleteAttendancePeriod);

academicRouter.get('/attendance-mode', getAttendanceMode);
academicRouter.put('/attendance-mode', updateAttendanceMode);

academicRouter.post('/timetable/versions', createTimetableVersionApi);
academicRouter.get('/timetable/versions', listTimetableVersionsApi);
academicRouter.post('/timetable/entries/bulk', bulkUpsertTimetableEntriesApi);
academicRouter.get('/timetable/entries', listTimetableEntriesApi);
academicRouter.get('/timetable/teachers', listTimetableTeachersApi);
academicRouter.post('/timetable/versions/:id/publish', publishTimetableVersionApi);
academicRouter.get('/timetable/teacher', getTeacherTimetableApi);
