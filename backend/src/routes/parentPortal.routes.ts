import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireParentProfile } from '../middlewares/parent.middleware';
import {
  listParentChildren,
  getParentProfile,
  getParentDashboard,
  listParentExams,
  getParentResults,
  listParentSubjects,
  getParentAttendance,
  listParentNotices,
  listParentTimetable,
  listParentFees,
} from '../controllers/parentPortal.controller';

export const parentPortalRouter = Router();

parentPortalRouter.use(authMiddleware);
parentPortalRouter.use(requireParentProfile);

parentPortalRouter.get('/children', listParentChildren);
parentPortalRouter.get('/profile', getParentProfile);
parentPortalRouter.get('/dashboard', getParentDashboard);
parentPortalRouter.get('/exams', listParentExams);
parentPortalRouter.get('/results', getParentResults);
parentPortalRouter.get('/subjects', listParentSubjects);
parentPortalRouter.get('/attendance', getParentAttendance);
parentPortalRouter.get('/notices', listParentNotices);
parentPortalRouter.get('/timetable', listParentTimetable);
parentPortalRouter.get('/fees', listParentFees);
