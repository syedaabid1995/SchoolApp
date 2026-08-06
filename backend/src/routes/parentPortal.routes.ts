import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireParentProfile } from '../middlewares/parent.middleware';
import {
  listParentChildren,
  getParentChildDetail,
  createParentLeaveRequest,
  getParentProfile,
  updateParentProfile,
  getParentDashboard,
  listParentLeaveRequests,
  listParentExams,
  getParentResults,
  listParentSubjects,
  getParentAttendance,
  listParentHomeworks,
  listParentNotices,
  listParentTimetable,
  listParentFees,
  createParentFeeCheckoutOrder,
  confirmParentFeePaymentLink,
  verifyParentFeeCheckoutPayment,
  getParentChildFile,
} from '../controllers/parentPortal.controller';

export const parentPortalRouter = Router();

parentPortalRouter.use(authMiddleware);
parentPortalRouter.use(requireParentProfile);

parentPortalRouter.get('/children', listParentChildren);
parentPortalRouter.get('/children/:childId', getParentChildDetail);
parentPortalRouter.get('/children/:childId/files', getParentChildFile);
parentPortalRouter.get('/profile', getParentProfile);
parentPortalRouter.patch('/profile', updateParentProfile);
parentPortalRouter.get('/dashboard', getParentDashboard);
parentPortalRouter.get('/leave-requests', listParentLeaveRequests);
parentPortalRouter.post('/leave-requests', createParentLeaveRequest);
parentPortalRouter.get('/exams', listParentExams);
parentPortalRouter.get('/results', getParentResults);
parentPortalRouter.get('/subjects', listParentSubjects);
parentPortalRouter.get('/attendance', getParentAttendance);
parentPortalRouter.get('/homework', listParentHomeworks);
parentPortalRouter.get('/notices', listParentNotices);
parentPortalRouter.get('/timetable', listParentTimetable);
parentPortalRouter.get('/fees', listParentFees);
parentPortalRouter.post('/fees/checkout', createParentFeeCheckoutOrder);
parentPortalRouter.post('/fees/checkout/status', confirmParentFeePaymentLink);
parentPortalRouter.post('/fees/checkout/verify', verifyParentFeeCheckoutPayment);
