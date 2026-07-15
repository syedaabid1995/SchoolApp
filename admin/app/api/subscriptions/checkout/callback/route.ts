import { NextResponse } from 'next/server';

const callbackKeys = [
  'razorpay_order_id',
  'razorpay_payment_id',
  'razorpay_signature',
  'error_code',
  'error_description',
  'error_source',
  'error_step',
  'error_reason',
  'return_origin',
] as const;

const getText = (value: FormDataEntryValue | string | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const readCallbackParams = async (req: Request) => {
  const url = new URL(req.url);
  const params = new URLSearchParams();
  const contentType = req.headers.get('content-type') ?? '';

  if (req.method === 'POST' && contentType.includes('application/x-www-form-urlencoded')) {
    const form = await req.formData();
    for (const key of callbackKeys) {
      const value = getText(form.get(key));
      if (value) params.set(key, value);
    }
  } else if (req.method === 'POST' && contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    for (const key of callbackKeys) {
      const value = typeof body?.[key] === 'string' ? body[key].trim() : '';
      if (value) params.set(key, value);
    }
  }

  for (const key of callbackKeys) {
    const value = getText(url.searchParams.get(key));
    if (value) params.set(key, value);
  }

  const hasSuccessfulPayment =
    Boolean(params.get('razorpay_order_id')) &&
    Boolean(params.get('razorpay_payment_id')) &&
    Boolean(params.get('razorpay_signature'));
  params.set('checkout_status', hasSuccessfulPayment ? 'success' : 'failed');

  if (!hasSuccessfulPayment && !params.get('error_description')) {
    params.set('error_description', 'Payment was cancelled or Razorpay did not return payment details.');
  }

  return params;
};

const getReturnOrigin = (params: URLSearchParams) => {
  const value = params.get('return_origin');
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
};

const redirectToPlans = async (req: Request) => {
  const params = await readCallbackParams(req);
  const target = new URL('/dashboard/plans', getReturnOrigin(params) ?? req.url);
  target.search = params.toString();
  return NextResponse.redirect(target, { status: req.method === 'POST' ? 303 : 302 });
};

export async function GET(req: Request) {
  return redirectToPlans(req);
}

export async function POST(req: Request) {
  return redirectToPlans(req);
}
