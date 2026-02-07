import { NotificationAdapter, NotificationDispatch, DeliveryResult } from './NotificationAdapter';

const toWhatsAppAddress = (value: string) => (value.startsWith('whatsapp:') ? value : `whatsapp:${value}`);

export class TwilioAdapter implements NotificationAdapter {
  constructor(
    private readonly credentials: {
      accountSid: string;
      authToken: string;
      from: string;
      messagingServiceSid?: string;
    },
    private readonly channel: 'SMS' | 'WHATSAPP',
  ) {}

  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    const { accountSid, authToken, from, messagingServiceSid } = this.credentials;
    if (!accountSid || !authToken || !from) {
      return { status: 'FAILED', error: 'Twilio credentials are incomplete' };
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams();
    body.set('To', this.channel === 'WHATSAPP' ? toWhatsAppAddress(payload.to) : payload.to);
    body.set('Body', payload.body);
    if (messagingServiceSid) {
      body.set('MessagingServiceSid', messagingServiceSid);
    } else {
      body.set('From', this.channel === 'WHATSAPP' ? toWhatsAppAddress(from) : from);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = (await response.json()) as { sid?: string; message?: string; error_message?: string };
      if (!response.ok) {
        return { status: 'FAILED', error: data.message ?? data.error_message ?? `Twilio error ${response.status}` };
      }

      return { status: 'SENT', providerId: data.sid ?? undefined };
    } catch (error) {
      return { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown Twilio error' };
    }
  }
}

