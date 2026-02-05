import { api } from '../lib/api';

export type MessagingServiceItem = {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  supportedChannels: Array<'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH'>;
  schoolConfigsCount?: number;
};

export type SchoolMessagingConfig = {
  id: string;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
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

export const listMessagingServicesForSchool = async (channel: 'SMS' | 'WHATSAPP' = 'WHATSAPP') => {
  const { data } = await api.get<{
    channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
    currentServiceId: string | null;
    currentEnabled: boolean;
    services: MessagingServiceItem[];
  }>('/messaging-services/services', { params: { channel } });
  return data;
};

export const getSchoolMessagingConfig = async (channel: 'SMS' | 'WHATSAPP' = 'WHATSAPP') => {
  const { data } = await api.get<{ config: SchoolMessagingConfig | null }>('/messaging-services/config', {
    params: { channel },
  });
  return data.config;
};

export const upsertSchoolMessagingConfig = async (payload: {
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
  serviceId: string;
  isEnabled: boolean;
  credentials: Record<string, string>;
}) => {
  const { data } = await api.put('/messaging-services/config', payload);
  return data;
};

export const toggleSchoolMessagingConfigStatus = async (payload: {
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
  isEnabled: boolean;
}) => {
  const { data } = await api.patch('/messaging-services/config/status', payload);
  return data;
};
