import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from '../config/env';
import { encryptSecret } from '../utils/cryptoVault';
import {
  decryptMessagingCredentials,
  encryptMessagingCredentialsForStorage,
  isMessagingSecretCredentialKey,
} from '../utils/messagingCredentialsCrypto';
import { isEncryptedSensitiveField } from '../utils/sensitiveFieldCrypto';

const TEST_KEY = 'messaging_credentials_key_32_chars_minimum';

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

test('messaging credentials encrypt only provider secret keys when enabled', () => {
  withSensitiveEncryptionEnv(true, () => {
    const stored = encryptMessagingCredentialsForStorage({
      host: 'smtp.example.com',
      port: '587',
      fromEmail: 'school@example.com',
      senderId: 'SCHOOL',
      accountSid: 'AC123',
      password: 'smtp-password',
      authToken: 'twilio-token',
      authKey: 'msg91-key',
      accessToken: 'wati-token',
      apiKey: 'sendgrid-key',
    });

    assert.equal(stored.host, 'smtp.example.com');
    assert.equal(stored.port, '587');
    assert.equal(stored.fromEmail, 'school@example.com');
    assert.equal(stored.senderId, 'SCHOOL');
    assert.equal(stored.accountSid, 'AC123');
    assert.equal(isEncryptedSensitiveField(stored.password), true);
    assert.equal(isEncryptedSensitiveField(stored.authToken), true);
    assert.equal(isEncryptedSensitiveField(stored.authKey), true);
    assert.equal(isEncryptedSensitiveField(stored.accessToken), true);
    assert.equal(isEncryptedSensitiveField(stored.apiKey), true);
    assert.doesNotMatch(JSON.stringify(stored), /smtp-password|twilio-token|msg91-key|wati-token|sendgrid-key/);

    assert.deepEqual(decryptMessagingCredentials(stored), {
      host: 'smtp.example.com',
      port: '587',
      fromEmail: 'school@example.com',
      senderId: 'SCHOOL',
      accountSid: 'AC123',
      password: 'smtp-password',
      authToken: 'twilio-token',
      authKey: 'msg91-key',
      accessToken: 'wati-token',
      apiKey: 'sendgrid-key',
    });
  });
});

test('messaging credentials remain plaintext when sensitive encryption is disabled', () => {
  withSensitiveEncryptionEnv(false, () => {
    const stored = encryptMessagingCredentialsForStorage({
      password: 'smtp-password',
      apiKey: 'sendgrid-key',
      fromEmail: 'school@example.com',
    });

    assert.equal(stored.password, 'smtp-password');
    assert.equal(stored.apiKey, 'sendgrid-key');
    assert.equal(stored.fromEmail, 'school@example.com');
  });
});

test('messaging credentials do not double encrypt sensitive-field or legacy vault secrets', () => {
  withSensitiveEncryptionEnv(true, () => {
    const once = encryptMessagingCredentialsForStorage({ apiKey: 'sendgrid-key' });
    const twice = encryptMessagingCredentialsForStorage(once);
    const legacyPassword = encryptSecret('legacy-smtp-password');
    const stored = encryptMessagingCredentialsForStorage({ password: legacyPassword });

    assert.equal(twice.apiKey, once.apiKey);
    assert.equal(stored.password, legacyPassword);
    assert.equal(decryptMessagingCredentials(stored).password, 'legacy-smtp-password');
  });
});

test('messaging secret key detection is constrained to credential secrets', () => {
  assert.equal(isMessagingSecretCredentialKey('password'), true);
  assert.equal(isMessagingSecretCredentialKey('authToken'), true);
  assert.equal(isMessagingSecretCredentialKey('access_token'), true);
  assert.equal(isMessagingSecretCredentialKey('apiKey'), true);
  assert.equal(isMessagingSecretCredentialKey('private-key'), true);
  assert.equal(isMessagingSecretCredentialKey('fromEmail'), false);
  assert.equal(isMessagingSecretCredentialKey('apiEndpoint'), false);
  assert.equal(isMessagingSecretCredentialKey('senderId'), false);
  assert.equal(isMessagingSecretCredentialKey('accountSid'), false);
});
