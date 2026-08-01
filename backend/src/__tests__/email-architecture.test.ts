import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { emailScopeForIntent, normalizeEmailIntent } from '../services/email/email.types';
import {
  buildTemporaryPasswordCredentialEmailContent,
  resolveCredentialSenderNameFromLoginUrl,
} from '../services/email/credentialEmailContent';
import { renderEmailTemplate } from '../services/email/templateRenderer';

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

test('school admin credential email includes school code and login URL', () => {
  const content = renderEmailTemplate({
    intent: 'SCHOOL_ADMIN_CREATED',
    data: {
      recipientName: 'load-admin@dks.com',
      schoolName: 'CHEZHIYAN SCHOOL',
      schoolCode: '001',
      loginUrl: 'https://001.app.saapttech.com/login',
      email: 'load-admin@dks.com',
      tempPassword: 'temporary-password',
    },
  });

  assert.match(content.subject, /school admin account/i);
  assert.match(content.body, /School Code: 001/);
  assert.match(content.body, /Login URL: https:\/\/001\.app\.saapttech\.com\/login/);
  assert.match(content.body, /Email: load-admin@dks\.com/);
  assert.match(content.body, /Temporary Password: temporary-password/);
});

test('temporary password credential email includes regenerated password details', () => {
  const content = buildTemporaryPasswordCredentialEmailContent({
    recipientName: 'admin@school.com',
    schoolName: 'CHEZHIYAN SCHOOL',
    schoolCode: '001',
    loginUrl: 'https://001.app.saapttech.com/login',
    email: 'admin@school.com',
    tempPassword: 'temporary-password',
    roleLabel: 'School Admin',
  });

  assert.match(content.subject, /School Admin login credentials/);
  assert.match(content.body, /login credentials have been regenerated/);
  assert.match(content.body, /School Code: 001/);
  assert.match(content.body, /Login URL: https:\/\/001\.app\.saapttech\.com\/login/);
  assert.match(content.body, /Temporary Password: temporary-password/);
});

test('credential email sender name follows login URL branding', () => {
  assert.equal(resolveCredentialSenderNameFromLoginUrl('https://001.app.saapttech.com/login'), 'SAAPT');
  assert.equal(resolveCredentialSenderNameFromLoginUrl('https://app.saapttech.com/login'), 'SAAPT');
  assert.equal(resolveCredentialSenderNameFromLoginUrl('https://001.app.akademifyy.in/login'), 'Akademifyy');
  assert.equal(resolveCredentialSenderNameFromLoginUrl('not-a-url'), 'Akademifyy');
});

test('platform provider reads only platform email configuration', () => {
  const platformProvider = source('src/services/email/platformEmailProvider.ts');
  assert.match(platformProvider, /GOOGLE_SMTP_/);
  assert.match(platformProvider, /PLATFORM_SMTP_/);
  assert.doesNotMatch(platformProvider, /GOOGLE_SMTP_USERNAME|GOOGLE_SMTP_PASSWORD/);
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
