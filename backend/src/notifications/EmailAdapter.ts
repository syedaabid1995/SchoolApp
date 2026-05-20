import { DeliveryResult, NotificationAdapter, NotificationDispatch } from './NotificationAdapter';

export class EmailAdapter implements NotificationAdapter {
  async send(_payload: NotificationDispatch): Promise<DeliveryResult> {
    return { status: 'FAILED', error: 'Email adapter not configured' };
  }
}
