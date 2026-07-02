export type NotificationDispatch = {
  to: string;
  subject?: string;
  body: string;
  html?: string;
};

export type DeliveryResult = {
  providerId?: string;
  status: 'SENT' | 'FAILED';
  error?: string;
};

export interface NotificationAdapter {
  send(payload: NotificationDispatch): Promise<DeliveryResult>;
}
