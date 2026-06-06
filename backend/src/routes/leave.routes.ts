import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations } from '../middlewares/rbac.middleware';
import {
  approveLeaveApplication,
  createLeaveApplication,
  createLeaveDefine,
  createLeaveType,
  deleteLeaveApplication,
  deleteLeaveDefine,
  deleteLeaveType,
  getLeaveApplication,
  leaveAttachmentUploadMiddleware,
  listLeaveApplications,
  listLeaveDefines,
  listLeaveTypes,
  listMyLeaveBalances,
  rejectLeaveApplication,
  updateLeaveApplication,
  updateLeaveDefine,
  updateLeaveStatus,
  updateLeaveType,
} from '../controllers/leave.controller';

export const leaveRouter = Router();

leaveRouter.use(authMiddleware);
leaveRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage school leave operations'));

leaveRouter.get('/types', listLeaveTypes);
leaveRouter.post('/types', createLeaveType);
leaveRouter.patch('/types/:id', updateLeaveType);
leaveRouter.delete('/types/:id', deleteLeaveType);

leaveRouter.get('/defines', listLeaveDefines);
leaveRouter.post('/defines', createLeaveDefine);
leaveRouter.patch('/defines/:id', updateLeaveDefine);
leaveRouter.delete('/defines/:id', deleteLeaveDefine);

leaveRouter.get('/balances/me', listMyLeaveBalances);

leaveRouter.get('/applications', listLeaveApplications);
leaveRouter.post('/applications', leaveAttachmentUploadMiddleware, createLeaveApplication);
leaveRouter.get('/applications/:id', getLeaveApplication);
leaveRouter.patch('/applications/:id', leaveAttachmentUploadMiddleware, updateLeaveApplication);
leaveRouter.delete('/applications/:id', deleteLeaveApplication);
leaveRouter.patch('/applications/:id/status', updateLeaveStatus);

// Backward-compatible aliases for the earlier P1 leave request UI/service.
leaveRouter.get('/requests', listLeaveApplications);
leaveRouter.post('/requests', leaveAttachmentUploadMiddleware, createLeaveApplication);
leaveRouter.patch('/requests/:id', leaveAttachmentUploadMiddleware, updateLeaveApplication);
leaveRouter.delete('/requests/:id', deleteLeaveApplication);
leaveRouter.patch('/requests/:id/approve', approveLeaveApplication);
leaveRouter.patch('/requests/:id/reject', rejectLeaveApplication);
