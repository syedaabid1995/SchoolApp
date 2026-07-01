import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildLegacyMigrationObjectKey,
  classifyFileReference,
  maskReference,
  referenceNeedsMigration,
  resolveLegacyReferenceToLocalFile,
  safeRelativePathFromLegacyReference,
} from '../services/legacyFileReferences.service';

test('legacy reference classifier separates migrated refs from legacy local refs', () => {
  assert.equal(classifyFileReference('s3://academify-private/schools/a/uploads/file.pdf'), 'storage-s3');
  assert.equal(classifyFileReference('local://schools/a/uploads/file.pdf'), 'storage-local');
  assert.equal(classifyFileReference('/uploads/schools/a/uploads/file.pdf'), 'legacy-upload-url');
  assert.equal(classifyFileReference('uploads/schools/a/uploads/file.pdf'), 'legacy-relative-upload');
  assert.equal(classifyFileReference('/srv/app/backend/uploads/schools/a/uploads/file.pdf'), 'legacy-local-path');
  assert.equal(referenceNeedsMigration('local://schools/a/uploads/file.pdf'), false);
  assert.equal(referenceNeedsMigration('/uploads/schools/a/uploads/file.pdf'), true);
});

test('legacy reference masking strips query strings and truncates long values', () => {
  const masked = maskReference('/uploads/schools/school-a/uploads/report.pdf?signature=secret-value&token=hidden');
  assert.doesNotMatch(masked, /secret-value|token=hidden/);
  assert.match(masked, /^\/uploads\/schools\//);
  assert.match(masked, /len=/);
});

test('legacy relative path extraction blocks traversal attempts', () => {
  assert.equal(safeRelativePathFromLegacyReference('/uploads/schools/a/file.pdf'), 'schools/a/file.pdf');
  assert.equal(safeRelativePathFromLegacyReference('/uploads/../.env'), null);
  assert.equal(safeRelativePathFromLegacyReference('/uploads/%2e%2e/.env'), null);
  assert.equal(safeRelativePathFromLegacyReference('backend/uploads/schools/a/../../secret.txt'), null);
});

test('legacy file resolver only reads from supplied allowed roots', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'academify-legacy-ref-'));
  try {
    const relative = 'schools/school-a/uploads/file.txt';
    const filePath = path.join(root, relative);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, 'ok');

    const resolved = await resolveLegacyReferenceToLocalFile(`/uploads/${relative}`, [root]);
    assert.equal(resolved?.path, filePath);
    assert.equal(resolved?.relativePath, relative);

    const blocked = await resolveLegacyReferenceToLocalFile('/uploads/../../etc/passwd', [root]);
    assert.equal(blocked, null);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('legacy migration object keys are tenant scoped and do not include raw filenames', () => {
  const key = buildLegacyMigrationObjectKey({
    schoolId: '11111111-1111-4111-8111-111111111111',
    category: 'uploads',
    model: 'StudentDocument',
    field: 'url',
    recordId: '22222222-2222-4222-8222-222222222222',
    legacyReference: '/uploads/schools/11111111-1111-4111-8111-111111111111/documents/Aadhaar Card.pdf',
  });

  assert.match(key, /^schools\/11111111-1111-4111-8111-111111111111\/uploads\/legacy\/StudentDocument\/url\//);
  assert.match(key, /\.pdf$/);
  assert.doesNotMatch(key, /Aadhaar|Card/);
});
