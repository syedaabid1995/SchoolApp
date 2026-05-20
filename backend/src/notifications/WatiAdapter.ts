import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

const onlyPhone = (value: string) =>
  value
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '');

export class WatiAdapter implements NotificationAdapter {
  constructor(
    private readonly credentials: {
      apiEndpoint: string;
      accessToken: string;
    },
  ) {}

  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    const apiEndpoint = this.credentials.apiEndpoint?.replace(/\/+$/, '');
    const accessToken = this.credentials.accessToken;
    const phone = onlyPhone(payload.to);

    if (!apiEndpoint || !accessToken) {
      return { status: 'FAILED', error: 'WATI credentials are incomplete' };
    }
    if (!phone) {
      return { status: 'FAILED', error: 'WATI recipient phone number is invalid' };
    }

    const endpoint = `${apiEndpoint}/api/v1/sendSessionMessage/${encodeURIComponent(phone)}?messageText=${encodeURIComponent(payload.body)}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await response.json().catch(() => ({}))) as {
        result?: boolean;
        message?: string;
        id?: string;
        ticketId?: string;
      };
      if (!response.ok || data.result === false) {
        return { status: 'FAILED', error: data.message ?? `WATI error ${response.status}` };
      }
      return { status: 'SENT', providerId: data.id ?? data.ticketId };
    } catch (error) {
      return { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown WATI error' };
    }
  }
}
