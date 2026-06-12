import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  closeBackgroundHandles,
  getUser,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
  startTestServer,
} from './test-utils';
import { collectFeePayment } from '../controllers/feeManagement.controller';
import { errorMiddleware } from '../middlewares/error.middleware';

let server: Awaited<ReturnType<typeof startTestServer>>;

const expectValidationFailure = (response: Awaited<ReturnType<typeof server.request>>, field: string) => {
  assert.equal(response.status, 400);
  assert.equal((response.body as any).success, false);
  assert.equal((response.body as any).message, 'Validation failed');
  assert.ok(Array.isArray((response.body as any).errors));
  assert.ok(
    (response.body as any).errors.some((error: any) => error.field === field),
    `Expected validation error for ${field}, got ${response.text}`,
  );
};

const renderError = (err: unknown) => {
  let status = 0;
  let body: unknown = null;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  errorMiddleware(err, {} as any, res as any, () => undefined);
  return { status, body, text: JSON.stringify(body), headers: new Headers() };
};

test.beforeEach(async () => {
  seedSecurityUsers();
  patchSecurityTestDependencies();
  server = await startTestServer();
});

test.afterEach(async () => {
  await server.close();
  restoreSecurityTestDependencies();
});

test.after(async () => {
  await closeBackgroundHandles();
});

test('auth login rejects missing required password with standard validation error', async () => {
  const response = await server.request('POST', '/api/v1/auth/login', {
    body: { email: 'admin@example.com', loginType: 'admin' },
  });

  expectValidationFailure(response, 'password');
});

test('auth 2fa rejects invalid challenge id with standard validation error', async () => {
  const response = await server.request('POST', '/api/v1/auth/verify-2fa', {
    body: { challengeId: 'not-a-uuid', otp: '123456' },
  });

  expectValidationFailure(response, 'challengeId');
});

test('attendance route params are validated before controller execution', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('PATCH', '/api/v1/attendance/sessions/not-a-uuid', {
    user: schoolAdmin,
    body: {},
  });

  expectValidationFailure(response, 'id');
});

test('attendance mutation body rejects missing records with standard validation error', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('POST', '/api/v1/attendance/legacy/records', {
    user: schoolAdmin,
    body: {
      sessionId: '11111111-1111-4111-8111-111111111111',
      deviceId: 'device-1',
      records: [],
    },
  });

  expectValidationFailure(response, 'records');
});

test('attendance query rejects invalid approval status with standard validation error', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('GET', '/api/v1/attendance/legacy/sessions?approvalStatus=INVALID', {
    user: schoolAdmin,
  });

  expectValidationFailure(response, 'approvalStatus');
});

test('fee payment rejects invalid financial payload with standard validation error', async () => {
  try {
    await collectFeePayment(
      {
        auth: { userId: '44444444-4444-4444-8444-444444444444', schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
        body: {
          invoiceId: '11111111-1111-4111-8111-111111111111',
          amount: -1,
          paymentMode: 'CASH',
        },
      } as any,
      {} as any,
    );
    assert.fail('Expected fee payment validation to fail');
  } catch (err) {
    const response = renderError(err);
    expectValidationFailure(response as any, 'amount');
  }
});

test('fee payment rejects enum violations with standard validation error', async () => {
  try {
    await collectFeePayment(
      {
        auth: { userId: '44444444-4444-4444-8444-444444444444', schoolId: SCHOOL_A_ID, role: 'SCHOOL_ADMIN' },
        body: {
          invoiceId: '11111111-1111-4111-8111-111111111111',
          amount: 100,
          paymentMode: 'WIRE',
        },
      } as any,
      {} as any,
    );
    assert.fail('Expected fee payment validation to fail');
  } catch (err) {
    const response = renderError(err);
    expectValidationFailure(response as any, 'paymentMode');
  }
});

test('fee route authorization still runs before controller validation', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('POST', '/api/v1/fees/payments', {
    user: schoolAdmin,
    body: {
      studentId: '11111111-1111-4111-8111-111111111111',
      amount: -1,
      paymentMode: 'CASH',
    },
  });

  assert.equal(response.status, 403);
});

test('payroll generation rejects invalid month with standard validation error', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('POST', '/api/v1/staff/payroll/generate', {
    user: schoolAdmin,
    body: {
      staffId: '11111111-1111-4111-8111-111111111111',
      month: 13,
      year: 2026,
      basicSalary: 1000,
    },
  });

  expectValidationFailure(response, 'month');
});

test('student create rejects missing required fields with standard validation error', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('POST', '/api/v1/students/students', {
    user: schoolAdmin,
    body: {},
  });

  expectValidationFailure(response, 'fullName');
});

test('staff create rejects missing email with standard validation error', async () => {
  const schoolAdmin = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);
  const response = await server.request('POST', '/api/v1/staff', {
    user: schoolAdmin,
    body: {},
  });

  expectValidationFailure(response, 'email');
});
