import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentRepository } from '../student.repository';

test('student list include preserves parent and enrollment relationships', () => {
  const include = StudentRepository.listInclude();

  assert.equal(include.enrollments.take, 1);
  assert.deepEqual(include.enrollments.orderBy, { enrolledAt: 'desc' });
  assert.ok(include.parentLinks.include.parent.select.email);
});

test('student detail include preserves document, marks, and status relationships', () => {
  const include = StudentRepository.detailInclude();

  assert.deepEqual(include.documents.orderBy, { createdAt: 'desc' });
  assert.deepEqual(include.timelines.orderBy, { timelineDate: 'desc' });
  assert.ok(include.marks.include.examPaper.include.subject.select.code);
  assert.deepEqual(include.statusEvents.orderBy, { changedAt: 'desc' });
});
