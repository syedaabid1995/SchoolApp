import { api } from '../lib/api';

export type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  escalation: boolean;
  createdAt: string;
};

export const listTickets = async () => {
  const { data } = await api.get<SupportTicket[]>('/tickets');
  return data;
};

export const createTicket = async (payload: { subject: string; description: string; priority?: string }) => {
  const { data } = await api.post('/tickets', payload);
  return data;
};

export const updateTicket = async (id: string, payload: { status?: string; priority?: string; escalation?: boolean }) => {
  const { data } = await api.patch(`/tickets/${id}`, payload);
  return data;
};
