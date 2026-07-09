export type NotificationDispatch = {
  to: string;
  subject?: string;
  body: string;
  html?: string;
  data?: Record<string, string | undefined | null>;
  platform?: 'WEB' | 'ANDROID' | 'IOS';
};

export type DeliveryResult = {
  providerId?: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  error?: string;
};

export interface NotificationAdapter {
  send(payload: NotificationDispatch): Promise<DeliveryResult>;
}
