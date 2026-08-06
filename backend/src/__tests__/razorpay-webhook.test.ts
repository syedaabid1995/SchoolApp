import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test, { afterEach } from 'node:test';
import type { Request, Response } from 'express';
import { env } from '../config/env';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhook.controller';
import { parentFeePaymentLinkOptions } from '../controllers/parentPortal.controller';
import { verifyRazorpayWebhookSignature } from '../services/subscription.service';

const originalWebhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

afterEach(() => {
  env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
});

const signatureFor = (body: Buffer, secret: string) =>
  crypto.createHmac('sha256', secret).update(body).digest('hex');

test('parent fee Payment Links enable WebView UPI intent like StyLife', () => {
  assert.deepEqual(parentFeePaymentLinkOptions, {
    checkout: {
      method: {
        card: true,
        netbanking: true,
        upi: true,
        wallet: true,
      },
      webview_intent: true,
    },
  });
});

test('Razorpay webhook signature verification uses the exact raw body', () => {
  const secret = 'webhook-test-secret';
  const body = Buffer.from('{"event":"payment.captured","payload":{}}');
  env.RAZORPAY_WEBHOOK_SECRET = secret;

  assert.equal(verifyRazorpayWebhookSignature(body, signatureFor(body, secret)), true);
  assert.equal(
    verifyRazorpayWebhookSignature(
      Buffer.from('{"event":"payment.captured", "payload":{}}'),
      signatureFor(body, secret),
    ),
    false,
  );
});

test('Razorpay webhook acknowledges signed events that do not require reconciliation', async () => {
  const secret = 'webhook-test-secret';
  const body = Buffer.from('{"event":"payment.failed","payload":{}}');
  const signature = signatureFor(body, secret);
  env.RAZORPAY_WEBHOOK_SECRET = secret;

  let statusCode = 0;
  let responseBody: unknown;
  const request = {
    body,
    get: (name: string) =>
      name.toLowerCase() === 'x-razorpay-signature' ? signature : undefined,
  } as unknown as Request;
  const response = {
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: (payload: unknown) => {
      responseBody = payload;
      return response;
    },
  } as unknown as Response;

  await handleRazorpayWebhook(request, response);

  assert.equal(statusCode, 200);
  assert.deepEqual(responseBody, { received: true, ignored: true });
});

test('Razorpay webhook rejects an invalid signature before processing', async () => {
  env.RAZORPAY_WEBHOOK_SECRET = 'webhook-test-secret';
  const request = {
    body: Buffer.from('{"event":"payment.captured","payload":{}}'),
    get: (name: string) =>
      name.toLowerCase() === 'x-razorpay-signature' ? 'invalid' : undefined,
  } as unknown as Request;

  await assert.rejects(
    () => handleRazorpayWebhook(request, {} as Response),
    (error: any) => error?.statusCode === 400 && /signature/i.test(error.message),
  );
});
