import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const backendRoot = process.cwd();
const scanRoots = ['src', 'scripts'].map((entry) => join(backendRoot, entry));
const ignoredSegments = new Set(['dist', 'node_modules', '__tests__']);
const legacyDelegatePattern = /\b(?:prisma|tx|db|this\.db)\.(studentAttendance|classRoutine|timePeriod)\b/g;

const productionFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredSegments.has(entry)) continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...productionFiles(path));
      continue;
    }
    if (path.endsWith('.test.ts') || path.endsWith('.spec.ts') || !path.endsWith('.ts')) continue;
    files.push(path);
  }

  return files;
};

test('production code does not access retired legacy attendance or timetable tables', () => {
  const violations: string[] = [];

  for (const file of scanRoots.flatMap(productionFiles)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(legacyDelegatePattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      violations.push(`${relative(backendRoot, file)}:${line} ${match[0]}`);
    }
  }

  assert.deepEqual(violations, []);
});
