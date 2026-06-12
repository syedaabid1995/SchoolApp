import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const repoRoot = path.resolve(__dirname, '../../..');
const appSource = fs.readFileSync(path.join(repoRoot, 'backend/src/app.ts'), 'utf8');

const importMap = new Map(
  [...appSource.matchAll(/import \{([^}]+)\} from '\.\/routes\/([^']+)';/g)]
    .flatMap((match) => {
      const routeFile = `backend/src/routes/${match[2]}.ts`;
      return match[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [name, routeFile] as const);
    }),
);

const mountedRouters = [...appSource.matchAll(/app\.use\('([^']+)',\s*([A-Za-z0-9_]+)\)/g)]
  .map((match) => ({ mountPath: match[1], routerName: match[2], routeFile: importMap.get(match[2]) }))
  .filter((route) => route.routerName !== 'express');

const publicMountPrefixes = [
  '/api/v1/public',
  '/api/v1/auth',
  '/api/auth',
  '/api/v1/otp',
  '/uploads',
];

const categorizeRouteSource = (mountPath: string, routeFile?: string) => {
  const categories = new Set<string>();
  if (publicMountPrefixes.some((prefix) => mountPath.startsWith(prefix))) {
    categories.add('Public');
  }

  if (!routeFile) return categories;

  const source = fs.readFileSync(path.join(repoRoot, routeFile), 'utf8');
  if (source.includes('authMiddleware')) categories.add('Authenticated');
  if (source.includes('requirePermission(') || source.includes('AuthorizationService.')) {
    categories.add('Permission Protected');
  }
  if (source.includes('requireSuperAdmin') || source.includes('superAdminGuard')) {
    categories.add('Super Admin Protected');
  }

  return categories;
};

describe('authorization route coverage', () => {
  it('categorizes every app.ts route mount as public, authenticated, permission protected, or super-admin protected', () => {
    const uncategorized = mountedRouters
      .map((route) => ({ ...route, categories: categorizeRouteSource(route.mountPath, route.routeFile) }))
      .filter((route) => route.categories.size === 0)
      .map((route) => `${route.mountPath} -> ${route.routerName}`);

    assert.deepEqual(uncategorized, []);
  });
});
