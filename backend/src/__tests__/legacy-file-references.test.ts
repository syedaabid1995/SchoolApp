import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { env } from '../config/env';
import { encryptStudentSensitiveFields } from '../modules/students/utils/student-sensitive-fields';
import {
  LEGACY_FILE_TARGETS,
  buildLegacyMigrationObjectKey,
  buildLegacyReferenceWhere,
  classifyFileReference,
  maskReference,
  prepareLegacyFileRecord,
  prepareLegacyFileUpdateData,
  prepareLegacyFileUpdateValue,
  referenceNeedsMigration,
  resolveLegacyReferenceToLocalFile,
  safeRelativePathFromLegacyReference,
} from '../services/legacyFileReferences.service';
import { isEncryptedSensitiveField } from '../utils/sensitiveFieldCrypto';

const TEST_KEY = 'legacy_file_reference_key_32_chars_minimum';

const withSensitiveEncryptionEnv = <T>(
  enabled: boolean,
  callback: () => T,
) => {
  const originalEnabled = env.SENSITIVE_FIELD_ENCRYPTION_ENABLED;
  const originalKey = env.SENSITIVE_FIELD_ENCRYPTION_KEY;

  try {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = enabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = TEST_KEY;
    return callback();
  } finally {
    env.SENSITIVE_FIELD_ENCRYPTION_ENABLED = originalEnabled;
    env.SENSITIVE_FIELD_ENCRYPTION_KEY = originalKey;
  }
};

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

test('legacy student file records decrypt encrypted scalar document refs before classification', () => {
  withSensitiveEncryptionEnv(true, () => {
    const studentTarget = LEGACY_FILE_TARGETS.find((target) => target.delegateName === 'student');
    assert.ok(studentTarget);

    const stored = encryptStudentSensitiveFields({
      id: 'student-1',
      schoolId: 'school-1',
      docBirthCert: '/uploads/schools/school-1/birth.pdf',
      docAadhaar: '/uploads/schools/school-1/aadhaar.pdf',
    });
    assert.equal(isEncryptedSensitiveField(stored.docBirthCert), true);

    const prepared = prepareLegacyFileRecord(studentTarget, stored);

    assert.equal(classifyFileReference(prepared.docBirthCert), 'legacy-upload-url');
    assert.equal(classifyFileReference(prepared.docAadhaar), 'legacy-upload-url');
  });
});

test('legacy student migration scans broad rows and re-encrypts migrated scalar document refs', () => {
  withSensitiveEncryptionEnv(true, () => {
    const studentTarget = LEGACY_FILE_TARGETS.find((target) => target.delegateName === 'student');
    assert.ok(studentTarget);

    assert.deepEqual(
      buildLegacyReferenceWhere(studentTarget, 'school-1', { scanEncryptedStudentFields: true }),
      { schoolId: 'school-1' },
    );

    const updatedBirthCert = prepareLegacyFileUpdateValue(
      studentTarget,
      'docBirthCert',
      'local://schools/school-1/uploads/birth.pdf',
    );
    const updatedAadhaar = prepareLegacyFileUpdateValue(
      studentTarget,
      'docAadhaar',
      'local://schools/school-1/uploads/aadhaar.pdf',
    );
    const updatedAadhaarData = prepareLegacyFileUpdateData(
      studentTarget,
      'docAadhaar',
      'local://schools/school-1/uploads/aadhaar.pdf',
    );

    assert.equal(isEncryptedSensitiveField(updatedBirthCert), true);
    assert.equal(isEncryptedSensitiveField(updatedAadhaar), true);
    assert.equal(isEncryptedSensitiveField(updatedAadhaarData.docAadhaar), true);
    assert.match(String(updatedAadhaarData.docAadhaarHash), /^sfh1:/);
  });
});
