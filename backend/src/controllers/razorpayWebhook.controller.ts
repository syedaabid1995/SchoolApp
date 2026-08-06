import type { Request, Response } from 'express';
import { logger } from '../config/logger';
import { reconcileParentFeeRazorpayPayment } from './parentPortal.controller';
import { HttpError } from '../middlewares/error.middleware';
import { verifyRazorpayWebhookSignature } from '../services/subscription.service';

type RazorpayWebhookEntity = {
  id?: string;
  order_id?: string | null;
  notes?: Record<string, string | number | boolean | null | undefined>;
  payments?: Array<{ payment_id?: string; status?: string }> | null;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayWebhookEntity };
    order?: { entity?: RazorpayWebhookEntity };
    payment_link?: { entity?: RazorpayWebhookEntity };
  };
};

const supportedEvents = new Set([
  'payment.captured',
  'order.paid',
  'payment_link.paid',
]);

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  if (!Buffer.isBuffer(req.body)) {
    throw new HttpError(400, 'Razorpay webhook body must be raw JSON');
  }

  const signature = req.get('x-razorpay-signature')?.trim();
  if (!signature || !verifyRazorpayWebhookSignature(req.body, signature)) {
    throw new HttpError(400, 'Invalid Razorpay webhook signature');
  }

  let webhook: RazorpayWebhookPayload;
  try {
    webhook = JSON.parse(req.body.toString('utf8')) as RazorpayWebhookPayload;
  } catch {
    throw new HttpError(400, 'Invalid Razorpay webhook JSON');
  }

  const event = webhook.event ?? '';
  if (!supportedEvents.has(event)) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  const payment = webhook.payload?.payment?.entity;
  const order = webhook.payload?.order?.entity;
  const paymentLink = webhook.payload?.payment_link?.entity;
  const linkPayment = paymentLink?.payments?.find(
    (candidate) => candidate.status === 'captured',
  );
  const razorpayPaymentId = payment?.id?.trim() || linkPayment?.payment_id?.trim();
  const razorpayOrderId =
    payment?.order_id?.trim() ||
    order?.id?.trim() ||
    paymentLink?.order_id?.trim();
  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new HttpError(400, 'Razorpay webhook is missing payment or order id');
  }

  const result = await reconcileParentFeeRazorpayPayment({
    razorpayOrderId,
    razorpayPaymentId,
    ignoreNonParentOrder: true,
    fallbackNotes: paymentLink?.notes ?? payment?.notes,
  });
  if (!result) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  logger.info(
    {
      event,
      webhookEventId: req.get('x-razorpay-event-id') ?? undefined,
      razorpayOrderId,
      razorpayPaymentId,
      idempotent: result.idempotent,
    },
    'Razorpay parent fee webhook reconciled',
  );
  res.status(200).json({ received: true, idempotent: result.idempotent });
};
