import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env';
import {
  decryptSensitiveField,
  encryptSensitiveField,
  hashSensitiveLookupValue,
  isEncryptedSensitiveField,
  isSensitiveLookupHash,
  maybeDecryptSensitiveField,
  maybeEncryptSensitiveField,
  normalizeSensitiveLookupValue,
} from '../utils/sensitiveFieldCrypto';

const TEST_KEY = 'test_sensitive_field_key_32_chars_minimum';
const OTHER_KEY = 'other_sensitive_field_key_32_chars_minimum';

test('sensitive field encryption round trips without exposing plaintext', () => {
  const encrypted = encryptSensitiveField('1234-5678-9012', { key: TEST_KEY });

  assert.equal(isEncryptedSensitiveField(encrypted), true);
  assert.notEqual(encrypted, '1234-5678-9012');
  assert.doesNotMatch(encrypted, /1234-5678-9012/);
  assert.equal(decryptSensitiveField(encrypted, { key: TEST_KEY }), '1234-5678-9012');
});

test('sensitive field encryption uses random IVs for the same plaintext', () => {
  const first = encryptSensitiveField('same aadhaar value', { key: TEST_KEY });
  const second = encryptSensitiveField('same aadhaar value', { key: TEST_KEY });

  assert.notEqual(first, second);
  assert.equal(decryptSensitiveField(first, { key: TEST_KEY }), 'same aadhaar value');
  assert.equal(decryptSensitiveField(second, { key: TEST_KEY }), 'same aadhaar value');
});

test('sensitive field decrypt rejects plaintext and wrong keys', () => {
  assert.throws(
    () => decryptSensitiveField('plain value', { key: TEST_KEY }),
    /Unsupported encrypted sensitive field format/,
  );

  const encrypted = encryptSensitiveField('private value', { key: TEST_KEY });
  assert.throws(() => decryptSensitiveField(encrypted, { key: OTHER_KEY }));
});

test('associated data binds encrypted values to the expected context', () => {
  const encrypted = encryptSensitiveField('driver-license', {
    key: TEST_KEY,
    associatedData: 'TransportVehicle.driverLicense',
  });

  assert.equal(
    decryptSensitiveField(encrypted, {
      key: TEST_KEY,
      associatedData: 'TransportVehicle.driverLicense',
    }),
    'driver-license',
  );
  assert.throws(() =>
    decryptSensitiveField(encrypted, {
      key: TEST_KEY,
      associatedData: 'Student.docAadhaar',
    }),
  );
});

test('maybeEncryptSensitiveField respects feature flag and preserves empty values', () => {
  assert.equal(
    maybeEncryptSensitiveField('plain value', { key: TEST_KEY, encryptionEnabled: false }),
    'plain value',
  );
  assert.equal(maybeEncryptSensitiveField('', { key: TEST_KEY, encryptionEnabled: true }), '');
  assert.equal(maybeEncryptSensitiveField(null, { key: TEST_KEY, encryptionEnabled: true }), null);
  assert.equal(maybeEncryptSensitiveField(undefined, { key: TEST_KEY, encryptionEnabled: true }), undefined);

  const encrypted = maybeEncryptSensitiveField('plain value', {
    key: TEST_KEY,
    encryptionEnabled: true,
  });
  assert.equal(isEncryptedSensitiveField(encrypted), true);
  assert.equal(maybeDecryptSensitiveField(encrypted, { key: TEST_KEY }), 'plain value');
});

test('maybeEncryptSensitiveField does not double-encrypt values', () => {
  const encrypted = encryptSensitiveField('already encrypted', { key: TEST_KEY });

  assert.equal(
    maybeEncryptSensitiveField(encrypted, { key: TEST_KEY, encryptionEnabled: true }),
    encrypted,
  );
});

test('maybeDecryptSensitiveField is backward compatible with plaintext', () => {
  assert.equal(maybeDecryptSensitiveField('plain value', { key: TEST_KEY }), 'plain value');
  assert.equal(maybeDecryptSensitiveField('', { key: TEST_KEY }), '');
  assert.equal(maybeDecryptSensitiveField(null, { key: TEST_KEY }), null);
  assert.equal(maybeDecryptSensitiveField(undefined, { key: TEST_KEY }), undefined);
});

test('sensitive lookup hashes are deterministic normalized HMAC values', () => {
  const first = hashSensitiveLookupValue(' Parent@Example.COM ', { key: TEST_KEY });
  const second = hashSensitiveLookupValue('parent@example.com', { key: TEST_KEY });
  const different = hashSensitiveLookupValue('other@example.com', { key: TEST_KEY });

  assert.equal(normalizeSensitiveLookupValue(' Parent@Example.COM '), 'parent@example.com');
  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.equal(isSensitiveLookupHash(first), true);
  assert.doesNotMatch(first, /parent@example.com/i);
});

test('hashSensitiveLookupValue returns empty hash for empty lookup values', () => {
  assert.equal(hashSensitiveLookupValue('   ', { key: TEST_KEY }), '');
});

test('env defaults can drive maybeEncryptSensitiveField without changing call sites', () => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = true;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = TEST_KEY;

    const encrypted = maybeEncryptSensitiveField('env controlled');
    assert.equal(isEncryptedSensitiveField(encrypted), true);
    assert.equal(maybeDecryptSensitiveField(encrypted), 'env controlled');
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
});
