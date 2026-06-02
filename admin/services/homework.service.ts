import { api } from '../lib/api';

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export type HomeworkQualityStatus = 'GOOD' | 'NOT_GOOD';
export type HomeworkCompletionStatus = 'COMPLETED' | 'NOT_COMPLETED';

export type Homework = {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  homeworkDate: string;
  submissionDate: string;
  marks: string | number;
  description: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  evaluationDate?: string | null;
  class?: { id: string; name: string };
  section?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null };
  createdBy?: { id: string; email: string };
  evaluatedBy?: { id: string; email: string } | null;
  _count?: { evaluations?: number };
};

export type HomeworkEvaluation = {
  id: string;
  schoolId: string;
  homeworkId: string;
  studentId: string;
  marks?: string | number | null;
  comments?: string | null;
  qualityStatus: HomeworkQualityStatus;
  completionStatus: HomeworkCompletionStatus;
  evaluationDate: string;
  evaluatedById: string;
};

export type HomeworkEvaluationRow = {
  student: { id: string; admissionNo: string; rollNo?: string | null; fullName: string };
  evaluation?: HomeworkEvaluation | null;
};

export type HomeworkEvaluationDetail = {
  homework: Homework;
  rows: HomeworkEvaluationRow[];
};

export type HomeworkEvaluationReportRow = {
  homework: Homework;
  totalStudents: number;
  completedCount: number;
  percent: number;
};

export type HomeworkAttachmentUpload = {
  url: string;
  filename: string;
  storedFilename: string;
  contentType: string;
  size: number;
};

export const listHomeworks = async (params?: { schoolId?: string; classId?: string; sectionId?: string; subjectId?: string; search?: string }) => {
  const { data } = await api.get<Homework[]>('/homework', { params: sanitizeParams(params) });
  return data;
};

export const createHomework = async (payload: {
  schoolId?: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  homeworkDate: string;
  submissionDate: string;
  marks: number;
  description: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}) => {
  const { data } = await api.post<Homework>('/homework', payload);
  return data;
};

export const updateHomework = async (id: string, payload: Partial<{
  schoolId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  homeworkDate: string;
  submissionDate: string;
  marks: number;
  description: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
}>) => {
  const { data } = await api.patch<Homework>(`/homework/${id}`, payload);
  return data;
};

export const deleteHomework = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/homework/${id}`, { params });
};

export const getHomeworkEvaluation = async (id: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<HomeworkEvaluationDetail>(`/homework/${id}/evaluations`, { params: sanitizeParams(params) });
  return data;
};

export const saveHomeworkEvaluation = async (id: string, payload: {
  schoolId?: string;
  evaluationDate: string;
  evaluations: Array<{
    studentId: string;
    marks?: number | null;
    comments?: string | null;
    qualityStatus: HomeworkQualityStatus;
    completionStatus: HomeworkCompletionStatus;
  }>;
}) => {
  const { data } = await api.post<HomeworkEvaluationDetail>(`/homework/${id}/evaluations`, payload);
  return data;
};

export const getHomeworkEvaluationReport = async (params?: { schoolId?: string; classId?: string; sectionId?: string; subjectId?: string }) => {
  const { data } = await api.get<HomeworkEvaluationReportRow[]>('/homework/evaluation-report', { params: sanitizeParams(params) });
  return data;
};

export const uploadHomeworkAttachment = async (file: File, params?: { schoolId?: string }) => {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<HomeworkAttachmentUpload>('/homework/attachments', form, {
    params: sanitizeParams(params),
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
