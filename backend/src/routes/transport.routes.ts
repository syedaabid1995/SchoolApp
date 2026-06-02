import { Router } from 'express';
import {
  assignVehiclesToRoute,
  createTransportRoute,
  createTransportVehicle,
  deleteTransportAssignment,
  deleteTransportRoute,
  deleteTransportVehicle,
  getStudentTransportReport,
  listTransportAssignments,
  listTransportRoutes,
  listTransportVehicles,
  updateTransportAssignment,
  updateTransportRoute,
  updateTransportVehicle,
} from '../controllers/transport.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const transportRouter = Router();

transportRouter.use(authMiddleware);

transportRouter.get('/report', getStudentTransportReport);

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
