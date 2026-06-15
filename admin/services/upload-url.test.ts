import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStudentPhotoAsset,
  resolveUploadUrl,
  signedUploadUrl,
} from './upload-url';

const s3Url = (key: string) => `s3://school-app-test/${key}`;

test('signedUploadUrl uses type and record id instead of a raw key', () => {
  const url = signedUploadUrl({ type: 'student-document', id: 'document-1' });

  assert.equal(url, '/api/proxy/uploads/signed?type=student-document&id=document-1');
  assert.doesNotMatch(url ?? '', /[?&]key=/);
});

test('student documents resolve through record-backed signing', () => {
  const url = resolveUploadUrl(
    s3Url('schools/school-1/students/student-1/aadhaar.pdf'),
    { type: 'student-document', id: 'document-1' },
    'https://api.example.test/api/v1',
  );

  assert.equal(url, '/api/proxy/uploads/signed?type=student-document&id=document-1');
});

test('staff documents resolve through record-backed signing', () => {
  const url = resolveUploadUrl(
    '/uploads/schools/school-1/staff/staff-1/pan.pdf',
    { type: 'staff-document', id: 'staff-document-1' },
    'https://api.example.test/api/v1',
  );

  assert.equal(url, '/api/proxy/uploads/signed?type=staff-document&id=staff-document-1');
});

test('attendance evidence resolves through record-backed signing', () => {
  const url = resolveUploadUrl(
    '/uploads/schools/school-1/attendance/evidence.png',
    { type: 'attendance-evidence', id: 'evidence-1' },
    'https://api.example.test/api/v1',
  );

  assert.equal(url, '/api/proxy/uploads/signed?type=attendance-evidence&id=evidence-1');
});

test('object storage URLs are not exposed when no database asset id is available', () => {
  const url = resolveUploadUrl(s3Url('schools/school-1/private.pdf'), null, 'https://api.example.test/api/v1');

  assert.equal(url, null);
});

test('student photo asset uses StudentPhoto id when available', () => {
  const asset = getStudentPhotoAsset({
    id: 'student-1',
    photoUrl: s3Url('schools/school-1/students/student-1/photo.png'),
    photos: [{ id: 'photo-1', url: s3Url('schools/school-1/students/student-1/photo.png') }],
  });

  assert.equal(asset.value, s3Url('schools/school-1/students/student-1/photo.png'));
  assert.deepEqual(asset.asset, { type: 'student-photo', id: 'photo-1' });
});

test('student photo asset falls back to student id for legacy scalar photoUrl', () => {
  const asset = getStudentPhotoAsset({
    id: 'student-1',
    photoUrl: s3Url('schools/school-1/students/student-1/photo.png'),
  });

  assert.deepEqual(asset.asset, { type: 'student-photo', id: 'student-1' });
});
