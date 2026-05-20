import { api } from '../lib/api';

export type MessagingChannel = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';

export type MessagingServiceItem = {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  supportedChannels: MessagingChannel[];
  schoolConfigsCount?: number;
};

export type SchoolMessagingConfig = {
  id: string;
  channel: MessagingChannel;
  isEnabled: boolean;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  credentialKeys: string[];
  maskedCredentials: Record<string, string>;
};

export const listMessagingServicesAdmin = async () => {
  const { data } = await api.get<{ items: MessagingServiceItem[] }>('/admin/messaging-services');
  return data.items;
};

export const updateMessagingServiceStatus = async (id: string, status: 'ACTIVE' | 'INACTIVE') => {
  const { data } = await api.patch<MessagingServiceItem>(`/admin/messaging-services/${id}/status`, { status });
  return data;
};

export const getPlatformEmailConfig = async () => {
  const { data } = await api.get<{ config: SchoolMessagingConfig | null }>('/admin/messaging-services/platform-email-config');
  return data.config;
};

export const upsertPlatformEmailConfig = async (payload: {
  serviceId: string;
  isEnabled: boolean;
  credentials: Record<string, string>;
}) => {
  const { data } = await api.put<SchoolMessagingConfig>('/admin/messaging-services/platform-email-config', payload);
  return data;
};

export const togglePlatformEmailConfigStatus = async (payload: { isEnabled: boolean }) => {
  const { data } = await api.patch<SchoolMessagingConfig>('/admin/messaging-services/platform-email-config/status', payload);
  return data;
};

export const listMessagingServicesForSchool = async (channel: MessagingChannel = 'WHATSAPP') => {
  const { data } = await api.get<{
    channel: MessagingChannel;
    currentServiceId: string | null;
    currentEnabled: boolean;
    services: MessagingServiceItem[];
  }>('/messaging-services/services', { params: { channel } });
  return data;
};

export const listMessagingServicesForSchoolScope = async (params: {
  channel?: MessagingChannel;
  schoolId?: string;
}) => {
  const { data } = await api.get<{
    channel: MessagingChannel;
    currentServiceId: string | null;
    currentEnabled: boolean;
    services: MessagingServiceItem[];
  }>('/messaging-services/services', { params });
  return data;
};

export const getSchoolMessagingConfig = async (channel: MessagingChannel = 'WHATSAPP') => {
  const { data } = await api.get<{ config: SchoolMessagingConfig | null }>('/messaging-services/config', {
    params: { channel },
  });
  return data.config;
};

export const getSchoolMessagingConfigForScope = async (params: {
  channel?: MessagingChannel;
  schoolId?: string;
}) => {
  const { data } = await api.get<{ config: SchoolMessagingConfig | null }>('/messaging-services/config', {
    params,
  });
  return data.config;
};

export const upsertSchoolMessagingConfig = async (payload: {
  channel: MessagingChannel;
  serviceId: string;
  isEnabled: boolean;
  credentials: Record<string, string>;
  schoolId?: string;
}) => {
  const { data } = await api.put('/messaging-services/config', payload);
  return data;
};

export const toggleSchoolMessagingConfigStatus = async (payload: {
  channel: MessagingChannel;
  isEnabled: boolean;
  schoolId?: string;
}) => {
  const { data } = await api.patch('/messaging-services/config/status', payload);
  return data;
};
