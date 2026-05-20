import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createClassRoom,
  createClassRoutine,
  createSetupClass,
  createSetupSection,
  createSetupSubject,
  createTimePeriod,
  deleteAssignSubject,
  deleteClassRoom,
  deleteClassRoutine,
  deleteClassTeacher,
  deleteSetupClass,
  deleteSetupSection,
  deleteSetupSubject,
  deleteTimePeriod,
  listAssignSubjects,
  listClassRooms,
  listClassRoutines,
  listClassTeachers,
  listSetupClasses,
  listSetupSections,
  listSetupSubjects,
  listTimePeriods,
  saveAssignSubjects,
  saveClassTeacher,
  updateClassRoom,
  updateClassRoutine,
  updateClassTeacher,
  updateSetupClass,
  updateSetupSection,
  updateSetupSubject,
  updateTimePeriod,
} from '../controllers/academicSetup.controller';

export const academicSetupRouter = Router();

academicSetupRouter.use(authMiddleware);

academicSetupRouter.get('/classes', listSetupClasses);
academicSetupRouter.post('/classes', createSetupClass);
academicSetupRouter.patch('/classes/:id', updateSetupClass);
academicSetupRouter.delete('/classes/:id', deleteSetupClass);

academicSetupRouter.get('/sections', listSetupSections);
academicSetupRouter.post('/sections', createSetupSection);
academicSetupRouter.patch('/sections/:id', updateSetupSection);
academicSetupRouter.delete('/sections/:id', deleteSetupSection);

academicSetupRouter.get('/subjects', listSetupSubjects);
academicSetupRouter.post('/subjects', createSetupSubject);
academicSetupRouter.patch('/subjects/:id', updateSetupSubject);
academicSetupRouter.delete('/subjects/:id', deleteSetupSubject);

academicSetupRouter.get('/rooms', listClassRooms);
academicSetupRouter.post('/rooms', createClassRoom);
academicSetupRouter.patch('/rooms/:id', updateClassRoom);
academicSetupRouter.delete('/rooms/:id', deleteClassRoom);

academicSetupRouter.get('/time-periods', listTimePeriods);
academicSetupRouter.post('/time-periods', createTimePeriod);
academicSetupRouter.patch('/time-periods/:id', updateTimePeriod);
academicSetupRouter.delete('/time-periods/:id', deleteTimePeriod);

academicSetupRouter.get('/assign-subjects', listAssignSubjects);
academicSetupRouter.post('/assign-subjects', saveAssignSubjects);
academicSetupRouter.delete('/assign-subjects/:id', deleteAssignSubject);

academicSetupRouter.get('/class-teachers', listClassTeachers);
academicSetupRouter.post('/class-teachers', saveClassTeacher);
academicSetupRouter.patch('/class-teachers/:id', updateClassTeacher);
academicSetupRouter.delete('/class-teachers/:id', deleteClassTeacher);

academicSetupRouter.get('/routines', listClassRoutines);
academicSetupRouter.post('/routines', createClassRoutine);
academicSetupRouter.patch('/routines/:id', updateClassRoutine);
academicSetupRouter.delete('/routines/:id', deleteClassRoutine);
