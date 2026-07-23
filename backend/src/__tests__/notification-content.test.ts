import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAccountOnboardingMessageContent } from '../services/accountOnboardingWhatsapp.service';
import { resolveNotificationContent } from '../services/notification.service';

test('notification content renders recipient placeholders in custom email body and html', () => {
  const content = resolveNotificationContent({
    channel: 'EMAIL',
    data: {
      subject: 'Hello {{ recipientName }}',
      body: 'Welcome {{recipientName}} as {{recipientType}}',
      html: '<p>Welcome <strong>{{ recipientName }}</strong> as {{ recipientType }}</p>',
      recipientName: 'Syed Aabid',
      recipientType: 'Student',
    },
  });

  assert.equal(content.subject, 'Hello Syed Aabid');
  assert.equal(content.body, 'Welcome Syed Aabid as Student');
  assert.equal(content.html, '<p>Welcome <strong>Syed Aabid</strong> as Student</p>');
});

test('notification content renders template placeholders when no custom body is provided', () => {
  const content = resolveNotificationContent({
    channel: 'SMS',
    template: {
      subject: null,
      body: 'Dear {{recipientName}}, your role is {{recipientType}}.',
    },
    data: {
      recipientName: 'Syed Aabid',
      recipientType: 'Guardian',
    },
  });

  assert.equal(content.body, 'Dear Syed Aabid, your role is Guardian.');
  assert.equal(content.html, undefined);
});

test('account onboarding WhatsApp text uses school code and login URL', () => {
  const content = buildAccountOnboardingMessageContent({
    role: 'SCHOOL_ADMIN',
    email: 'admin@school.com',
    displayName: 'admin@school.com',
    appLabel: 'CHEZHIYAN SCHOOL Admin Portal',
    schoolCode: '001',
    tempPassword: 'temporary-password',
    loginUrl: 'https://001.app.saapttech.com/login',
  });

  assert.match(content.manualShareText, /School Code: 001/);
  assert.match(content.manualShareText, /Login URL: https:\/\/001\.app\.saapttech\.com\/login/);
  assert.doesNotMatch(content.manualShareText, /School ID:/);
  assert.match(content.body, /Login Email: admin@school\.com/);
});
