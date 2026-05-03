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

export type AttendanceMode = 'DAILY' | 'PERIOD_WISE' | 'SHIFT_WISE';

export const getAttendanceMode = async (params?: { schoolId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<{ key: string; schoolId: string; mode: AttendanceMode; source: 'DEFAULT' | 'OVERRIDE'; updatedAt: string }>(
    '/academics/attendance-mode',
    { params: sanitized },
  );
  return data;
};

export const updateAttendanceMode = async (payload: { mode: AttendanceMode; schoolId?: string }) => {
  const { data } = await api.put('/academics/attendance-mode', payload);
  return data;
};

export type TimetableVersion = {
  id: string;
  schoolId: string;
  academicYearId: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  effectiveFrom: string;
  effectiveTo?: string | null;
  publishedAt?: string | null;
  _count?: { entries: number };
  academicYear?: { id: string; name: string };
};

export type TimetableEntry = {
  id: string;
  timetableVersionId: string;
  classId: string;
  sectionId?: string | null;
  attendancePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  room?: string | null;
  isActive: boolean;
  class?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  subject?: { id: string; name: string };
  teacher?: { id: string; firstName: string; lastName: string };
  period?: { id: string; name: string; startTime: string; endTime: string };
};

export const createTimetableVersion = async (payload: {
  schoolId?: string;
  academicYearId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}) => {
  const { data } = await api.post<TimetableVersion>('/academics/timetable/versions', payload);
  return data;
};

export const listTimetableVersions = async (params?: { schoolId?: string; academicYearId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<TimetableVersion[]>('/academics/timetable/versions', { params: sanitized });
  return data;
};

export const upsertTimetableEntries = async (payload: {
  schoolId?: string;
  timetableVersionId: string;
  replace?: boolean;
  entries: Array<{
    classId: string;
    sectionId?: string | null;
    attendancePeriodId: string;
    dayOfWeek: number;
    subjectId: string;
    teacherId: string;
    room?: string | null;
    isActive?: boolean;
  }>;
}) => {
  const { data } = await api.post<TimetableEntry[]>('/academics/timetable/entries/bulk', payload);
  return data;
};

export const listTimetableEntries = async (params: { schoolId?: string; timetableVersionId: string; dayOfWeek?: number }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<TimetableEntry[]>('/academics/timetable/entries', { params: sanitized });
  return data;
};

export const publishTimetableVersion = async (id: string, payload?: { schoolId?: string }) => {
  const { data } = await api.post<TimetableVersion>(`/academics/timetable/versions/${id}/publish`, payload ?? {});
  return data;
};

export const getTeacherTimetable = async (params?: { schoolId?: string; date?: string; academicYearId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get('/academics/timetable/teacher', { params: sanitized });
  return data as {
    teacher: { id: string; firstName: string; lastName: string };
    academicYear: { id: string; name: string };
    date: string;
    dayOfWeek: number;
    version: { id: string; name: string; publishedAt?: string | null } | null;
    periods: Array<{
      id: string;
      class: { id: string; name: string };
      section?: { id: string; name: string } | null;
      subject: { id: string; name: string };
      period: { id: string; name: string; startTime: string; endTime: string };
      room?: string | null;
    }>;
  };
};

export const listTimetableTeachers = async (params?: { schoolId?: string; query?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<
    Array<{ id: string; firstName: string; lastName: string; employeeNo?: string | null; user?: { email?: string } }>
  >('/academics/timetable/teachers', { params: sanitized });
  return data;
};

export const listAttendancePeriodsForAcademics = async (params?: { schoolId?: string }) => {
  const sanitized = params && (params as any).queryKey ? undefined : params;
  const { data } = await api.get<
    Array<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      lateThresholdMinutes?: number;
      earlyThresholdMinutes?: number;
    }>
  >(
    '/academics/attendance-periods',
    { params: sanitized },
  );
  return data;
};

export const createAttendancePeriodForAcademics = async (payload: {
  name: string;
  startTime: string;
  endTime: string;
  lateThresholdMinutes?: number;
  earlyThresholdMinutes?: number;
  schoolId?: string;
}) => {
  const { data } = await api.post('/academics/attendance-periods', payload);
  return data as { id: string; name: string; startTime: string; endTime: string };
};

export const deleteAttendancePeriodForAcademics = async (id: string, payload?: { schoolId?: string }) => {
  const { data } = await api.delete(`/academics/attendance-periods/${id}`, { data: payload ?? {} });
  return data;
};
