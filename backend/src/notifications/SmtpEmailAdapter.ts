import nodemailer from 'nodemailer';
import { DeliveryResult, NotificationAdapter, NotificationDispatch } from './NotificationAdapter';

const asBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const formatFrom = (email: string, name?: string) => {
  const trimmedEmail = email.trim();
  const trimmedName = name?.trim();
  return trimmedName ? `"${trimmedName.replace(/"/g, '\\"')}" <${trimmedEmail}>` : trimmedEmail;
};

const summarizeSmtpError = (error: unknown) => {
  if (!(error instanceof Error)) return 'SMTP email failed';
  const code = (error as { code?: string; responseCode?: number }).code;
  const responseCode = (error as { responseCode?: number }).responseCode;
  return [code, responseCode, error.message].filter(Boolean).join(' ');
};

export class SmtpEmailAdapter implements NotificationAdapter {
  constructor(
    private readonly credentials: {
      host: string;
      port: string;
      username?: string;
      password?: string;
      fromEmail: string;
      fromName?: string;
      secure?: string;
    },
  ) {}

  async send(payload: NotificationDispatch): Promise<DeliveryResult> {
    const port = Number.parseInt(this.credentials.port, 10);
    if (!this.credentials.host || !Number.isFinite(port) || !this.credentials.fromEmail) {
      return { status: 'FAILED', error: 'SMTP credentials are incomplete' };
    }

    const transporter = nodemailer.createTransport({
      host: this.credentials.host,
      port,
      secure: asBoolean(this.credentials.secure, port === 465),
      auth:
        this.credentials.username && this.credentials.password
          ? {
              user: this.credentials.username,
              pass: this.credentials.password,
            }
          : undefined,
    });

    try {
      const result = await transporter.sendMail({
        to: payload.to,
        from: formatFrom(this.credentials.fromEmail, this.credentials.fromName),
        subject: payload.subject ?? 'Notification',
        text: payload.body,
      });
      return { status: 'SENT', providerId: result.messageId };
    } catch (error) {
      return { status: 'FAILED', error: summarizeSmtpError(error) };
    }
  }
}
