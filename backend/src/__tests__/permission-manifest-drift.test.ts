import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { PermissionCodes } from '../permissions/permission-manifest';

const repoRoot = path.resolve(__dirname, '../../..');
const rootManifestPath = path.join(repoRoot, 'shared/permissions/permission-manifest.ts');
const backendManifestPath = path.join(repoRoot, 'backend/src/permissions/permission-manifest.ts');
const adminManifestPath = path.join(repoRoot, 'admin/config/permission-manifest.ts');
const flutterConstantsPath = path.join(repoRoot, 'school-flutter/lib/core/permissions/permission_codes.dart');

const migratedPermissionSources = [
  'backend/src/utils/employeePermissions.ts',
  'backend/src/middlewares/auth.middleware.ts',
  'backend/src/routes/attendance.routes.ts',
  'backend/src/routes/attendanceSummary.routes.ts',
  'backend/src/controllers/report.controller.ts',
  'backend/src/controllers/dataCompliance.controller.ts',
  'backend/src/services/aiAssistant.service.ts',
  'backend/src/services/aiEntityRegistry.service.ts',
  'admin/config/employee-permissions.ts',
  'admin/config/plan-module-permissions.ts',
  'school-flutter/lib/core/permissions/mobile_module.dart',
];

const read = (filePath: string) => fs.readFileSync(filePath, 'utf8');

const parseTsPermissionCodes = (source: string) =>
  new Map([...source.matchAll(/^  ([A-Za-z0-9_]+): '([^']+)',$/gm)].map((match) => [match[1], match[2]]));

const parseDartPermissionCodes = (source: string) =>
  new Map([...source.matchAll(/^  static const ([A-Za-z0-9_]+) = '([^']+)';$/gm)].map((match) => [match[1], match[2]]));

const permissionCodeValues = new Set<string>(Object.values(PermissionCodes));

describe('permission manifest drift', () => {
  it('keeps the backend adapter synchronized with the root shared manifest', () => {
    assert.deepEqual(parseTsPermissionCodes(read(backendManifestPath)), parseTsPermissionCodes(read(rootManifestPath)));
  });

  it('keeps the admin adapter synchronized with the root shared manifest', () => {
    assert.deepEqual(parseTsPermissionCodes(read(adminManifestPath)), parseTsPermissionCodes(read(rootManifestPath)));
  });

  it('keeps generated Flutter permission constants synchronized with the root shared manifest', () => {
    assert.deepEqual(parseDartPermissionCodes(read(flutterConstantsPath)), parseTsPermissionCodes(read(rootManifestPath)));
  });

  it('does not reintroduce raw permission string literals in migrated sources', () => {
    const violations: string[] = [];
    const permissionLiteralPattern = /['"`]([a-z][a-z0-9]*(?:\.[a-z0-9_-]+)+)['"`]/g;

    for (const sourcePath of migratedPermissionSources) {
      const absolutePath = path.join(repoRoot, sourcePath);
      const source = read(absolutePath);
      for (const match of source.matchAll(permissionLiteralPattern)) {
        const literal = match[1];
        if (!permissionCodeValues.has(literal)) continue;
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`${sourcePath}:${line} uses raw permission literal "${literal}"`);
      }
    }

    assert.deepEqual(violations, []);
  });
});
