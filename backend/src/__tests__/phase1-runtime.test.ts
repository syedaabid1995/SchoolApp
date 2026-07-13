import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeCorsConfig, createCorsOriginChecker } from '../config/cors';
import { env } from '../config/env';
import { redactSensitive } from '../config/logger';
import { getSignedUrlForKey, verifyLocalSignedStorageUrl } from '../services/s3.service';
import { getSchoolRootDomains, resolveSchoolSubdomainFromHost } from '../utils/schoolDomain';

test('production CORS rejects wildcard or empty origins', () => {
  assert.throws(
    () => assertSafeCorsConfig({ nodeEnv: 'production', corsOrigins: '*' }),
    /Production CORS_ORIGINS/,
  );
  assert.throws(
    () => assertSafeCorsConfig({ nodeEnv: 'production', corsOrigins: '   ' }),
    /Production CORS_ORIGINS/,
  );
});

test('development CORS can allow wildcard while production requires explicit origins', () => {
  const devPolicy = createCorsOriginChecker({ nodeEnv: 'development', corsOrigins: '*' });
  assert.equal(devPolicy.isOriginAllowed('http://localhost:3001'), true);

  const prodPolicy = createCorsOriginChecker({
    nodeEnv: 'production',
    corsOrigins: 'https://admin.example.com,https://app.example.com',
  });
  assert.equal(prodPolicy.isOriginAllowed('https://admin.example.com'), true);
  assert.equal(prodPolicy.isOriginAllowed('https://unknown.example.com'), false);
});

test('school subdomain resolver supports Akademifyy and SAAPT app roots', () => {
  const previousRoot = process.env.SCHOOL_PUBLIC_ROOT_DOMAIN;
  const previousRoots = process.env.SCHOOL_PUBLIC_ROOT_DOMAINS;
  const previousAdditionalRoots = process.env.ADDITIONAL_SCHOOL_PUBLIC_ROOT_DOMAINS;
  try {
    delete process.env.SCHOOL_PUBLIC_ROOT_DOMAIN;
    delete process.env.SCHOOL_PUBLIC_ROOT_DOMAINS;
    delete process.env.ADDITIONAL_SCHOOL_PUBLIC_ROOT_DOMAINS;

    assert.deepEqual(getSchoolRootDomains(), ['app.akademifyy.in', 'app.saapttech.com']);
    assert.equal(resolveSchoolSubdomainFromHost('che-00003.app.akademifyy.in'), 'che-00003');
    assert.equal(resolveSchoolSubdomainFromHost('che-00003.app.saapttech.com'), 'che-00003');
    assert.equal(resolveSchoolSubdomainFromHost('app.saapttech.com'), null);
    assert.equal(resolveSchoolSubdomainFromHost('api.saapttech.com'), null);
  } finally {
    if (previousRoot === undefined) delete process.env.SCHOOL_PUBLIC_ROOT_DOMAIN;
    else process.env.SCHOOL_PUBLIC_ROOT_DOMAIN = previousRoot;
    if (previousRoots === undefined) delete process.env.SCHOOL_PUBLIC_ROOT_DOMAINS;
    else process.env.SCHOOL_PUBLIC_ROOT_DOMAINS = previousRoots;
    if (previousAdditionalRoots === undefined) delete process.env.ADDITIONAL_SCHOOL_PUBLIC_ROOT_DOMAINS;
    else process.env.ADDITIONAL_SCHOOL_PUBLIC_ROOT_DOMAINS = previousAdditionalRoots;
  }
});

test('logger redaction masks nested sensitive values', () => {
  const redacted = redactSensitive({
    email: 'user@example.com',
    password: 'Password@123',
    headers: { authorization: 'Bearer abc.def.ghi', cookie: 'sid=123' },
    nested: [{ accessToken: 'token-value' }, { profile: { sessionId: 'session-value' } }],
    error: new Error('failed with Bearer abc.def.ghi'),
  }) as Record<string, unknown>;

  assert.equal(redacted.email, 'user@example.com');
  assert.equal(redacted.password, '[REDACTED]');
  assert.deepEqual(redacted.headers, { authorization: '[REDACTED]', cookie: '[REDACTED]' });
  assert.deepEqual(redacted.nested, [{ accessToken: '[REDACTED]' }, { profile: { sessionId: '[REDACTED]' } }]);
  assert.match(JSON.stringify(redacted.error), /Bearer \[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(redacted), /Password@123|abc\.def\.ghi|token-value|sid=123|session-value/);
});

test('local storage signed URLs verify and reject tampering', async () => {
  const previousStorageDriver = env.STORAGE_DRIVER;
  env.STORAGE_DRIVER = 'local';
  try {
    const signedUrl = await getSignedUrlForKey({ key: 'schools/school-1/students/photo.png', expiresInSeconds: 60 });
    const parsed = new URL(signedUrl, 'http://localhost');
    const key = parsed.searchParams.get('key') ?? '';
    const expires = parsed.searchParams.get('expires') ?? '';
    const signature = parsed.searchParams.get('signature') ?? '';

    assert.equal(parsed.pathname, '/api/v1/uploads/local-signed');
    assert.equal(verifyLocalSignedStorageUrl({ key, expires, signature }), true);
    assert.equal(verifyLocalSignedStorageUrl({ key, expires, signature: `${signature}x` }), false);
  } finally {
    env.STORAGE_DRIVER = previousStorageDriver;
  }
});
