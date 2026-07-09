import { api } from '../lib/api';

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'PUSH';
export type PushPriority = 'normal' | 'high' | 'urgent';
export type RecipientGroup =
  | 'STUDENTS'
  | 'GUARDIANS'
  | 'ADMIN'
  | 'TEACHER'
  | 'ACCOUNTANT'
  | 'LIBRARIAN'
  | 'RECEPTIONIST'
  | 'STAFF';
export type CommunicationTargetMode = 'GROUP' | 'CLASS' | 'INDIVIDUAL' | 'BIRTHDAY';

export type CommunicationNotice = {
  id: string;
  title: string;
  message: string;
  audience: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;
  publishedAt: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByEmail?: string | null;
};

export type CommunicationTemplate = {
  id: string;
  schoolId: string | null;
  key: string;
  name: string;
  channel: CommunicationChannel;
  subject?: string | null;
  body: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationLog = {
  id: string;
  channel: CommunicationChannel;
  status: 'QUEUED' | 'SENT' | 'FAILED' | string;
  to: string;
  subject?: string | null;
  message: string;
  recipientName: string;
  recipientType: string;
  targetMode: string;
  templateName?: string | null;
  providerId?: string | null;
  error?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
};

export type PushNotificationLog = {
  id: string;
  schoolId?: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED' | string;
  recipientUserId: string;
  subject?: string | null;
  message: string;
  recipientName: string;
  recipientType: string;
  route?: string | null;
  module?: string | null;
  templateName?: string | null;
  providerId?: string | null;
  error?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
};

export type CommunicationSendPayload = {
  schoolId?: string;
  templateId?: string | null;
  subject?: string | null;
  body?: string | null;
  recipientGroups: RecipientGroup[];
  targetMode: CommunicationTargetMode;
  classId?: string | null;
  sectionId?: string | null;
  individualRecipient?: string | null;
  scheduledAt?: string | null;
  route?: string | null;
  module?: string | null;
  category?: string | null;
  priority?: PushPriority | null;
};

export type CommunicationSendResult = {
  channel: CommunicationChannel;
  scheduled: boolean;
  recipientCount: number;
  logIds: string[];
  sentCount?: number;
  failedCount?: number;
};

const withSchool = (schoolId?: string) => (schoolId ? { schoolId } : undefined);

export const listCommunicationNotices = async (schoolId?: string) => {
  const { data } = await api.get<{ items: CommunicationNotice[] }>('/communication/notices', {
    params: withSchool(schoolId),
  });
  return data.items;
};

export const createCommunicationNotice = async (payload: {
  schoolId?: string;
  title: string;
  message: string;
  audience: string[];
  status: string;
  publishedAt?: string;
  expiresAt?: string | null;
}) => {
  const { data } = await api.post<CommunicationNotice>('/communication/notices', payload);
  return data;
};

export const updateCommunicationNotice = async (
  id: string,
  payload: Partial<{
    schoolId: string;
    title: string;
    message: string;
    audience: string[];
    status: string;
    publishedAt: string;
    expiresAt: string | null;
  }>,
) => {
  const { data } = await api.patch<CommunicationNotice>(`/communication/notices/${id}`, payload);
  return data;
};

export const deleteCommunicationNotice = async (id: string, schoolId?: string) => {
  const { data } = await api.delete<{ success: boolean }>(`/communication/notices/${id}`, {
    params: withSchool(schoolId),
  });
  return data;
};

export const listCommunicationTemplates = async (channel: CommunicationChannel, schoolId?: string, platform = false) => {
  const { data } = await api.get<{ items: CommunicationTemplate[] }>('/communication/templates', {
    params: { channel, ...(platform ? { platform: true } : schoolId ? { schoolId } : {}) },
  });
  return data.items;
};

export const createCommunicationTemplate = async (payload: {
  schoolId?: string;
  platform?: boolean;
  channel: CommunicationChannel;
  name: string;
  subject?: string | null;
  body: string;
}) => {
  const { data } = await api.post<CommunicationTemplate>('/communication/templates', payload);
  return data;
};

export const updateCommunicationTemplate = async (
  id: string,
  payload: Partial<{
    schoolId: string;
    platform: boolean;
    channel: CommunicationChannel;
    name: string;
    subject: string | null;
    body: string;
  }> & { channel: CommunicationChannel },
) => {
  const { data } = await api.patch<CommunicationTemplate>(`/communication/templates/${id}`, payload);
  return data;
};

export const deleteCommunicationTemplate = async (id: string, channel: CommunicationChannel, schoolId?: string, platform = false) => {
  const { data } = await api.delete<{ success: boolean }>(`/communication/templates/${id}`, {
    params: { channel, ...(platform ? { platform: true } : schoolId ? { schoolId } : {}) },
  });
  return data;
};

export const sendCommunicationEmail = async (payload: CommunicationSendPayload) => {
  const { data } = await api.post<CommunicationSendResult>('/communication/send-email', payload);
  return data;
};

export const sendCommunicationSms = async (payload: CommunicationSendPayload) => {
  const { data } = await api.post<CommunicationSendResult>('/communication/send-sms', payload);
  return data;
};

export const sendCommunicationPush = async (payload: CommunicationSendPayload) => {
  const { data } = await api.post<CommunicationSendResult>('/communication/send-push', payload);
  return data;
};

export const sendLoginCredentialInstructions = async (
  payload: Omit<CommunicationSendPayload, 'templateId' | 'subject' | 'body'> & { channel: CommunicationChannel },
) => {
  const { data } = await api.post<CommunicationSendResult>('/communication/login-credentials', payload);
  return data;
};

export const listCommunicationLogs = async (params?: { channel?: CommunicationChannel; schoolId?: string }) => {
  const { data } = await api.get<{ items: CommunicationLog[] }>('/communication/logs', { params });
  return data.items;
};

export const listCommunicationScheduledLogs = async (params?: { channel?: CommunicationChannel; schoolId?: string }) => {
  const { data } = await api.get<{ items: CommunicationLog[] }>('/communication/scheduled-logs', { params });
  return data.items;
};

export const listPushNotificationLogs = async (params?: { schoolId?: string }) => {
  const { data } = await api.get<{ items: PushNotificationLog[] }>('/notifications/push/logs', { params });
  return data.items;
};
