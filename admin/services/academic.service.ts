import { api } from '../lib/api';

export const listAcademicYears = async (params?: { schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/academic-years', { params: sanitized });
  return data;
};

export const createAcademicYear = async (payload: { name: string; startDate: string; endDate: string; isActive?: boolean; schoolId?: string }) => {
  const { data } = await api.post('/academics/academic-years', payload);
  return data;
};

export const listClasses = async (params?: { schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/classes', { params: sanitized });
  return data;
};

export const createClass = async (payload: { name: string; academicYearId: string; schoolId?: string }) => {
  const { data } = await api.post('/academics/classes', payload);
  return data;
};

export const listSections = async (params?: { schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/sections', { params: sanitized });
  return data;
};

export const createSection = async (payload: { name: string; classId: string; schoolId?: string }) => {
  const { data } = await api.post('/academics/sections', payload);
  return data;
};

export const listSubjects = async (params?: { schoolId?: string }) => {
  const sanitized =
    params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/subjects', { params: sanitized });
  return data;
};

export const createSubject = async (payload: {
  name: string;
  classId?: string;
  academicYearId?: string;
  teacherId?: string;
  schoolId?: string;
}) => {
  const { data } = await api.post('/academics/subjects', payload);
  return data;
};
