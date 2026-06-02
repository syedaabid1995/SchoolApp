import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  createDormitory,
  createDormitoryRoom,
  createDormitoryRoomType,
  deleteDormitory,
  deleteDormitoryRoom,
  deleteDormitoryRoomType,
  getStudentDormitoryReport,
  listDormitories,
  listDormitoryRooms,
  listDormitoryRoomTypes,
  updateDormitory,
  updateDormitoryRoom,
  updateDormitoryRoomType,
} from '../controllers/dormitory.controller';

export const dormitoryRouter = Router();

dormitoryRouter.use(authMiddleware);

dormitoryRouter.get('/report', getStudentDormitoryReport);

dormitoryRouter.get('/room-types', listDormitoryRoomTypes);
dormitoryRouter.post('/room-types', createDormitoryRoomType);
dormitoryRouter.patch('/room-types/:id', updateDormitoryRoomType);
dormitoryRouter.delete('/room-types/:id', deleteDormitoryRoomType);

dormitoryRouter.get('/rooms', listDormitoryRooms);
dormitoryRouter.post('/rooms', createDormitoryRoom);
dormitoryRouter.patch('/rooms/:id', updateDormitoryRoom);
dormitoryRouter.delete('/rooms/:id', deleteDormitoryRoom);

dormitoryRouter.get('/', listDormitories);
dormitoryRouter.post('/', createDormitory);
dormitoryRouter.patch('/:id', updateDormitory);
dormitoryRouter.delete('/:id', deleteDormitory);
