import { api } from '../lib/api';

export type GradeScaleItem = {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  status: 'PASS' | 'FAIL';
};

export type FailCriteria = {
  overallPercentage: number;
  subjectPercentage: number;
  minimumFailedSubjects: number;
};

export type ExamGradingSettings = {
  gradeScale: GradeScaleItem[];
  failCriteria: FailCriteria;
  recalculatedMarks?: number;
};

const isExamListParams = (value: unknown): value is { schoolId?: string } => {
  return Boolean(value && typeof value === 'object' && ('schoolId' in value));
};

export const listExams = async (params?: { schoolId?: string } | unknown) => {
  const requestParams = isExamListParams(params) ? params : undefined;
  const { data } = await api.get('/exams', { params: requestParams });
  return data;
};

export const getExamGradingSettings = async () => {
  const { data } = await api.get<ExamGradingSettings>('/exams/grading-settings');
  return data;
};

export const updateExamGradingSettings = async (payload: ExamGradingSettings) => {
  const { data } = await api.put<ExamGradingSettings>('/exams/grading-settings', payload);
  return data;
};

export const getExam = async (id: string) => {
  const { data } = await api.get(`/exams/${id}`);
  return data;
};

export const createExam = async (payload: {
  name?: string;
  type: string;
  subjectIds?: string[];
  subjectMappings?: Array<{ subjectId: string; maxMarks: number; passMarks: number; scheduledAt: string }>;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  scheduledAt?: string;
  resultPublishAt?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
}) => {
  const { data } = await api.post('/exams', payload);
  return data;
};

export const uploadMarks = async (payload: {
  examPaperId: string;
  marks: Array<{ studentId: string; score: number }>;
  status?: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
}) => {
  const { data } = await api.post('/exams/marks/upload', {
    examPaperId: payload.examPaperId,
    status: payload.status,
    entries: payload.marks.map((entry) => ({ studentId: entry.studentId, marks: entry.score })),
  });
  return data;
};

export const listMarks = async (params: { examPaperId: string }) => {
  const { data } = await api.get('/exams/marks', { params });
  return data;
};

export const downloadTermReport = async (params: { studentId: string; termId: string }) => {
  const { data } = await api.get('/reports/term', { params, responseType: 'blob' });
  return data;
};

export const downloadAnnualReport = async (params: { studentId: string; academicYearId: string }) => {
  const { data } = await api.get('/reports/annual', { params, responseType: 'blob' });
  return data;
};

export const downloadRankCard = async (params: { studentId: string; termId: string }) => {
  const { data } = await api.get('/reports/rank', { params, responseType: 'blob' });
  return data;
};

export type ExamCenter = {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  address: string;
  contactPerson?: string | null;
  phone?: string | null;
  isActive: boolean;
  _count?: { rooms: number };
};

export type ExamRoom = {
  id: string;
  schoolId: string;
  centerId: string;
  name: string;
  code: string;
  floor?: string | null;
  capacity: number;
  rows: number;
  columns: number;
  isActive: boolean;
  center?: ExamCenter;
};

export type ExamSeatingAllocation = {
  id: string;
  studentId: string;
  roomId: string;
  centerId: string;
  seatRow: number;
  seatColumn: number;
  seatNumber: string;
  center: ExamCenter;
  room: ExamRoom;
  student: { id: string; admissionNo: string; rollNo?: string | null; fullName: string; class?: { name: string } | null; section?: { name: string } | null };
};

export const listExamCenters = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<ExamCenter[]>('/exams/centers', { params });
  return data;
};

export const createExamCenter = async (payload: Partial<ExamCenter>) => {
  const { data } = await api.post<ExamCenter>('/exams/centers', payload);
  return data;
};

export const updateExamCenter = async (id: string, payload: Partial<ExamCenter>) => {
  const { data } = await api.patch<ExamCenter>(`/exams/centers/${id}`, payload);
  return data;
};

export const deleteExamCenter = async (id: string) => {
  await api.delete(`/exams/centers/${id}`);
};

export const listExamRooms = async (params?: { schoolId?: string; centerId?: string }) => {
  const { data } = await api.get<ExamRoom[]>('/exams/rooms', { params });
  return data;
};

export const createExamRoom = async (payload: Partial<ExamRoom>) => {
  const { data } = await api.post<ExamRoom>('/exams/rooms', payload);
  return data;
};

export const updateExamRoom = async (id: string, payload: Partial<ExamRoom>) => {
  const { data } = await api.patch<ExamRoom>(`/exams/rooms/${id}`, payload);
  return data;
};

export const deleteExamRoom = async (id: string) => {
  await api.delete(`/exams/rooms/${id}`);
};

export const getExamSeating = async (examId: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<{ allocations: ExamSeatingAllocation[]; summary: { allocated: number; activeCapacity: number; rooms: Array<{ roomId: string; roomName: string; centerName: string; capacity: number; allocated: number }> } }>(`/exams/${examId}/seating`, { params });
  return data;
};

export const generateExamSeating = async (examId: string, payload: { classId?: string; sectionId?: string; roomIds?: string[]; force?: boolean; schoolId?: string }) => {
  const { data } = await api.post(`/exams/${examId}/seating/generate`, payload);
  return data;
};

export const clearExamSeating = async (examId: string) => {
  await api.delete(`/exams/${examId}/seating`);
};

export type ExamInvigilatorAssignment = {
  id: string;
  teacherId: string;
  center: ExamCenter;
  room: ExamRoom;
  teacher: { id: string; firstName: string; lastName: string; employeeNo?: string | null; user?: { email: string } };
};

export const listExamInvigilators = async (examId: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<ExamInvigilatorAssignment[]>(`/exams/${examId}/invigilators`, { params });
  return data;
};

export const assignExamInvigilator = async (examId: string, payload: { teacherId: string; roomId: string; schoolId?: string }) => {
  const { data } = await api.post<ExamInvigilatorAssignment>(`/exams/${examId}/invigilators/assign`, payload);
  return data;
};

export const removeExamInvigilator = async (examId: string, assignmentId: string) => {
  await api.delete(`/exams/${examId}/invigilators/${assignmentId}`);
};

export type HallTicketStudent = {
  id: string;
  admissionNo: string;
  rollNo?: string | null;
  fullName: string;
  class?: { name: string } | null;
  section?: { name: string } | null;
  examSeatingAllocations: Array<{ seatNumber: string; center: ExamCenter; room: ExamRoom }>;
};

export const listHallTickets = async (examId: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<HallTicketStudent[]>(`/exams/${examId}/hall-tickets`, { params });
  return data;
};

export const downloadHallTicket = async (examId: string, studentId: string) => {
  const { data } = await api.get(`/exams/${examId}/hall-tickets/${studentId}/pdf`, { responseType: 'blob' });
  return data as Blob;
};

export type ReportFilterKey =
  | 'schoolId'
  | 'academicYearId'
  | 'classId'
  | 'sectionId'
  | 'studentId'
  | 'teacherId'
  | 'examId'
  | 'subjectId'
  | 'fromDate'
  | 'toDate'
  | 'status';

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportCatalogItem = {
  key: string;
  title: string;
  category: string;
  description: string;
  available: boolean;
  unavailableReason?: string;
  filters: ReportFilterKey[];
  formats: Array<'json' | 'csv' | 'pdf'>;
  permission: string;
  columns: ReportColumn[];
};

export type ReportDataResponse = {
  report: ReportCatalogItem;
  rows: Array<Record<string, unknown>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ReportQueryParams = Partial<Record<ReportFilterKey, string>> & {
  page?: number;
  pageSize?: number;
};

export const listReportCatalog = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<{ reports: ReportCatalogItem[] }>('/reports/catalog', { params });
  return data.reports;
};

export const getReportData = async (reportKey: string, params?: ReportQueryParams) => {
  const { data } = await api.get<ReportDataResponse>(`/reports/${reportKey}`, { params });
  return data;
};

export const exportReportCsv = async (reportKey: string, params?: ReportQueryParams) => {
  const { data } = await api.get(`/reports/${reportKey}/export.csv`, { params, responseType: 'blob' });
  return data as Blob;
};

export const exportReportPdf = async (reportKey: string, params?: ReportQueryParams) => {
  const { data } = await api.get(`/reports/${reportKey}/export.pdf`, { params, responseType: 'blob' });
  return data as Blob;
};
