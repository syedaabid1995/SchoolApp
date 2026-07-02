import { DeliveryResult, NotificationAdapter, NotificationDispatch } from './NotificationAdapter';

const SENDGRID_MAIL_SEND_URL = 'https://api.sendgrid.com/v3/mail/send';

export class SendGridEmailAdapter implements NotificationAdapter {
  constructor(
    private readonly credentials: {
      apiKey: string;
      fromEmail: string;
      fromName?: string;
      replyToEmail?: string;
      apiUrl?: string;
    },
  ) {}

  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    const { apiKey, fromEmail, fromName, replyToEmail, apiUrl } = this.credentials;
    if (!apiKey || !fromEmail) {
      return { status: 'FAILED', error: 'SendGrid credentials are incomplete' };
    }

    const content = [{ type: 'text/plain', value: payload.body }];
    if (payload.html) {
      content.push({ type: 'text/html', value: payload.html });
    }

    try {
      const response = await fetch(apiUrl?.trim() || SENDGRID_MAIL_SEND_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: fromEmail, ...(fromName ? { name: fromName } : {}) },
          ...(replyToEmail ? { reply_to: { email: replyToEmail } } : {}),
          subject: payload.subject ?? 'Notification',
          content,
        }),
      });

      if (!response.ok) {
        let message = `SendGrid error ${response.status}`;
        try {
          const data = (await response.json()) as { errors?: Array<{ message?: string }> };
          message = data.errors?.[0]?.message ?? message;
        } catch {
          // Keep the safe status-only message if SendGrid does not return JSON.
        }
        return { status: 'FAILED', error: message };
      }

      return { status: 'SENT', providerId: response.headers.get('x-message-id') ?? undefined };
    } catch (error) {
      return { status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown SendGrid error' };
    }
  }
}
