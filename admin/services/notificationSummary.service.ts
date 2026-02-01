import { api } from '../lib/api';

export type NotificationSummaryItem = {
  id: string;
  title: string;
  message?: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  href?: string;
};

export const listNotificationSummary = async () => {
  const { data } = await api.get<{ items: NotificationSummaryItem[] }>('/notifications/summary');
  return data;
};
