import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

export class SmsAdapter implements NotificationAdapter {
  async send(_payload: NotificationDispatch): Promise<DeliveryResult> {
    return { status: 'FAILED', error: 'SMS adapter not configured' };
  }
}
