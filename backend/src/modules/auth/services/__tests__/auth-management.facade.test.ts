import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '../auth-management.core';
import * as facade from '../auth-management.facade';

const authRouteHandlers = [
  'changePassword',
  'disableTotp',
  'forgotPassword',
  'listSessions',
  'login',
  'logout',
  'logoutAll',
  'refreshToken',
  'resendTwoFactor',
  'resetPassword',
  'revokeSession',
  'startTotpSetup',
  'verifyTotpLogin',
  'verifyTotpSetup',
  'verifyTwoFactor',
] as const;

test('auth management facade preserves the existing route handler export surface', () => {
  for (const handlerName of authRouteHandlers) {
    assert.equal(typeof facade[handlerName], 'function', `${handlerName} should be exported by the auth facade`);
    assert.equal(facade[handlerName], core[handlerName], `${handlerName} should delegate to the existing implementation`);
  }
});
