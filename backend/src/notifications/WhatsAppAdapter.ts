import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

export class WhatsAppAdapter implements NotificationAdapter {
  async send(_payload: NotificationDispatch): Promise<DeliveryResult> {
    return { status: 'FAILED', error: 'WhatsApp adapter not configured' };
  }
}
