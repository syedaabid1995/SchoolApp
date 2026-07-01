import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { resolvePermissionForPath } from '../middlewares/auth.middleware';
import { PermissionCodes as P } from '../permissions/permission-manifest';

const repoRoot = path.resolve(__dirname, '../../..');

const readRouteSource = (routeFile: string) =>
  fs.readFileSync(path.join(repoRoot, 'backend/src/routes', routeFile), 'utf8');

const guardedRouteFiles = [
  'analytics.routes.ts',
  'attendance.routes.ts',
  'attendanceApproval.routes.ts',
  'consent.routes.ts',
  'face.routes.ts',
  'notification.routes.ts',
  'recognition.routes.ts',
  'upload.routes.ts',
];

const routeCallPattern = /\b[A-Za-z0-9_]+Router\.(get|post|put|patch|delete)\(/;
const explicitGuardPattern = /requirePermission\(|requireRole\(|requireSchoolAdminOrSuperAdmin|requireSuperAdmin|superAdminGuard|requireValidLocalSignedStorageUrl/;

describe('route authorization hardening', () => {
  it('keeps sensitive route handlers behind explicit route-level authorization guards', () => {
    const unguardedRoutes = guardedRouteFiles.flatMap((routeFile) =>
      readRouteSource(routeFile)
        .split('\n')
        .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
        .filter(({ line }) => routeCallPattern.test(line))
        .filter(({ line }) => !explicitGuardPattern.test(line))
        .map(({ line, lineNumber }) => `${routeFile}:${lineNumber} ${line}`),
    );

    assert.deepEqual(unguardedRoutes, []);
  });

  it('resolves attendance substitutions before broad attendance view defaults', () => {
    assert.equal(
      resolvePermissionForPath('/api/v1/attendance/substitutions', 'POST'),
      P.attendanceSubstituteManage,
    );
    assert.equal(
      resolvePermissionForPath('/api/v1/attendance/substitutions/abc/cancel', 'PATCH'),
      P.attendanceSubstituteManage,
    );
  });

  it('resolves attendance mutation routes to mutation permissions', () => {
    assert.deepEqual(
      resolvePermissionForPath('/api/v1/attendance/sessions', 'POST'),
      [P.attendanceCreate, P.attendanceEdit],
    );
    assert.equal(resolvePermissionForPath('/api/v1/attendance/sessions/abc', 'PATCH'), P.attendanceEdit);
    assert.equal(resolvePermissionForPath('/api/v1/attendance/legacy/records/abc/override', 'PATCH'), P.attendanceEdit);
    assert.equal(resolvePermissionForPath('/api/v1/attendance-approval/sessions/abc/approve', 'POST'), P.attendanceEdit);
  });

  it('resolves uploads, notifications, analytics, face, and recognition routes explicitly', () => {
    assert.deepEqual(resolvePermissionForPath('/api/v1/recognition/match', 'POST'), [P.attendanceCreate, P.attendanceEdit]);
    assert.deepEqual(resolvePermissionForPath('/api/v1/analytics', 'GET'), [P.dashboardOverview, P.reportsView]);
    assert.equal(resolvePermissionForPath('/api/v1/uploads/branding', 'POST'), P.settingsAccess);
    assert.equal(resolvePermissionForPath('/api/v1/notifications/send', 'POST'), P.settingsAccess);
    assert.deepEqual(resolvePermissionForPath('/api/v1/faces/enroll', 'POST'), [P.studentDocumentCreate, P.studentEdit]);
  });
});
