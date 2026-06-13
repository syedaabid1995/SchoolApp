import assert from 'node:assert/strict';
import test from 'node:test';

import { AttendanceCompatibilityService } from '../attendance-compatibility.service';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_SCHOOL_ID = '22222222-2222-4222-8222-222222222222';
const ACADEMIC_SESSION_ID = '33333333-3333-4333-8333-333333333333';
const CLASS_ID = '44444444-4444-4444-8444-444444444444';
const SECTION_ID = '55555555-5555-4555-8555-555555555555';
const ACTOR_ID = '66666666-6666-4666-8666-666666666666';
const STUDENT_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_STUDENT_ID = '88888888-8888-4888-8888-888888888888';
const DATE = '2026-02-05';

type SessionRow = {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string | null;
  date: Date;
  createdById: string;
  status: string;
};

type RecordRow = {
  id: string;
  sessionId: string;
  studentId: string;
  status: string;
  remarks: string | null;
};

const sameDate = (left: Date, right: Date) => left.getTime() === right.getTime();

const createPrisma = (seed: { sessions?: SessionRow[]; records?: RecordRow[] } = {}) => {
  const sessions = [...(seed.sessions ?? [])];
  const records = [...(seed.records ?? [])];
  let sessionSequence = sessions.length;
  let recordSequence = records.length;

  const tx = {
    studentAttendanceSession: {
      findFirst: async ({ where }: any) =>
        sessions.find(
          (session) =>
            session.schoolId === where.schoolId &&
            session.classId === where.classId &&
            session.sectionId === where.sectionId &&
            sameDate(session.date, where.date),
        ) ?? null,
      create: async ({ data }: any) => {
        sessionSequence += 1;
        const session = { id: `session-${sessionSequence}`, ...data };
        sessions.push(session);
        return session;
      },
    },
    studentAttendanceRecord: {
      findMany: async ({ where }: any) =>
        records
          .filter((record) => {
            const inStudentIds = Array.isArray(where.studentId?.in) ? where.studentId.in.includes(record.studentId) : true;
            return record.sessionId === where.sessionId && inStudentIds;
          })
          .map((record) => ({ studentId: record.studentId })),
      upsert: async ({ where, create, update }: any) => {
        const key = where.sessionId_studentId;
        const existing = records.find((record) => record.sessionId === key.sessionId && record.studentId === key.studentId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }

        recordSequence += 1;
        const record = { id: `record-${recordSequence}`, ...create };
        records.push(record);
        return record;
      },
    },
  };

  return {
    sessions,
    records,
    prisma: {
      $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    },
  };
};

const createService = (seed: { sessions?: SessionRow[]; records?: RecordRow[] } = {}) => {
  const context = createPrisma(seed);
  return { ...context, service: new AttendanceCompatibilityService(context.prisma as any) };
};

const writePayload = (overrides: Partial<Parameters<AttendanceCompatibilityService['writeStudentAttendance']>[0]> = {}) => ({
  schoolId: SCHOOL_ID,
  academicSessionId: ACADEMIC_SESSION_ID,
  classId: CLASS_ID,
  sectionId: SECTION_ID,
  attendanceDate: DATE,
  actorId: ACTOR_ID,
  records: [
    {
      studentId: STUDENT_ID,
      status: 'PRESENT' as const,
      note: 'On time',
    },
  ],
  ...overrides,
});

test('AttendanceCompatibilityService creates a P1 session when one is missing', async () => {
  const { service, sessions } = createService();

  const result = await service.writeStudentAttendance(writePayload());

  assert.equal(result.createdSession, true);
  assert.equal(sessions.length, 1);
  assert.equal(result.session.schoolId, SCHOOL_ID);
  assert.equal(result.session.classId, CLASS_ID);
  assert.equal(result.session.sectionId, SECTION_ID);
  assert.equal(result.sessionKey.academicSessionId, ACADEMIC_SESSION_ID);
  assert.equal(result.sessionKey.attendanceDate.toISOString(), '2026-02-05T00:00:00.000Z');
});

test('AttendanceCompatibilityService reuses an existing P1 session for the same tenant and class-section date', async () => {
  const existingSession = {
    id: 'existing-session',
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    date: new Date('2026-02-05T00:00:00.000Z'),
    createdById: ACTOR_ID,
    status: 'DRAFT',
  };
  const { service, sessions } = createService({ sessions: [existingSession] });

  const result = await service.writeStudentAttendance(writePayload());

  assert.equal(result.createdSession, false);
  assert.equal(result.session.id, existingSession.id);
  assert.equal(sessions.length, 1);
});

test('AttendanceCompatibilityService creates records and maps note to remarks', async () => {
  const { service, records } = createService();

  const result = await service.writeStudentAttendance(
    writePayload({
      records: [
        { studentId: STUDENT_ID, status: 'PRESENT', note: 'On time' },
        { studentId: OTHER_STUDENT_ID, status: 'ABSENT', note: null },
      ],
    }),
  );

  assert.equal(result.createdRecords, 2);
  assert.equal(result.updatedRecords, 0);
  assert.equal(result.saved, 2);
  assert.equal(records.length, 2);
  assert.equal(records[0].remarks, 'On time');
  assert.equal(records[1].remarks, null);
});

test('AttendanceCompatibilityService updates existing records with upsert behavior', async () => {
  const existingSession = {
    id: 'existing-session',
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    date: new Date('2026-02-05T00:00:00.000Z'),
    createdById: ACTOR_ID,
    status: 'DRAFT',
  };
  const existingRecord = {
    id: 'existing-record',
    sessionId: existingSession.id,
    studentId: STUDENT_ID,
    status: 'ABSENT',
    remarks: 'Was absent',
  };
  const { service, records } = createService({ sessions: [existingSession], records: [existingRecord] });

  const result = await service.writeStudentAttendance(
    writePayload({
      records: [{ studentId: STUDENT_ID, status: 'HALF_DAY', note: 'Returned early' }],
    }),
  );

  assert.equal(result.createdRecords, 0);
  assert.equal(result.updatedRecords, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'HALF_DAY');
  assert.equal(records[0].remarks, 'Returned early');
});

test('AttendanceCompatibilityService does not reuse sessions from another school', async () => {
  const otherSchoolSession = {
    id: 'other-school-session',
    schoolId: OTHER_SCHOOL_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    date: new Date('2026-02-05T00:00:00.000Z'),
    createdById: ACTOR_ID,
    status: 'DRAFT',
  };
  const { service, sessions } = createService({ sessions: [otherSchoolSession] });

  const result = await service.writeStudentAttendance(writePayload());

  assert.equal(result.createdSession, true);
  assert.equal(result.session.schoolId, SCHOOL_ID);
  assert.equal(sessions.length, 2);
  assert.ok(sessions.some((session) => session.id === otherSchoolSession.id));
});
