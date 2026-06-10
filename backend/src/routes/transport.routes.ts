import { Router } from 'express';
import {
  assignVehiclesToRoute,
  createStudentTransportAssignment,
  createTransportRoute,
  createTransportVehicle,
  deleteStudentTransportAssignment,
  deleteTransportAssignment,
  deleteTransportRoute,
  deleteTransportVehicle,
  getStudentTransportReport,
  listStudentTransportAssignments,
  listTransportAssignments,
  listTransportDrivers,
  listTransportRoutes,
  listTransportVehicles,
  updateStudentTransportAssignment,
  updateTransportAssignment,
  updateTransportRoute,
  updateTransportVehicle,
} from '../controllers/transport.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { blockSuperAdminSchoolOperations } from '../middlewares/rbac.middleware';

export const transportRouter = Router();

transportRouter.use(authMiddleware);
transportRouter.use(blockSuperAdminSchoolOperations('Super Admin cannot manage school transport operations'));

transportRouter.get('/drivers', listTransportDrivers);
transportRouter.get('/report', getStudentTransportReport);

transportRouter.get('/student-assignments', listStudentTransportAssignments);
transportRouter.post('/student-assignments', createStudentTransportAssignment);
transportRouter.patch('/student-assignments/:id', updateStudentTransportAssignment);
transportRouter.delete('/student-assignments/:id', deleteStudentTransportAssignment);

transportRouter.get('/assignments', listTransportAssignments);
transportRouter.post('/assignments', assignVehiclesToRoute);
transportRouter.patch('/assignments/:id', updateTransportAssignment);
transportRouter.delete('/assignments/:id', deleteTransportAssignment);

transportRouter.get('/routes', listTransportRoutes);
transportRouter.post('/routes', createTransportRoute);
transportRouter.patch('/routes/:id', updateTransportRoute);
transportRouter.delete('/routes/:id', deleteTransportRoute);

transportRouter.get('/vehicles', listTransportVehicles);
transportRouter.post('/vehicles', createTransportVehicle);
transportRouter.patch('/vehicles/:id', updateTransportVehicle);
transportRouter.delete('/vehicles/:id', deleteTransportVehicle);
