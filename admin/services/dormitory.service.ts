import { api } from '../lib/api';

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export type Dormitory = {
  id: string;
  schoolId: string;
  name: string;
  type: string;
  intake: number;
  address?: string | null;
  description?: string | null;
  _count?: { rooms?: number; assignments?: number };
};

export type DormitoryRoomType = {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  _count?: { rooms?: number };
};

export type DormitoryRoom = {
  id: string;
  schoolId: string;
  dormitoryId: string;
  roomTypeId: string;
  roomNumber: string;
  bedCount: number;
  costPerBed: string | number;
  description?: string | null;
  dormitory?: { id: string; name: string; type: string };
  roomType?: { id: string; name: string };
  _count?: { assignments?: number };
};

export type StudentDormitoryReportRow = {
  id: string;
  student: {
    id: string;
    admissionNo: string;
    rollNo?: string | null;
    fullName: string;
    phone?: string | null;
    parentPhone?: string | null;
    class?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  };
  dormitory: { id: string; name: string };
  room?: {
    id: string;
    roomNumber: string;
    bedCount: number;
    costPerBed: string | number;
    roomType?: { id: string; name: string } | null;
  } | null;
};

export const listDormitories = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<Dormitory[]>('/dormitories', { params: sanitizeParams(params) });
  return data;
};

export const createDormitory = async (payload: {
  schoolId?: string;
  name: string;
  type: string;
  intake: number;
  address?: string | null;
  description?: string | null;
}) => {
  const { data } = await api.post<Dormitory>('/dormitories', payload);
  return data;
};

export const updateDormitory = async (id: string, payload: Partial<{
  schoolId: string;
  name: string;
  type: string;
  intake: number;
  address: string | null;
  description: string | null;
}>) => {
  const { data } = await api.patch<Dormitory>(`/dormitories/${id}`, payload);
  return data;
};

export const deleteDormitory = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/dormitories/${id}`, { params });
};

export const listDormitoryRoomTypes = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<DormitoryRoomType[]>('/dormitories/room-types', { params: sanitizeParams(params) });
  return data;
};

export const createDormitoryRoomType = async (payload: { schoolId?: string; name: string; description?: string | null }) => {
  const { data } = await api.post<DormitoryRoomType>('/dormitories/room-types', payload);
  return data;
};

export const updateDormitoryRoomType = async (id: string, payload: Partial<{ schoolId: string; name: string; description: string | null }>) => {
  const { data } = await api.patch<DormitoryRoomType>(`/dormitories/room-types/${id}`, payload);
  return data;
};

export const deleteDormitoryRoomType = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/dormitories/room-types/${id}`, { params });
};

export const listDormitoryRooms = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<DormitoryRoom[]>('/dormitories/rooms', { params: sanitizeParams(params) });
  return data;
};

export const createDormitoryRoom = async (payload: {
  schoolId?: string;
  dormitoryId: string;
  roomTypeId: string;
  roomNumber: string;
  bedCount: number;
  costPerBed: number;
  description?: string | null;
}) => {
  const { data } = await api.post<DormitoryRoom>('/dormitories/rooms', payload);
  return data;
};

export const updateDormitoryRoom = async (id: string, payload: Partial<{
  schoolId: string;
  dormitoryId: string;
  roomTypeId: string;
  roomNumber: string;
  bedCount: number;
  costPerBed: number;
  description: string | null;
}>) => {
  const { data } = await api.patch<DormitoryRoom>(`/dormitories/rooms/${id}`, payload);
  return data;
};

export const deleteDormitoryRoom = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/dormitories/rooms/${id}`, { params });
};

export const getStudentDormitoryReport = async (params: {
  schoolId?: string;
  classId?: string;
  sectionId?: string;
  dormitoryId?: string;
}) => {
  const { data } = await api.get<StudentDormitoryReportRow[]>('/dormitories/report', { params: sanitizeParams(params) });
  return data;
};
