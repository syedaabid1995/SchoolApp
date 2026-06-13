import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { prisma } from '../../../config/db';
import { bulkEntriesSchema, listEntriesSchema } from '../../../controllers/timetable.controller';
import { deleteTimetableEntry, updateTimetableEntry } from '../../../services/timetable.service';
import { attendancePeriodCreateSchema } from '../../../validations/attendance.validation';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const SECTION_ID = '44444444-4444-4444-8444-444444444444';
const PERIOD_ID = '55555555-5555-4555-8555-555555555555';
const SUBJECT_ID = '66666666-6666-4666-8666-666666666666';
const TEACHER_ID = '77777777-7777-4777-8777-777777777777';
const CLASS_ROOM_ID = '88888888-8888-4888-8888-888888888888';
const ENTRY_ID = '99999999-9999-4999-8999-999999999999';

const replaceMethod = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) => {
  const original = target[key];
  (target as any)[key] = replacement;
  return () => {
    (target as any)[key] = original;
  };
};

test('modern timetable validators accept day 7 and optional classRoomId', () => {
  const payload = bulkEntriesSchema.parse({
    schoolId: SCHOOL_ID,
    timetableVersionId: VERSION_ID,
    entries: [
      {
        classId: CLASS_ID,
        sectionId: SECTION_ID,
        attendancePeriodId: PERIOD_ID,
        dayOfWeek: 7,
        subjectId: SUBJECT_ID,
        teacherId: TEACHER_ID,
        classRoomId: CLASS_ROOM_ID,
        room: 'Room 101',
      },
    ],
  });

  assert.equal(payload.entries[0].dayOfWeek, 7);
  assert.equal(payload.entries[0].classRoomId, CLASS_ROOM_ID);
  assert.equal(listEntriesSchema.parse({ schoolId: SCHOOL_ID, timetableVersionId: VERSION_ID, dayOfWeek: '7' }).dayOfWeek, 7);
});

test('attendance period validation accepts TimePeriodType values', () => {
  const payload = attendancePeriodCreateSchema.parse({
    type: 'BREAK',
    name: 'Short Break',
    startTime: '10:30',
    endTime: '10:45',
    schoolId: SCHOOL_ID,
  });

  assert.equal(payload.type, 'BREAK');
});

test('timetable schema correction migration includes modern storage corrections', () => {
  const migrationSql = readFileSync(
    join(process.cwd(), 'prisma/migrations/20260613143000_timetable_schema_corrections/migration.sql'),
    'utf8',
  );

  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS "type" "TimePeriodType" NOT NULL DEFAULT 'CLASS_TIME'/);
  assert.match(migrationSql, /ADD COLUMN IF NOT EXISTS "class_room_id" UUID/);
  assert.match(migrationSql, /UPDATE "timetable_entries" AS te/);
  assert.match(migrationSql, /REFERENCES "class_rooms"\("id"\)/);
});

test('modern timetable entry updates reject published versions', async () => {
  const restoreFindFirst = replaceMethod(prisma.timetableEntry, 'findFirst', (async () => ({
    id: ENTRY_ID,
    schoolId: SCHOOL_ID,
    timetableVersionId: VERSION_ID,
    academicYearId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    attendancePeriodId: PERIOD_ID,
    dayOfWeek: 1,
    subjectId: SUBJECT_ID,
    teacherId: TEACHER_ID,
    classRoomId: CLASS_ROOM_ID,
    room: null,
    isActive: true,
    version: { id: VERSION_ID, status: 'PUBLISHED', academicYearId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  })) as any);

  try {
    await assert.rejects(
      () =>
        updateTimetableEntry({
          schoolId: SCHOOL_ID,
          timetableEntryId: ENTRY_ID,
          entry: { dayOfWeek: 2 },
          actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          actorRole: 'SCHOOL_ADMIN',
        }),
      /Only draft timetable entries can be edited/,
    );
  } finally {
    restoreFindFirst();
  }
});

test('modern timetable entry deletes reject published versions', async () => {
  const restoreFindFirst = replaceMethod(prisma.timetableEntry, 'findFirst', (async () => ({
    id: ENTRY_ID,
    schoolId: SCHOOL_ID,
    timetableVersionId: VERSION_ID,
    academicYearId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    attendancePeriodId: PERIOD_ID,
    dayOfWeek: 1,
    subjectId: SUBJECT_ID,
    teacherId: TEACHER_ID,
    classRoomId: CLASS_ROOM_ID,
    room: null,
    isActive: true,
    version: { status: 'PUBLISHED' },
  })) as any);

  try {
    await assert.rejects(
      () =>
        deleteTimetableEntry({
          schoolId: SCHOOL_ID,
          timetableEntryId: ENTRY_ID,
          actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          actorRole: 'SCHOOL_ADMIN',
        }),
      /Only draft timetable entries can be deleted/,
    );
  } finally {
    restoreFindFirst();
  }
});
