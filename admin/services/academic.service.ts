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

export const deleteAcademicYear = async (id: string) => {
  const { data } = await api.delete(`/academics/academic-years/${id}`);
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

export const deleteClass = async (id: string) => {
  const { data } = await api.delete(`/academics/classes/${id}`);
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

export const deleteSection = async (id: string) => {
  const { data } = await api.delete(`/academics/sections/${id}`);
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

export const deleteSubject = async (id: string) => {
  const { data } = await api.delete(`/academics/subjects/${id}`);
  return data;
};

export const listExamTypes = async (params?: { schoolId?: string; activeOnly?: boolean }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/exam-types', { params: sanitized });
  return data;
};

export const createExamType = async (payload: {
  code: string;
  name: string;
  isActive?: boolean;
  schoolId?: string;
}) => {
  const { data } = await api.post('/academics/exam-types', payload);
  return data;
};

export const updateExamType = async (id: string, payload: { name?: string; isActive?: boolean; schoolId?: string }) => {
  const { data } = await api.patch(`/academics/exam-types/${id}`, payload);
  return data;
};
