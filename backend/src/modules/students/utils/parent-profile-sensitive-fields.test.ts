import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../../../config/env';
import { isEncryptedSensitiveField, isSensitiveLookupHash } from '../../../utils/sensitiveFieldCrypto';
import {
  decryptParentProfileSensitiveFields,
  encryptParentProfileSensitiveFields,
  parentProfileAnyContactWhere,
  parentProfileContactWhere,
} from './parent-profile-sensitive-fields';

const TEST_KEY = 'parent_profile_sensitive_key_32_chars_minimum';

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

test('encryptParentProfileSensitiveFields encrypts contacts and adds lookup hashes', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptParentProfileSensitiveFields({
      firstName: 'Parent',
      phone: '9000000000',
      email: ' Parent@Example.COM ',
    });
    const same = encryptParentProfileSensitiveFields({
      phone: '9000000000',
      email: 'parent@example.com',
    });

    assert.equal(stored.firstName, 'Parent');
    assert.equal(isEncryptedSensitiveField(stored.phone), true);
    assert.equal(isEncryptedSensitiveField(stored.email), true);
    assert.equal(isSensitiveLookupHash(stored.phoneHash), true);
    assert.equal(isSensitiveLookupHash(stored.emailHash), true);
    assert.equal(stored.phoneHash, same.phoneHash);
    assert.equal(stored.emailHash, same.emailHash);

    const apiResponse = decryptParentProfileSensitiveFields(stored);
    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.email, ' Parent@Example.COM ');
  });
});

test('parent profile contact predicates use hash with plaintext fallback', () => {
  withSensitiveEncryptionEnv(true, () => {
    const exactWhere = parentProfileContactWhere('phone', ['9000000000']);
    const anyWhere = parentProfileAnyContactWhere('parent@example.com');

    assert.equal(exactWhere.length, 2);
    assert.match(JSON.stringify(exactWhere), /phoneHash/);
    assert.match(JSON.stringify(exactWhere), /phone/);
    assert.equal(anyWhere.length, 4);
    assert.match(JSON.stringify(anyWhere), /emailHash/);
  });
});

test('decryptParentProfileSensitiveFields is backward compatible with plaintext', () => {
  withSensitiveEncryptionEnv(true, () => {
    const apiResponse = decryptParentProfileSensitiveFields({
      phone: '9000000000',
      email: 'parent@example.com',
    });

    assert.equal(apiResponse.phone, '9000000000');
    assert.equal(apiResponse.email, 'parent@example.com');
  });
});
