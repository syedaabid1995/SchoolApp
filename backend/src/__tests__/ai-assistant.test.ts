import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import {
  closeBackgroundHandles,
  expectForbidden,
  expectSuccess,
  expectUnauthorized,
  getUser,
  patchSecurityTestDependencies,
  restoreSecurityTestDependencies,
  seedSecurityUsers,
  startTestServer,
} from './test-utils';

let server: Awaited<ReturnType<typeof startTestServer>>;

before(async () => {
  patchSecurityTestDependencies();
  seedSecurityUsers();
  server = await startTestServer();
});

beforeEach(() => {
  seedSecurityUsers();
});

afterEach(() => {
  seedSecurityUsers();
});

after(async () => {
  if (server) await server.close();
  restoreSecurityTestDependencies();
  await closeBackgroundHandles();
});

test('AI assistant chat requires authentication', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    body: { message: 'Show classes' },
  });
  expectUnauthorized(response);
});

test('AI assistant refuses unsupported high-risk commands', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Delete student records with direct SQL' },
  });
  expectSuccess(response);
  assert.match(response.text, /cannot perform finance, payroll, deletion, direct SQL/i);
});

test('AI assistant responds conversationally to casual chat', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'how are you?' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /I'm good/i);
  assert.equal(body.data, undefined);
});

test('AI assistant gives a clear unsupported action reply for student creation', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Create Student named "Syed" dob 10/10/1995' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /cannot create students from chat yet/i);
  assert.equal(body.data, undefined);
});

test('AI assistant does not execute stale actions from a standalone confirm', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Confirm' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /no action waiting for confirmation/i);
});

test('AI assistant can answer read-only class queries through operation plans', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Show all classes' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /Classes available/i);
  assert.match(body.message, /Class 1/i);
  assert.equal(body.data[0].entity, 'Class');
  assert.equal(body.data[0].action, 'findRecords');
});

test('AI assistant can answer class-section read queries through operation plans', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'List sections for Class 1' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /Class 1 has 2 sections/i);
  assert.match(body.message, /A/i);
  assert.equal(body.data[0].entity, 'ClassSection');
});

test('AI assistant summarizes setup status in school-admin language', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'What setup is missing?' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /I reviewed your academic setup/i);
  assert.match(body.message, /Configured:/i);
  assert.match(body.message, /Needs attention:/i);
});

test('AI assistant prepares Phase 3A academic setup plans with dry-run counts', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'create an academic year "2027-2028" starting date jan 1 2027 to dec 31 2028' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, true);
  assert.equal(body.action.name, 'operation_plan');
  assert.equal(body.action.operationCount, 1);
  assert.match(body.message, /I checked this setup plan/i);
  assert.match(body.message, /Will create: 1/i);
  assert.match(body.message, /Would you like me to proceed/i);
});

test('AI assistant executes confirmed Phase 3A academic setup plans', async () => {
  const prepare = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'create an academic year "2027-2028" starting date jan 1 2027 to dec 31 2028' },
  });
  expectSuccess(prepare);
  const prepared = prepare.body as any;
  assert.equal(prepared.requiresConfirmation, true);

  const confirm = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { conversationId: prepared.conversationId, confirmActionId: prepared.action.id, message: 'Confirm' },
  });
  expectSuccess(confirm);
  const confirmed = confirm.body as any;
  assert.equal(confirmed.requiresConfirmation, false);
  assert.match(confirmed.message, /Setup completed successfully/i);
  assert.equal(confirmed.data.created, 1);
});

test('AI assistant accepts typed confirmation after Phase 3A dry-run', async () => {
  const prepare = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'create an academic year "2028-2029" starting date jan 1 2028 to dec 31 2029' },
  });
  expectSuccess(prepare);
  const prepared = prepare.body as any;
  assert.equal(prepared.requiresConfirmation, true);

  const confirm = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { conversationId: prepared.conversationId, message: 'Confirm' },
  });
  expectSuccess(confirm);
  const confirmed = confirm.body as any;
  assert.match(confirmed.message, /Setup completed successfully/i);
});

test('AI assistant prepares full Phase 3A setup prompt with academic year, classes, sections, and mappings', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      message: 'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31. Create classes 1 to 12. Create sections A and B. Map sections A and B to classes 1 to 5. Map only section A to classes 6 to 12.',
    },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, true);
  assert.equal(body.action.name, 'operation_plan');
  assert.equal(body.action.operationCount, 5);
  assert.match(body.message, /I checked this setup plan/i);
  assert.match(body.message, /Will create:/i);
  assert.doesNotMatch(body.message, /unambiguous end date/i);
  assert.doesNotMatch(body.message, /Class Class 6 not found/i);
});

test('AI assistant accepts malformed quote in full Phase 3A mapping prompt', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      message: 'Create academic year "2027-2028" starting "2027-01-01" to "2028-12-31". Create classes "1 to 12". Create sections "A and B". Map sections "A and B" to classes "1 to 5". Map only section "A to classes 6 to 12".',
    },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, true);
  assert.equal(body.action.operationCount, 5);
  assert.match(body.message, /I checked this setup plan/i);
  assert.doesNotMatch(body.message, /Class Class 6 not found/i);
});

test('AI assistant executes full Phase 3A setup prompt with intra-plan class-section references', async () => {
  const prepare = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: {
      message: 'Create academic year 2027-2028 starting 2027-01-01 to 2028-12-31. Create classes 1 to 12. Create sections A and B. Map sections A and B to classes 1 to 5. Map only section A to classes 6 to 12.',
    },
  });
  expectSuccess(prepare);
  const prepared = prepare.body as any;
  assert.equal(prepared.requiresConfirmation, true);

  const confirm = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { conversationId: prepared.conversationId, confirmActionId: prepared.action.id, message: 'Confirm' },
  });
  expectSuccess(confirm);
  const confirmed = confirm.body as any;
  assert.match(confirmed.message, /Setup completed successfully/i);
});

test('AI assistant skips Phase 3A records that already exist during dry-run', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Create classes between Class 1 and Class 12' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, false);
  assert.match(body.message, /already exists/i);
  assert.match(body.message, /nothing new to create/i);
  assert.equal(body.data.dryRun.skips, 12);
});

test('AI assistant keeps non-Phase-3A generic write plans preview-only', async () => {
  const prepare = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Create subjects English and Math' },
  });
  expectSuccess(prepare);
  const prepared = prepare.body as any;
  assert.equal(prepared.requiresConfirmation, true);
  assert.match(prepared.message, /Generic execution is not enabled for this entity yet/i);

  const confirm = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { conversationId: prepared.conversationId, confirmActionId: prepared.action.id, message: 'Confirm' },
  });
  expectSuccess(confirm);
  const confirmed = confirm.body as any;
  assert.equal(confirmed.requiresConfirmation, false);
  assert.match(confirmed.message, /preview-only/i);
});

test('School Admin can prepare a setup action but it requires confirmation', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('SCHOOL_ADMIN'),
    body: { message: 'Create Class 9' },
  });
  expectSuccess(response);
  const body = response.body as any;
  assert.equal(body.requiresConfirmation, true);
  assert.equal(body.action.name, 'create_class');
  assert.match(body.action.summary, /Create Class 9/i);
});

test('Teacher cannot prepare mutation commands through the AI assistant', async () => {
  const response = await server.request('POST', '/api/v1/ai-assistant/chat', {
    user: getUser('TEACHER'),
    body: { message: 'Create Class 9' },
  });
  expectForbidden(response);
});
