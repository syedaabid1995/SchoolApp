import { api } from '../lib/api';

export type AiAssistantAction = {
  id: string;
  name: string;
  summary: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type AiAssistantResponse = {
  message: string;
  conversationId: string;
  requiresConfirmation: boolean;
  action?: AiAssistantAction;
  data?: unknown;
};

export const sendAiAssistantMessage = async (payload: {
  message: string;
  conversationId?: string;
  confirmActionId?: string;
}) => {
  const { data } = await api.post<AiAssistantResponse>('/ai-assistant/chat', payload);
  return data;
};
