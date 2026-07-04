import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { emailScopeForIntent, normalizeEmailIntent } from '../services/email/email.types';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

test('email intent routing separates platform and tenant scopes', () => {
  assert.equal(emailScopeForIntent('PASSWORD_RESET'), 'PLATFORM');
  assert.equal(emailScopeForIntent('LOGIN_OTP'), 'PLATFORM');
  assert.equal(emailScopeForIntent('DEMO_APPROVAL'), 'PLATFORM');
  assert.equal(emailScopeForIntent('ATTENDANCE'), 'TENANT');
  assert.equal(emailScopeForIntent('HOMEWORK'), 'TENANT');
  assert.equal(emailScopeForIntent('GENERAL_COMMUNICATION'), 'TENANT');
  assert.equal(normalizeEmailIntent('password-reset', 'GENERAL_COMMUNICATION'), 'GENERAL_COMMUNICATION');
  assert.equal(normalizeEmailIntent('PASSWORD_RESET', 'GENERAL_COMMUNICATION'), 'PASSWORD_RESET');
});

test('platform provider does not read tenant messaging configuration', () => {
  const platformProvider = source('src/services/email/platformEmailProvider.ts');
  assert.match(platformProvider, /GOOGLE_SMTP_/);
  assert.doesNotMatch(platformProvider, /GOOGLE_SMTP_USERNAME|GOOGLE_SMTP_PASSWORD|username:|password:/);
  assert.doesNotMatch(platformProvider, /schoolMessagingConfig|SchoolMessagingConfig|resolveSchoolMessagingProvider|ConfigEntry|configEntry/);
});

test('tenant provider reads school SMTP only and does not read Google Workspace credentials', () => {
  const tenantProvider = source('src/services/email/tenantEmailProvider.ts');
  assert.match(tenantProvider, /schoolMessagingConfig/);
  assert.match(tenantProvider, /config\.service\.code !== 'SMTP'/);
  assert.doesNotMatch(tenantProvider, /GOOGLE_SMTP_|GOOGLE_WORKSPACE|PlatformEmailProvider/);
});

test('generic notification dispatcher no longer falls back from tenant email to platform email', () => {
  const dispatcher = source('src/services/notificationDispatcher.service.ts');
  assert.doesNotMatch(dispatcher, /resolvePlatformEmailProvider/);
  assert.doesNotMatch(dispatcher, /\?\?\s*\(\s*params\.channel === 'EMAIL'/);
});

test('tenant SMTP passwords are encrypted before storage', () => {
  const messagingSettings = source('src/services/messagingSettings.service.ts');
  assert.match(messagingSettings, /prepareCredentialsForStorage/);
  assert.match(messagingSettings, /encryptSecret\(password\)/);
  assert.match(messagingSettings, /Tenant email must use the school SMTP provider/);
});
