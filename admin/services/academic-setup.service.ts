import { api } from '../lib/api';

export type SubjectType = 'THEORY' | 'PRACTICAL';
export type TimePeriodType = 'CLASS_TIME' | 'EXAM_TIME' | 'BREAK';

export type ClassSectionLink = {
  id: string;
  sectionId: string;
  section: { id: string; name: string };
};

export type AcademicClass = {
  id: string;
  name: string;
  academicYearId?: string | null;
  academicYear?: { id: string; name: string } | null;
  classSections?: ClassSectionLink[];
  _count?: {
    students?: number;
    subjects?: number;
    timetableEntries?: number;
    assignSubjects?: number;
    classTeachers?: number;
    classRoutines?: number;
  };
};

export type AcademicSection = {
  id: string;
  name: string;
  schoolId: string;
  classId?: string | null;
  classSections?: Array<{ classId: string; class?: { id: string; name: string } }>;
  _count?: { students?: number; classSections?: number };
};

export type AcademicSubject = {
  id: string;
  name: string;
  code?: string | null;
  type: SubjectType;
  _count?: { assignSubjects?: number; classRoutines?: number; examPapers?: number; timetableEntries?: number };
};

export type ClassRoom = {
  id: string;
  roomNumber: string;
  capacity: number;
  _count?: { classRoutines?: number };
};

export type TimePeriod = {
  id: string;
  type: TimePeriodType;
  name: string;
  startTime: string;
  endTime: string;
  _count?: { classRoutines?: number };
};

export type TeacherOption = {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo?: string | null;
  user?: { email?: string | null };
};

export type AssignSubject = {
  id: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null; type?: SubjectType };
  teacher?: TeacherOption;
};

export type ClassTeacher = {
  id: string;
  classId: string;
  sectionId: string;
  teacherId: string;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  teacher?: TeacherOption;
};

export type ClassRoutine = {
  id: string;
  classId: string;
  sectionId: string;
  timePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  classRoomId?: string | null;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  timePeriod?: TimePeriod;
  subject?: { id: string; name: string; code?: string | null; type?: SubjectType };
  teacher?: TeacherOption;
  classRoom?: { id: string; roomNumber: string; capacity: number } | null;
};

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export const listSetupClasses = async (params?: { search?: string }) => {
  const { data } = await api.get<AcademicClass[]>('/academic-setup/classes', { params: sanitizeParams(params) });
  return data;
};

export const createSetupClass = async (payload: { name: string; academicYearId?: string | null; sectionIds?: string[] }) => {
  const { data } = await api.post<AcademicClass>('/academic-setup/classes', payload);
  return data;
};

export const updateSetupClass = async (id: string, payload: { name?: string; academicYearId?: string | null; sectionIds?: string[] }) => {
  const { data } = await api.patch<AcademicClass>(`/academic-setup/classes/${id}`, payload);
  return data;
};

export const deleteSetupClass = async (id: string) => {
  await api.delete(`/academic-setup/classes/${id}`);
};

export const listSetupSections = async (params?: { search?: string; classId?: string }) => {
  const { data } = await api.get<AcademicSection[]>('/academic-setup/sections', { params: sanitizeParams(params) });
  return data;
};

export const createSetupSection = async (payload: { name: string }) => {
  const { data } = await api.post<AcademicSection>('/academic-setup/sections', payload);
  return data;
};

export const updateSetupSection = async (id: string, payload: { name?: string }) => {
  const { data } = await api.patch<AcademicSection>(`/academic-setup/sections/${id}`, payload);
  return data;
};

export const deleteSetupSection = async (id: string) => {
  await api.delete(`/academic-setup/sections/${id}`);
};

export const listSetupSubjects = async (params?: { search?: string }) => {
  const { data } = await api.get<AcademicSubject[]>('/academic-setup/subjects', { params: sanitizeParams(params) });
  return data;
};

export const createSetupSubject = async (payload: { name: string; code?: string | null; type: SubjectType }) => {
  const { data } = await api.post<AcademicSubject>('/academic-setup/subjects', payload);
  return data;
};

export const updateSetupSubject = async (id: string, payload: { name?: string; code?: string | null; type?: SubjectType }) => {
  const { data } = await api.patch<AcademicSubject>(`/academic-setup/subjects/${id}`, payload);
  return data;
};

export const deleteSetupSubject = async (id: string) => {
  await api.delete(`/academic-setup/subjects/${id}`);
};

export const listClassRooms = async (params?: { search?: string }) => {
  const { data } = await api.get<ClassRoom[]>('/academic-setup/rooms', { params: sanitizeParams(params) });
  return data;
};

export const createClassRoom = async (payload: { roomNumber: string; capacity: number }) => {
  const { data } = await api.post<ClassRoom>('/academic-setup/rooms', payload);
  return data;
};

export const updateClassRoom = async (id: string, payload: { roomNumber?: string; capacity?: number }) => {
  const { data } = await api.patch<ClassRoom>(`/academic-setup/rooms/${id}`, payload);
  return data;
};

export const deleteClassRoom = async (id: string) => {
  await api.delete(`/academic-setup/rooms/${id}`);
};

export const listTimePeriods = async () => {
  const { data } = await api.get<TimePeriod[]>('/academic-setup/time-periods');
  return data;
};

export const createTimePeriod = async (payload: { type: TimePeriodType; name: string; startTime: string; endTime: string }) => {
  const { data } = await api.post<TimePeriod>('/academic-setup/time-periods', payload);
  return data;
};

export const updateTimePeriod = async (id: string, payload: Partial<{ type: TimePeriodType; name: string; startTime: string; endTime: string }>) => {
  const { data } = await api.patch<TimePeriod>(`/academic-setup/time-periods/${id}`, payload);
  return data;
};

export const deleteTimePeriod = async (id: string) => {
  await api.delete(`/academic-setup/time-periods/${id}`);
};

export const listAssignSubjects = async (params?: { classId?: string; sectionId?: string }) => {
  const { data } = await api.get<AssignSubject[]>('/academic-setup/assign-subjects', { params: sanitizeParams(params) });
  return data;
};

export const saveAssignSubjects = async (payload: {
  classId: string;
  sectionId: string;
  replace?: boolean;
  assignments: Array<{ subjectId: string; teacherId: string }>;
}) => {
  const { data } = await api.post<AssignSubject[]>('/academic-setup/assign-subjects', payload);
  return data;
};

export const deleteAssignSubject = async (id: string) => {
  await api.delete(`/academic-setup/assign-subjects/${id}`);
};

export const listClassTeachers = async () => {
  const { data } = await api.get<ClassTeacher[]>('/academic-setup/class-teachers');
  return data;
};

export const saveClassTeacher = async (payload: { classId: string; sectionId: string; teacherId: string }) => {
  const { data } = await api.post<ClassTeacher>('/academic-setup/class-teachers', payload);
  return data;
};

export const updateClassTeacher = async (id: string, payload: Partial<{ classId: string; sectionId: string; teacherId: string }>) => {
  const { data } = await api.patch<ClassTeacher>(`/academic-setup/class-teachers/${id}`, payload);
  return data;
};

export const deleteClassTeacher = async (id: string) => {
  await api.delete(`/academic-setup/class-teachers/${id}`);
};

export const listClassRoutines = async (params?: { classId?: string; sectionId?: string }) => {
  const { data } = await api.get<ClassRoutine[]>('/academic-setup/routines', { params: sanitizeParams(params) });
  return data;
};

export const createClassRoutine = async (payload: {
  classId: string;
  sectionId: string;
  dayOfWeek: number;
  timePeriodId: string;
  subjectId: string;
  teacherId: string;
  classRoomId?: string | null;
}) => {
  const { data } = await api.post<ClassRoutine>('/academic-setup/routines', payload);
  return data;
};

export const updateClassRoutine = async (id: string, payload: Partial<{
  classId: string;
  sectionId: string;
  dayOfWeek: number;
  timePeriodId: string;
  subjectId: string;
  teacherId: string;
  classRoomId: string | null;
}>) => {
  const { data } = await api.patch<ClassRoutine>(`/academic-setup/routines/${id}`, payload);
  return data;
};

export const deleteClassRoutine = async (id: string) => {
  await api.delete(`/academic-setup/routines/${id}`);
};
