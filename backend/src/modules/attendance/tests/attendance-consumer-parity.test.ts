import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../config/db';
import { listSessionRecords } from '../../../controllers/attendance.controller';
import { getParentAttendance } from '../../../controllers/parentPortal.controller';
import { getAttendanceRate, getWeeklyAnalytics } from '../../../services/analytics.service';
import { getAttendanceSummary as getP1AttendanceSummary } from '../../../services/attendanceP1.service';
import { getReportData } from '../../../services/report.service';
import { attendanceReadService } from '../services/attendance-read.service';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const SECTION_ID = '44444444-4444-4444-8444-444444444444';
const SESSION_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';
const PARENT_ID = '77777777-7777-4777-8777-777777777777';
const DATE = '2026-02-05';

const canonicalStudentRecord = (overrides: Record<string, unknown> = {}) => ({
  source: 'period-attendance',
  sourceId: 'record-1',
  schoolId: SCHOOL_ID,
  studentId: STUDENT_ID,
  classId: CLASS_ID,
  sectionId: SECTION_ID,
  academicSessionId: null,
  date: DATE,
  status: 'PRESENT',
  note: null,
  sessionId: SESSION_ID,
  periodId: null,
  timetableEntryId: null,
  ...overrides,
});

const replaceMethod = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) => {
  const original = target[key];
  (target as any)[key] = replacement;
  return () => {
    (target as any)[key] = original;
  };
};

test('analytics consumers preserve attendance rate and weekly response shapes through AttendanceReadService', async () => {
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async () => [
    canonicalStudentRecord({ sourceId: 'r1', status: 'PRESENT' }),
    canonicalStudentRecord({ sourceId: 'r2', status: 'LATE' }),
    canonicalStudentRecord({ sourceId: 'r3', status: 'ABSENT' }),
  ]) as any);
  const restoreSessions = replaceMethod(prisma.attendanceSession, 'findMany', (async () => [
    { id: SESSION_ID, date: new Date(`${DATE}T00:00:00.000Z`) },
  ]) as any);

  try {
    assert.equal(await getAttendanceRate(SCHOOL_ID), 66.67);
    assert.deepEqual(await getWeeklyAnalytics(SCHOOL_ID), [
      { date: new Date(`${DATE}T00:00:00.000Z`), attendanceRate: 67 },
    ]);
  } finally {
    restoreRead();
    restoreSessions();
  }
});

test('student daily report maps canonical attendance back to the existing report row shape', async () => {
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async () => [
    canonicalStudentRecord({ source: 'student-attendance', sourceId: 'sa-1', status: 'LATE' }),
  ]) as any);
  const restoreStudents = replaceMethod(prisma.student, 'findMany', (async () => [
    { id: STUDENT_ID, admissionNo: 'ADM-1', firstName: 'Asha', lastName: 'Rao', fullName: null },
  ]) as any);
  const restoreClasses = replaceMethod(prisma.class, 'findMany', (async () => [
    { id: CLASS_ID, name: 'Grade 4' },
  ]) as any);
  const restoreSections = replaceMethod(prisma.section, 'findMany', (async () => [
    { id: SECTION_ID, name: 'A' },
  ]) as any);

  try {
    const result = await getReportData('attendance.students.daily', {
      schoolId: SCHOOL_ID,
      page: 1,
      pageSize: 25,
    });

    assert.equal(result.total, 1);
    assert.deepEqual(result.rows, [
      {
        date: new Date(`${DATE}T00:00:00.000Z`),
        admissionNo: 'ADM-1',
        studentName: 'Asha Rao',
        class: 'Grade 4',
        section: 'A',
        status: 'LATE',
      },
    ]);
  } finally {
    restoreRead();
    restoreStudents();
    restoreClasses();
    restoreSections();
  }
});

test('P1 attendance summary preserves session totals and session list shape through AttendanceReadService', async () => {
  const restoreOverview = replaceMethod(attendanceReadService, 'getSessionAttendanceOverview', (async () => [
    {
      id: SESSION_ID,
      schoolId: SCHOOL_ID,
      date: new Date(`${DATE}T00:00:00.000Z`),
      status: 'LOCKED',
      classId: CLASS_ID,
      className: 'Grade 4',
      sectionId: SECTION_ID,
      sectionName: 'A',
      lockedAt: null,
      lockReason: null,
      recordCount: 2,
      records: [
        canonicalStudentRecord({ source: 'session-attendance', sourceId: 'sr-1', status: 'PRESENT' }),
        canonicalStudentRecord({ source: 'session-attendance', sourceId: 'sr-2', status: 'ABSENT' }),
      ],
    },
  ]) as any);

  try {
    const result = await getP1AttendanceSummary({ schoolId: SCHOOL_ID, date: DATE, actorRole: 'SCHOOL_ADMIN' });

    assert.deepEqual(result.totals, { sessions: 1, records: 2, present: 1, absent: 1, late: 0, halfDay: 0 });
    assert.deepEqual(result.sessions, [
      {
        id: SESSION_ID,
        date: new Date(`${DATE}T00:00:00.000Z`),
        status: 'LOCKED',
        classId: CLASS_ID,
        className: 'Grade 4',
        sectionId: SECTION_ID,
        sectionName: 'A',
        lockedAt: null,
        lockReason: null,
        recordCount: 2,
      },
    ]);
  } finally {
    restoreOverview();
  }
});

test('parent attendance calendar preserves status precedence and remarks through AttendanceReadService', async () => {
  const restoreParents = replaceMethod(prisma.parentProfile, 'findMany', (async () => [{ id: PARENT_ID }]) as any);
  const restoreLinks = replaceMethod(prisma.studentParent, 'findMany', (async () => [
    {
      studentId: STUDENT_ID,
      parentId: PARENT_ID,
      student: {
        id: STUDENT_ID,
        firstName: 'Asha',
        lastName: 'Rao',
        admissionNo: 'ADM-1',
        schoolId: SCHOOL_ID,
        classId: CLASS_ID,
        sectionId: SECTION_ID,
        class: { id: CLASS_ID, name: 'Grade 4', academicYearId: null },
        section: { id: SECTION_ID, name: 'A' },
        school: { id: SCHOOL_ID, name: 'Demo School' },
      },
    },
  ]) as any);
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async () => [
    canonicalStudentRecord({ source: 'session-attendance', sourceId: 'sr-1', status: 'PRESENT', note: null }),
    canonicalStudentRecord({ source: 'session-attendance', sourceId: 'sr-2', status: 'ABSENT', note: 'Sick leave' }),
  ]) as any);

  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  try {
    await getParentAttendance({ auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: { month: '2026-02' } } as any, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      calendar: [{ date: DATE, status: 'Absent', remark: 'Sick leave' }],
      presentDays: 0,
      absentDays: 1,
    });
  } finally {
    restoreParents();
    restoreLinks();
    restoreRead();
  }
});

test('legacy session record endpoint preserves raw response shape through AttendanceReadService', async () => {
  const rawRecord = {
    id: 'attendance-record-1',
    sessionId: SESSION_ID,
    studentId: STUDENT_ID,
    status: 'PRESENT',
    capturedAt: new Date(`${DATE}T08:00:00.000Z`),
    student: { id: STUDENT_ID, admissionNo: 'ADM-1' },
  };
  const restoreSession = replaceMethod(prisma.attendanceSession, 'findFirst', (async () => ({ id: SESSION_ID })) as any);
  const restoreRecords = replaceMethod(attendanceReadService, 'getPeriodSessionRecords', (async () => [rawRecord]) as any);
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  try {
    await listSessionRecords(
      { auth: { userId: USER_ID, schoolId: SCHOOL_ID }, params: { sessionId: SESSION_ID }, query: { schoolId: SCHOOL_ID } } as any,
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [rawRecord]);
  } finally {
    restoreSession();
    restoreRecords();
  }
});
