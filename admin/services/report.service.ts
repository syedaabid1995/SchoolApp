import { api } from '../lib/api';

export const listExams = async () => {
  const { data } = await api.get('/exams');
  return data;
};

export const createExam = async (payload: {
  name?: string;
  type: string;
  subjectIds: string[];
}) => {
  const { data } = await api.post('/exams', payload);
  return data;
};

export const uploadMarks = async (payload: {
  examPaperId: string;
  marks: Array<{ studentId: string; score: number }>;
}) => {
  const { data } = await api.post('/exams/marks/upload', payload);
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
