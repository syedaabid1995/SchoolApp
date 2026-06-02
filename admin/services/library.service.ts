import { api } from '../lib/api';

const sanitizeParams = <T>(params?: T) => (params && (params as any).queryKey ? undefined : params);

export type LibraryMemberType = 'STUDENT' | 'TEACHER' | 'STAFF';
export type LibraryIssueStatus = 'ISSUED' | 'RETURNED';

export type LibraryBookCategory = {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  _count?: { books?: number };
};

export type LibraryBook = {
  id: string;
  schoolId: string;
  categoryId: string;
  subjectId: string;
  title: string;
  bookNumber?: string | null;
  isbnNumber?: string | null;
  publisherName?: string | null;
  authorName?: string | null;
  rackNumber?: string | null;
  quantity: number;
  price?: string | number | null;
  description?: string | null;
  category?: { id: string; name: string };
  subject?: { id: string; name: string; code?: string | null };
  issuedCount?: number;
  availableCopies?: number;
  _count?: { issues?: number };
};

export type LibraryMember = {
  id: string;
  schoolId: string;
  memberType: LibraryMemberType;
  memberCode: string;
  studentId?: string | null;
  staffId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  active: boolean;
  canceledAt?: string | null;
  _count?: { issues?: number };
};

export type LibraryIssue = {
  id: string;
  schoolId: string;
  bookId: string;
  memberId: string;
  issueDate: string;
  returnDate?: string | null;
  returnedAt?: string | null;
  status: LibraryIssueStatus;
  note?: string | null;
  book?: Pick<LibraryBook, 'id' | 'title' | 'bookNumber' | 'isbnNumber' | 'authorName' | 'publisherName' | 'quantity' | 'category' | 'subject'>;
  member?: Pick<LibraryMember, 'id' | 'memberType' | 'memberCode' | 'fullName' | 'email' | 'phone' | 'photoUrl' | 'active'>;
  createdBy?: { id: string; email: string };
  returnedBy?: { id: string; email: string } | null;
};

export const listLibraryCategories = async (params?: { schoolId?: string; search?: string }) => {
  const { data } = await api.get<LibraryBookCategory[]>('/library/categories', { params: sanitizeParams(params) });
  return data;
};

export const createLibraryCategory = async (payload: { schoolId?: string; name: string; description?: string | null }) => {
  const { data } = await api.post<LibraryBookCategory>('/library/categories', payload);
  return data;
};

export const updateLibraryCategory = async (id: string, payload: Partial<{ schoolId: string; name: string; description: string | null }>) => {
  const { data } = await api.patch<LibraryBookCategory>(`/library/categories/${id}`, payload);
  return data;
};

export const deleteLibraryCategory = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/library/categories/${id}`, { params });
};

export const listLibraryBooks = async (params?: { schoolId?: string; search?: string; categoryId?: string; subjectId?: string; bookId?: string }) => {
  const { data } = await api.get<LibraryBook[]>('/library/books', { params: sanitizeParams(params) });
  return data;
};

export const createLibraryBook = async (payload: {
  schoolId?: string;
  title: string;
  categoryId: string;
  subjectId: string;
  bookNumber?: string | null;
  isbnNumber?: string | null;
  publisherName?: string | null;
  authorName?: string | null;
  rackNumber?: string | null;
  quantity: number;
  price?: number | null;
  description?: string | null;
}) => {
  const { data } = await api.post<LibraryBook>('/library/books', payload);
  return data;
};

export const updateLibraryBook = async (id: string, payload: Partial<{
  schoolId: string;
  title: string;
  categoryId: string;
  subjectId: string;
  bookNumber: string | null;
  isbnNumber: string | null;
  publisherName: string | null;
  authorName: string | null;
  rackNumber: string | null;
  quantity: number;
  price: number | null;
  description: string | null;
}>) => {
  const { data } = await api.patch<LibraryBook>(`/library/books/${id}`, payload);
  return data;
};

export const deleteLibraryBook = async (id: string, params?: { schoolId?: string }) => {
  await api.delete(`/library/books/${id}`, { params });
};

export const listLibraryMembers = async (params?: { schoolId?: string; search?: string; active?: boolean }) => {
  const { data } = await api.get<LibraryMember[]>('/library/members', { params: sanitizeParams(params) });
  return data;
};

export const createLibraryMember = async (payload: { schoolId?: string; memberType: LibraryMemberType; memberId: string }) => {
  const { data } = await api.post<LibraryMember>('/library/members', payload);
  return data;
};

export const cancelLibraryMember = async (id: string, params?: { schoolId?: string }) => {
  const { data } = await api.delete<LibraryMember>(`/library/members/${id}`, { params });
  return data;
};

export const listMemberIssues = async (memberId: string, params?: { schoolId?: string }) => {
  const { data } = await api.get<LibraryIssue[]>(`/library/members/${memberId}/issues`, { params: sanitizeParams(params) });
  return data;
};

export const issueLibraryBook = async (memberId: string, payload: { schoolId?: string; bookId: string; returnDate?: string | null; note?: string | null }) => {
  const { data } = await api.post<LibraryIssue>(`/library/members/${memberId}/issues`, payload);
  return data;
};

export const returnLibraryBook = async (id: string, params?: { schoolId?: string }) => {
  const { data } = await api.patch<LibraryIssue>(`/library/issues/${id}/return`, undefined, { params: sanitizeParams(params) });
  return data;
};

export const listIssuedLibraryBooks = async (params?: {
  schoolId?: string;
  bookId?: string;
  bookNumber?: string;
  subjectId?: string;
  search?: string;
  status?: LibraryIssueStatus;
}) => {
  const { data } = await api.get<LibraryIssue[]>('/library/issued', { params: sanitizeParams(params) });
  return data;
};
