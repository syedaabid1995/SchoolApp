import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../../config/env';
import { isEncryptedSensitiveField, isSensitiveLookupHash } from '../../../utils/sensitiveFieldCrypto';
import {
  decryptParentGuardianSensitiveFields,
  encryptParentGuardianSensitiveFields,
  parentGuardianContactWhere,
} from './parent-guardian-sensitive-fields';

const TEST_KEY = 'parent_guardian_sensitive_key_32_chars_minimum';

const withSensitiveEncryptionEnv = <T>(
  enabled: boolean,
  callback: () => T,
) => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = enabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = TEST_KEY;
    return callback();
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
};

test('encryptParentGuardianSensitiveFields encrypts contacts and adds lookup hashes', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptParentGuardianSensitiveFields({
      name: 'Guardian',
      phone: '9000000000',
      email: ' Parent@Example.COM ',
    });
    const same = encryptParentGuardianSensitiveFields({
      phone: '9000000000',
      email: 'parent@example.com',
    });

    assert.equal(stored.name, 'Guardian');
    assert.equal(isEncryptedSensitiveField(stored.phone), true);
    assert.equal(isEncryptedSensitiveField(stored.email), true);
    assert.equal(isSensitiveLookupHash(stored.phoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.emailHash), true);
    assert.equal(stored.phoneHash, same.phoneHash);
    assert.equal(stored.emailHash, same.emailHash);

    const apiResponse = decryptParentGuardianSensitiveFields(stored);
    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.email, ' Parent@Example.COM ');
  });
});

test('parentGuardianContactWhere includes hash and plaintext fallback predicates', () => {
  withSensitiveEncryptionEnv(true, () => {
    const where = parentGuardianContactWhere('school-1', 'phone', ['9000000000']);
    const serialized = JSON.stringify(where);

    assert.equal(where.length, 2);
    assert.match(serialized, /phoneHash/);
    assert.match(serialized, /phone/);
    assert.doesNotMatch(serialized, /"email"/);
  });
});

test('decryptParentGuardianSensitiveFields is backward compatible with plaintext', () => {
  withSensitiveEncryptionEnv(true, () => {
    const apiResponse = decryptParentGuardianSensitiveFields({
      phone: '9000000000',
      email: 'parent@example.com',
    });

    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.email, 'parent@example.com');
  });
});
