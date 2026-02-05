import test from 'node:test';
import assert from 'node:assert/strict';

import type { StudentAttendanceStatus } from '@prisma/client';
import { __attendanceP1Internals } from '../../attendanceP1.service';

test('normalizeDate stores the same day in UTC', () => {
  const date = __attendanceP1Internals.normalizeDate('2026-02-05T23:59:59+05:30');
  assert.equal(date.toISOString(), '2026-02-05T00:00:00.000Z');
});

test('endOfDay returns UTC day boundary', () => {
  const start = new Date('2026-02-05T00:00:00.000Z');
  const value = __attendanceP1Internals.endOfDay(start);
  assert.equal(value.toISOString(), '2026-02-05T23:59:59.999Z');
});

test('isSameRecordSet ignores order and trims remarks', () => {
  const left: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }> = [
    { studentId: 'b', status: 'ABSENT', remarks: ' sick ' },
    { studentId: 'a', status: 'PRESENT', remarks: '' },
  ];
  const right: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }> = [
    { studentId: 'a', status: 'PRESENT', remarks: null },
    { studentId: 'b', status: 'ABSENT', remarks: 'sick' },
  ];

  assert.equal(__attendanceP1Internals.isSameRecordSet(left, right), true);
});

test('isSameRecordSet detects status mismatch', () => {
  const left: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }> = [
    { studentId: 'a', status: 'PRESENT' },
  ];
  const right: Array<{ studentId: string; status: StudentAttendanceStatus; remarks?: string | null }> = [
    { studentId: 'a', status: 'ABSENT' },
  ];

  assert.equal(__attendanceP1Internals.isSameRecordSet(left, right), false);
});
