import { api } from '../lib/api';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type SupportUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
};

export type SupportSchool = {
  id: string;
  name: string;
  code: string;
};

export type SupportTicketComment = {
  id: string;
  body: string;
  isInternal: boolean;
  author: SupportUser | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicket = {
  id: string;
  ticketNumber?: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string | null;
  schoolId?: string;
  school?: SupportSchool | null;
  createdBy?: SupportUser | null;
  assignedTo?: SupportUser | null;
  escalation: boolean;
  slaDueAt?: string | null;
  comments?: SupportTicketComment[];
  createdAt: string;
  updatedAt: string;
};

export type SupportTicketListParams = {
  search?: string;
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  schoolId?: string;
  assignedToId?: string;
};

const basePath = (admin = false) => (admin ? '/admin/support' : '/tickets');

const cleanParams = (params?: SupportTicketListParams) => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
};

export const listTickets = async (params?: SupportTicketListParams, options?: { admin?: boolean }) => {
  const { data } = await api.get<SupportTicket[]>(basePath(options?.admin), { params: cleanParams(params) });
  return data;
};

export const getSupportTicketById = async (id: string, options?: { admin?: boolean }) => {
  const { data } = await api.get<SupportTicket>(`${basePath(options?.admin)}/${id}`);
  return data;
};

export const createTicket = async (payload: {
  subject: string;
  description: string;
  priority?: TicketPriority;
  schoolId?: string;
}) => {
  const { data } = await api.post<SupportTicket>('/tickets', payload);
  return data;
};

export const updateTicket = async (
  id: string,
  payload: {
    status?: TicketStatus;
    priority?: TicketPriority;
    assignedToId?: string | null;
    escalation?: boolean;
  },
  options?: { admin?: boolean },
) => {
  const { data } = await api.patch<SupportTicket>(`${basePath(options?.admin)}/${id}`, payload);
  return data;
};

export const updateSupportTicketStatus = async (id: string, status: TicketStatus, options?: { admin?: boolean }) => {
  const { data } = await api.patch<SupportTicket>(`${basePath(options?.admin)}/${id}/status`, { status });
  return data;
};

export const updateSupportTicketPriority = async (
  id: string,
  priority: TicketPriority,
  options?: { admin?: boolean },
) => {
  const { data } = await api.patch<SupportTicket>(`${basePath(options?.admin)}/${id}/priority`, { priority });
  return data;
};

export const assignSupportTicket = async (id: string, assignedToId: string | null) => {
  const { data } = await api.patch<SupportTicket>(`/admin/support/${id}/assign`, { assignedToId });
  return data;
};

export const addSupportTicketComment = async (
  id: string,
  payload: { body: string; isInternal?: boolean },
  options?: { admin?: boolean },
) => {
  const { data } = await api.post<SupportTicketComment>(`${basePath(options?.admin)}/${id}/comments`, payload);
  return data;
};

export const getSupportAssignableUsers = async () => {
  const { data } = await api.get<SupportUser[]>('/admin/support/assignable-users');
  return data;
};
