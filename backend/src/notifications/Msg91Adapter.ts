import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

const DEFAULT_MSG91_SEND_URL = 'https://control.msg91.com/api/sendhttp.php';
const DEFAULT_MSG91_FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export class Msg91Adapter implements NotificationAdapter {
  constructor(
    private readonly credentials: {
      authKey: string;
      senderId: string;
      route?: string;
      country?: string;
      templateId?: string;
      flowUrl?: string;
      sendUrl?: string;
    },
  ) {}

  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    const { authKey, senderId, route = '4', country = '91', templateId } = this.credentials;
    const mobile = onlyDigits(payload.to);

    if (!authKey || !senderId) {
      return { status: 'FAILED', error: 'MSG91 credentials are incomplete' };
    }
    if (!mobile) {
      return { status: 'FAILED', error: 'MSG91 recipient mobile number is invalid' };
    }

    try {
      if (templateId) {
        const response = await fetch(this.credentials.flowUrl || DEFAULT_MSG91_FLOW_URL, {
          method: 'POST',
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_id: templateId,
            sender: senderId,
            mobiles: mobile,
            message: payload.body,
            VAR1: payload.body,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { request_id?: string; message?: string; type?: string };
        if (!response.ok || data.type === 'error') {
          return { status: 'FAILED', error: data.message ?? `MSG91 error ${response.status}` };
        }
        return { status: 'SENT', providerId: data.request_id };
      }

      const body = new URLSearchParams();
      body.set('authkey', authKey);
      body.set('mobiles', mobile);
      body.set('message', payload.body);
      body.set('sender', senderId);
      body.set('route', route);
      body.set('country', country);
      body.set('response', 'json');

      const response = await fetch(this.credentials.sendUrl || DEFAULT_MSG91_SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = (await response.json().catch(() => ({}))) as { message?: string; type?: string };
      if (!response.ok || data.type === 'error') {
        return { status: 'FAILED', error: data.message ?? `MSG91 error ${response.status}` };
      }
      return { status: 'SENT', providerId: data.message };
    } catch (error) {
      return { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown MSG91 error' };
    }
  }
}
