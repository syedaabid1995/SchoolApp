import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHOOL_A_ID,
  SCHOOL_B_ID,
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

const validBranding = {
  appName: 'School Management System',
  schoolName: 'School Portal',
  loginHeading: 'Welcome back',
  loginSubtitle: 'Sign in to continue',
  leftPanelTitle: 'Manage your school',
  leftPanelDescription: 'Academics, attendance, exams, and communication.',
  features: ['Attendance', 'Exams', 'Parent portal'],
  securityNote: 'Secure session cookies protect your login.',
  footerText: 'School Management System',
  supportText: 'Contact your school administrator.',
  primaryColor: '#2563eb',
  secondaryColor: '#0f172a',
  accentColor: '#22c55e',
  backgroundColor: '#f8fafc',
  cardBackgroundColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#e2e8f0',
  buttonBackgroundColor: '#2563eb',
  buttonTextColor: '#ffffff',
  linkColor: '#2563eb',
  errorColor: '#dc2626',
};

test.beforeEach(async () => {
  seedSecurityUsers();
  patchSecurityTestDependencies();
  server = await startTestServer();
});

test.afterEach(async () => {
  await server.close();
  restoreSecurityTestDependencies();
});

test.after(async () => {
  await closeBackgroundHandles();
});

test('theme APIs require authentication', async () => {
  const response = await server.request('GET', `/api/v1/themes?schoolId=${SCHOOL_A_ID}`);
  expectUnauthorized(response);
});

test('Super Admin can create theme for any school', async () => {
  const response = await server.request('POST', '/api/v1/themes', {
    user: getUser('SUPER_ADMIN'),
    body: { schoolId: SCHOOL_B_ID, name: 'Security theme', tokens: { primary: '#2563eb' } },
  });

  expectSuccess(response);
});

test('School Admin can create own school theme but cannot target another school', async () => {
  const schoolAdminA = getUser('SCHOOL_ADMIN', SCHOOL_A_ID);

  const ownSchool = await server.request('POST', '/api/v1/themes', {
    user: schoolAdminA,
    body: { schoolId: SCHOOL_A_ID, name: 'Own theme', tokens: { primary: '#2563eb' } },
  });
  expectSuccess(ownSchool);

  const otherSchool = await server.request('POST', '/api/v1/themes', {
    user: schoolAdminA,
    body: { schoolId: SCHOOL_B_ID, name: 'Other theme', tokens: { primary: '#2563eb' } },
  });
  expectForbidden(otherSchool);
});

test('Teacher, Parent, and Student cannot edit login branding', async () => {
  for (const user of [getUser('TEACHER'), getUser('PARENT'), getUser('STUDENT')]) {
    const response = await server.request('PUT', `/api/v1/themes/login-branding?schoolId=${SCHOOL_A_ID}`, {
      user,
      body: validBranding,
    });
    expectForbidden(response);
  }
});

test('invalid login branding colors are rejected', async () => {
  const response = await server.request('PUT', `/api/v1/themes/login-branding?schoolId=${SCHOOL_A_ID}`, {
    user: getUser('SCHOOL_ADMIN', SCHOOL_A_ID),
    body: { ...validBranding, primaryColor: 'javascript:alert(1)' },
  });

  assert.equal(response.status, 400);
});
