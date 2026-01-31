import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

export class PushAdapter implements NotificationAdapter {
  async send(_payload: NotificationDispatch): Promise<DeliveryResult> {
    return { status: 'FAILED', error: 'Push adapter not configured' };
  }
}
