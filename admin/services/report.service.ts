import { api } from '../lib/api';

export const listExams = async () => {
  const { data } = await api.get('/exams');
  return data;
};

export const getExam = async (id: string) => {
  const { data } = await api.get(`/exams/${id}`);
  return data;
};

export const createExam = async (payload: {
  name?: string;
  type: string;
  subjectIds: string[];
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  scheduledAt?: string;
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
