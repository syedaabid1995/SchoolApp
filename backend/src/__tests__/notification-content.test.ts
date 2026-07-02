import assert from 'node:assert/strict';
import test from 'node:test';
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
