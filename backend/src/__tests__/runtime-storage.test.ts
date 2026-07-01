import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeStorageConfig } from '../config/storage';
import { env } from '../config/env';
import {
  buildRuntimeObjectKey,
  getSignedDownloadUrl,
  sanitizeFilename,
  storageKeyFromRef,
  verifyLocalSignedStorageUrl,
} from '../services/runtimeStorage.service';

test('runtime storage keys are tenant scoped and do not include raw filenames', () => {
  const key = buildRuntimeObjectKey({
    schoolId: '11111111-1111-4111-8111-111111111111',
    category: 'imports',
    filename: '../../Students July Upload.xlsx',
    id: 'fixed-id',
    now: new Date('2026-07-01T00:00:00.000Z'),
  });

  assert.equal(key, 'schools/11111111-1111-4111-8111-111111111111/imports/2026/07/fixed-id.xlsx');
  assert.doesNotMatch(key, /Students|\\.\\./);
});

test('filename sanitization preserves safe extensions without trusting path input', () => {
  assert.equal(sanitizeFilename('../../Quarterly Export FINAL.csv'), 'Quarterly-Export-FINAL.csv');
  assert.equal(sanitizeFilename('  weird name !!.PDF'), 'weird-name.pdf');
});

test('storage references parse object keys without exposing filesystem paths', () => {
  assert.equal(
    storageKeyFromRef('s3://academify-private/schools/school-1/exports/export.json'),
    'schools/school-1/exports/export.json',
  );
  assert.equal(
    storageKeyFromRef('local://schools/school-1/imports/file.csv'),
    'schools/school-1/imports/file.csv',
  );
  assert.equal(
    storageKeyFromRef('/uploads/schools/school-1/homework/file.pdf'),
    'schools/school-1/homework/file.pdf',
  );
});

test('production local runtime storage requires an explicit unsafe override', () => {
  assert.throws(
    () =>
      assertSafeStorageConfig({
        nodeEnv: 'production',
        storageDriver: 'local',
        allowLocalStorageInProduction: false,
      }),
    /Production local storage is disabled/,
  );

  assert.doesNotThrow(() =>
    assertSafeStorageConfig({
      nodeEnv: 'production',
      storageDriver: 'local',
      allowLocalStorageInProduction: true,
    }),
  );
});

test('local runtime storage signed URLs verify and reject tampering', async () => {
  const previousStorageDriver = env.STORAGE_DRIVER;
  env.STORAGE_DRIVER = 'local';
  try {
    const signedUrl = await getSignedDownloadUrl({ key: 'schools/school-1/homework/file.pdf', expiresInSeconds: 60 });
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
