import { api } from '../lib/api';

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export type TransportRoute = {
  id: string;
  schoolId: string;
  title: string;
  fare: string | number;
  _count?: { vehicleAssignments?: number; studentAssignments?: number };
};

export type TransportVehicle = {
  id: string;
  schoolId: string;
  vehicleNumber: string;
  vehicleModel: string;
  yearMade?: number | null;
  driverName: string;
  driverLicense: string;
  driverContact: string;
  note?: string | null;
  _count?: { routeAssignments?: number; studentAssignments?: number };
};

export type TransportDriver = {
  id: string;
  employeeNo?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  emergencyMobile?: string | null;
  drivingLicense?: string | null;
  roleName?: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
};

export type TransportAssignment = {
  id: string;
  schoolId: string;
  routeId: string;
  vehicleId: string;
  route?: { id: string; title: string; fare: string | number };
  vehicle?: {
    id: string;
    vehicleNumber: string;
    vehicleModel?: string | null;
    yearMade?: number | null;
    driverName?: string | null;
    driverLicense?: string | null;
    driverContact?: string | null;
  };
};

export type StudentTransportReportRow = {
  id: string;
  routeId?: string;
  vehicleId?: string | null;
  active?: boolean;
  note?: string | null;
  student: {
    id: string;
    admissionNo: string;
    rollNo?: string | null;
    fullName: string;
    phone?: string | null;
    fatherName?: string | null;
    fatherPhone?: string | null;
    motherName?: string | null;
    motherPhone?: string | null;
    parentPhone?: string | null;
    class?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  };
  route: { id: string; title: string; fare: string | number };
  vehicle?: { id: string; vehicleNumber: string; driverName?: string | null; driverContact?: string | null } | null;
};

export type StudentTransportAssignment = StudentTransportReportRow & {
  studentId: string;
  routeId: string;
  vehicleId?: string | null;
  assignedAt?: string;
  droppedAt?: string | null;
  active: boolean;
};

export const listTransportDrivers = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<TransportDriver[]>('/transport/drivers', { params: sanitizeParams(params) });
  return data;
};

export const listTransportRoutes = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<TransportRoute[]>('/transport/routes', { params: sanitizeParams(params) });
  return data;
};

export const createTransportRoute = async (payload: { schoolId?: string; title: string; fare: number }) => {
  const { data } = await api.post<TransportRoute>('/transport/routes', payload);
  return data;
};

export const updateTransportRoute = async (id: string, payload: Partial<{ schoolId: string; title: string; fare: number }>) => {
  const { data } = await api.patch<TransportRoute>(`/transport/routes/${id}`, payload);
  return data;
};

export const deleteTransportRoute = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/transport/routes/${id}`, { params });
};

export const listTransportVehicles = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<TransportVehicle[]>('/transport/vehicles', { params: sanitizeParams(params) });
  return data;
};

export const createTransportVehicle = async (payload: {
  schoolId?: string;
  vehicleNumber: string;
  vehicleModel: string;
  yearMade?: number | null;
  driverName: string;
  driverLicense: string;
  driverContact: string;
  note?: string | null;
}) => {
  const { data } = await api.post<TransportVehicle>('/transport/vehicles', payload);
  return data;
};

export const updateTransportVehicle = async (id: string, payload: Partial<{
  schoolId: string;
  vehicleNumber: string;
  vehicleModel: string;
  yearMade: number | null;
  driverName: string;
  driverLicense: string;
  driverContact: string;
  note: string | null;
}>) => {
  const { data } = await api.patch<TransportVehicle>(`/transport/vehicles/${id}`, payload);
  return data;
};

export const deleteTransportVehicle = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/transport/vehicles/${id}`, { params });
};

export const listTransportAssignments = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<TransportAssignment[]>('/transport/assignments', { params: sanitizeParams(params) });
  return data;
};

export const assignVehiclesToRoute = async (payload: { schoolId?: string; routeId: string; vehicleIds: string[]; replace?: boolean }) => {
  const { data } = await api.post<TransportAssignment[]>('/transport/assignments', payload);
  return data;
};

export const updateTransportAssignment = async (id: string, payload: Partial<{ schoolId: string; routeId: string; vehicleId: string }>) => {
  const { data } = await api.patch<TransportAssignment>(`/transport/assignments/${id}`, payload);
  return data;
};

export const deleteTransportAssignment = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/transport/assignments/${id}`, { params });
};

export const listStudentTransportAssignments = async (params?: {
  schoolId?: string;
  classId?: string;
  sectionId?: string;
  routeId?: string;
  vehicleId?: string;
  search?: string;
  active?: 'true' | 'false' | 'all';
}) => {
  const { data } = await api.get<StudentTransportAssignment[]>('/transport/student-assignments', { params: sanitizeParams(params) });
  return data;
};

export const createStudentTransportAssignment = async (payload: {
  schoolId?: string;
  studentId: string;
  routeId: string;
  vehicleId?: string | null;
  active?: boolean;
  note?: string | null;
}) => {
  const { data } = await api.post<StudentTransportAssignment>('/transport/student-assignments', payload);
  return data;
};

export const updateStudentTransportAssignment = async (id: string, payload: Partial<{
  schoolId: string;
  studentId: string;
  routeId: string;
  vehicleId: string | null;
  active: boolean;
  note: string | null;
}>) => {
  const { data } = await api.patch<StudentTransportAssignment>(`/transport/student-assignments/${id}`, payload);
  return data;
};

export const deleteStudentTransportAssignment = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/transport/student-assignments/${id}`, { params });
};

export const getStudentTransportReport = async (params: {
  schoolId?: string;
  classId?: string;
  sectionId?: string;
  routeId?: string;
  vehicleId?: string;
}) => {
  const { data } = await api.get<StudentTransportReportRow[]>('/transport/report', { params: sanitizeParams(params) });
  return data;
};
