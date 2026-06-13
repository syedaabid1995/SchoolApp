import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '../../../middlewares/error.middleware';
import { ModernTimetableGeneratorService } from '../services/modern-timetable-generator.service';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const VERSION_ID = '22222222-2222-4222-8222-222222222222';
const ACADEMIC_YEAR_ID = '33333333-3333-4333-8333-333333333333';
const CLASS_ID = '44444444-4444-4444-8444-444444444444';
const SECTION_ID = '55555555-5555-4555-8555-555555555555';
const ROOM_ID = '66666666-6666-4666-8666-666666666666';
const OTHER_CLASS_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_SECTION_ID = '88888888-8888-4888-8888-888888888888';

type Period = {
  id: string;
  schoolId: string;
  type: 'CLASS_TIME' | 'BREAK' | 'EXAM_TIME';
  name: string;
  startTime: string;
  endTime: string;
};

type Assignment = {
  id: string;
  schoolId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  teacherId: string;
  subject: { id: string; name: string; code?: string | null; type?: string | null };
  teacher: { id: string; firstName: string; lastName: string; employeeNo?: string | null };
};

type Entry = {
  id: string;
  schoolId: string;
  timetableVersionId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  attendancePeriodId: string;
  dayOfWeek: number;
  subjectId: string;
  teacherId: string;
  classRoomId: string | null;
  room: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const periods = (): Period[] => [
  { id: 'period-1', schoolId: SCHOOL_ID, type: 'CLASS_TIME', name: '1ST PERIOD', startTime: '09:00', endTime: '09:45' },
  { id: 'period-break', schoolId: SCHOOL_ID, type: 'BREAK', name: 'BREAK', startTime: '09:45', endTime: '10:00' },
  { id: 'period-2', schoolId: SCHOOL_ID, type: 'CLASS_TIME', name: '2ND PERIOD', startTime: '10:00', endTime: '10:45' },
  { id: 'period-exam', schoolId: SCHOOL_ID, type: 'EXAM_TIME', name: 'EXAM', startTime: '11:00', endTime: '12:00' },
];

const assignments = (): Assignment[] => [
  {
    id: 'assign-math',
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    subjectId: 'subject-math',
    teacherId: 'teacher-math',
    subject: { id: 'subject-math', name: 'Mathematics', code: 'MATH', type: 'THEORY' },
    teacher: { id: 'teacher-math', firstName: 'Riya', lastName: 'Sharma', employeeNo: 'T-1' },
  },
  {
    id: 'assign-english',
    schoolId: SCHOOL_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    subjectId: 'subject-english',
    teacherId: 'teacher-english',
    subject: { id: 'subject-english', name: 'English', code: 'ENG', type: 'THEORY' },
    teacher: { id: 'teacher-english', firstName: 'Aman', lastName: 'Khan', employeeNo: 'T-2' },
  },
];

const sortEntries = (rows: Entry[]) =>
  [...rows].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.attendancePeriodId.localeCompare(b.attendancePeriodId));

const entryMatrix = (rows: Entry[]) =>
  sortEntries(rows).map((entry) => ({
    dayOfWeek: entry.dayOfWeek,
    periodId: entry.attendancePeriodId,
    subjectId: entry.subjectId,
    teacherId: entry.teacherId,
    classRoomId: entry.classRoomId,
    room: entry.room,
  }));

const legacyGenerateMatrix = (input: {
  requestedDays: number[];
  weekendValues?: Set<number>;
  periodRows?: Period[];
  assignmentRows?: Assignment[];
  existingRows?: Entry[];
  classRoomId?: string | null;
  room?: string | null;
}) => {
  const weekendValues = input.weekendValues ?? new Set<number>();
  const days = [...new Set(input.requestedDays)].filter((day) => !weekendValues.has(day)).sort((a, b) => a - b);
  const periodRows = (input.periodRows ?? periods())
    .filter((period) => period.type === 'CLASS_TIME')
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name));
  const assignmentRows = [...(input.assignmentRows ?? assignments())].sort((a, b) => a.subject.name.localeCompare(b.subject.name));
  const occupiedClassSlots = new Set<string>();
  const busyTeacherSlots = new Set<string>();
  const busyRoomSlots = new Set<string>();

  for (const row of input.existingRows ?? []) {
    if (row.classId === CLASS_ID && row.sectionId === SECTION_ID) {
      occupiedClassSlots.add(`${row.dayOfWeek}:${row.attendancePeriodId}`);
    }
    busyTeacherSlots.add(`${row.teacherId}:${row.dayOfWeek}:${row.attendancePeriodId}`);
    if (row.classRoomId) busyRoomSlots.add(`${row.classRoomId}:${row.dayOfWeek}:${row.attendancePeriodId}`);
  }

  const skipped: Array<{ dayOfWeek: number; periodId: string; reason: string }> = [];
  const rows: ReturnType<typeof entryMatrix> = [];
  let cursor = 0;

  for (const dayOfWeek of days) {
    for (const period of periodRows) {
      const classSlotKey = `${dayOfWeek}:${period.id}`;
      if (occupiedClassSlots.has(classSlotKey)) {
        skipped.push({ dayOfWeek, periodId: period.id, reason: 'Class-section already has a routine in this period' });
        continue;
      }

      let selected: Assignment | null = null;
      for (let offset = 0; offset < assignmentRows.length; offset += 1) {
        const candidate = assignmentRows[(cursor + offset) % assignmentRows.length];
        const teacherSlotKey = `${candidate.teacherId}:${dayOfWeek}:${period.id}`;
        const roomSlotKey = input.classRoomId ? `${input.classRoomId}:${dayOfWeek}:${period.id}` : null;
        if (!busyTeacherSlots.has(teacherSlotKey) && (!roomSlotKey || !busyRoomSlots.has(roomSlotKey))) {
          selected = candidate;
          cursor = (cursor + offset + 1) % assignmentRows.length;
          break;
        }
      }

      if (!selected) {
        skipped.push({ dayOfWeek, periodId: period.id, reason: 'No assigned teacher available for this period' });
        continue;
      }

      rows.push({
        dayOfWeek,
        periodId: period.id,
        subjectId: selected.subjectId,
        teacherId: selected.teacherId,
        classRoomId: input.classRoomId ?? null,
        room: input.room ?? null,
      });
      occupiedClassSlots.add(classSlotKey);
      busyTeacherSlots.add(`${selected.teacherId}:${dayOfWeek}:${period.id}`);
      if (input.classRoomId) busyRoomSlots.add(`${input.classRoomId}:${dayOfWeek}:${period.id}`);
    }
  }

  return { rows, skipped };
};

const createDb = (overrides: {
  weekends?: unknown;
  periods?: Period[];
  assignments?: Assignment[];
  entries?: Entry[];
  classRoom?: { id: string; roomNumber: string; capacity: number } | null;
  version?: { id: string; schoolId: string; academicYearId: string; status: 'DRAFT' | 'PUBLISHED'; createdAt: Date };
} = {}) => {
  const state = {
    weekends: overrides.weekends ?? [],
    periods: overrides.periods ?? periods(),
    assignments: overrides.assignments ?? assignments(),
    entries: overrides.entries ?? [],
    classRoom: overrides.classRoom === undefined ? { id: ROOM_ID, roomNumber: 'Room 101', capacity: 40 } : overrides.classRoom,
    version: overrides.version ?? {
      id: VERSION_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      status: 'DRAFT' as const,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    createdSequence: 1,
  };

  const decorateEntry = (entry: Entry) => ({
    ...entry,
    class: { id: entry.classId, name: entry.classId === CLASS_ID ? 'Class 1' : 'Other Class' },
    section: { id: entry.sectionId, name: entry.sectionId === SECTION_ID ? 'A' : 'B' },
    period: state.periods.find((period) => period.id === entry.attendancePeriodId),
    subject: state.assignments.find((assignment) => assignment.subjectId === entry.subjectId)?.subject,
    teacher: state.assignments.find((assignment) => assignment.teacherId === entry.teacherId)?.teacher,
    classRoom: entry.classRoomId ? state.classRoom : null,
  });

  const matchesIn = <T>(value: T, filter?: { in?: T[] }) => !filter?.in || filter.in.includes(value);

  const db: any = {
    state,
    schoolSystemSetting: {
      findUnique: async () => ({ weekends: state.weekends }),
    },
    timetableVersion: {
      findFirst: async ({ where }: any) =>
        state.version.schoolId === where.schoolId &&
        state.version.status === where.status &&
        (!where.id || state.version.id === where.id)
          ? state.version
          : null,
    },
    class: {
      findFirst: async ({ where }: any) => (where.schoolId === SCHOOL_ID && where.id === CLASS_ID ? { id: CLASS_ID } : null),
    },
    section: {
      findFirst: async ({ where }: any) => (where.schoolId === SCHOOL_ID && where.id === SECTION_ID ? { id: SECTION_ID } : null),
    },
    classSection: {
      findFirst: async ({ where }: any) =>
        where.schoolId === SCHOOL_ID && where.classId === CLASS_ID && where.sectionId === SECTION_ID ? { id: 'class-section-1' } : null,
    },
    classRoom: {
      findFirst: async ({ where }: any) =>
        state.classRoom && where.schoolId === SCHOOL_ID && where.id === state.classRoom.id ? state.classRoom : null,
    },
    attendancePeriod: {
      findMany: async ({ where }: any) =>
        state.periods
          .filter((period) => period.schoolId === where.schoolId && (!where.type || period.type === where.type))
          .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name)),
    },
    assignSubject: {
      findMany: async ({ where }: any) =>
        state.assignments
          .filter(
            (assignment) =>
              assignment.schoolId === where.schoolId &&
              assignment.classId === where.classId &&
              assignment.sectionId === where.sectionId,
          )
          .sort((a, b) => a.subject.name.localeCompare(b.subject.name)),
    },
    timetableEntry: {
      deleteMany: async ({ where }: any) => {
        const before = state.entries.length;
        state.entries = state.entries.filter(
          (entry) =>
            !(
              entry.schoolId === where.schoolId &&
              entry.timetableVersionId === where.timetableVersionId &&
              entry.classId === where.classId &&
              entry.sectionId === where.sectionId &&
              matchesIn(entry.dayOfWeek, where.dayOfWeek) &&
              matchesIn(entry.attendancePeriodId, where.attendancePeriodId)
            ),
        );
        return { count: before - state.entries.length };
      },
      findMany: async ({ where }: any) =>
        sortEntries(
          state.entries.filter(
            (entry) =>
              (!where.schoolId || entry.schoolId === where.schoolId) &&
              (!where.timetableVersionId || entry.timetableVersionId === where.timetableVersionId) &&
              (!where.classId || entry.classId === where.classId) &&
              (!where.sectionId || entry.sectionId === where.sectionId) &&
              (where.isActive === undefined || entry.isActive === where.isActive) &&
              matchesIn(entry.dayOfWeek, where.dayOfWeek) &&
              matchesIn(entry.attendancePeriodId, where.attendancePeriodId),
          ),
        ).map(decorateEntry),
      createMany: async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const item of data as Entry[]) {
          const exists = state.entries.some(
            (entry) =>
              entry.timetableVersionId === item.timetableVersionId &&
              entry.classId === item.classId &&
              entry.sectionId === item.sectionId &&
              entry.dayOfWeek === item.dayOfWeek &&
              entry.attendancePeriodId === item.attendancePeriodId,
          );
          if (exists && skipDuplicates) continue;
          state.entries.push({
            ...item,
            id: `entry-${state.createdSequence++}`,
            createdAt: new Date('2026-01-01T00:00:00Z'),
            updatedAt: new Date('2026-01-01T00:00:00Z'),
          });
          count += 1;
        }
        return { count };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(db),
  };

  return db;
};

const generate = (db: any, overrides: Partial<Parameters<ModernTimetableGeneratorService['generate']>[0]> = {}) =>
  new ModernTimetableGeneratorService(db).generate({
    schoolId: SCHOOL_ID,
    timetableVersionId: VERSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    classRoomId: ROOM_ID,
    days: [1],
    replaceExisting: false,
    ...overrides,
  });

test('modern generator filters configured weekends', async () => {
  const db = createDb({ weekends: [{ id: 'saturday', isWeekend: true }] });

  const result = await generate(db, { days: [1, 2] });

  assert.equal(result.createdCount, 2);
  assert.deepEqual([...new Set(result.entries.map((entry: any) => entry.dayOfWeek))], [2]);
});

test('modern generator skips existing class slots', async () => {
  const db = createDb({
    entries: [
      {
        id: 'existing',
        schoolId: SCHOOL_ID,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        classId: CLASS_ID,
        sectionId: SECTION_ID,
        attendancePeriodId: 'period-1',
        dayOfWeek: 1,
        subjectId: 'subject-existing',
        teacherId: 'teacher-existing',
        classRoomId: null,
        room: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  const result = await generate(db, { days: [1] });

  assert.equal(result.createdCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.skipped[0].reason, 'Class-section already has a routine in this period');
});

test('modern generator detects teacher conflicts while rotating subjects', async () => {
  const db = createDb({
    assignments: [assignments()[0]],
    entries: [
      {
        id: 'teacher-conflict',
        schoolId: SCHOOL_ID,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        classId: OTHER_CLASS_ID,
        sectionId: OTHER_SECTION_ID,
        attendancePeriodId: 'period-1',
        dayOfWeek: 1,
        subjectId: 'other-subject',
        teacherId: 'teacher-math',
        classRoomId: null,
        room: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  const result = await generate(db, { days: [1] });

  assert.equal(result.createdCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.skipped[0].reason, 'No assigned teacher available for this period');
});

test('modern generator detects room conflicts by classRoomId and legacy room label fallback', async () => {
  const db = createDb({
    entries: [
      {
        id: 'room-fk-conflict',
        schoolId: SCHOOL_ID,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        classId: OTHER_CLASS_ID,
        sectionId: OTHER_SECTION_ID,
        attendancePeriodId: 'period-1',
        dayOfWeek: 1,
        subjectId: 'other-subject',
        teacherId: 'other-teacher',
        classRoomId: ROOM_ID,
        room: 'Room 101',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'room-label-conflict',
        schoolId: SCHOOL_ID,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        classId: OTHER_CLASS_ID,
        sectionId: OTHER_SECTION_ID,
        attendancePeriodId: 'period-2',
        dayOfWeek: 1,
        subjectId: 'other-subject',
        teacherId: 'another-teacher',
        classRoomId: null,
        room: ' room 101 ',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  const result = await generate(db, { days: [1] });

  assert.equal(result.createdCount, 0);
  assert.equal(result.skippedCount, 2);
});

test('modern generator replaceExisting removes only scoped draft entries', async () => {
  const db = createDb({
    entries: [
      {
        id: 'replace-me',
        schoolId: SCHOOL_ID,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
        classId: CLASS_ID,
        sectionId: SECTION_ID,
        attendancePeriodId: 'period-1',
        dayOfWeek: 1,
        subjectId: 'old-subject',
        teacherId: 'old-teacher',
        classRoomId: null,
        room: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  const result = await generate(db, { days: [1], replaceExisting: true });

  assert.equal(result.createdCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(db.state.entries.some((entry: Entry) => entry.id === 'replace-me'), false);
});

test('modern generator uses deterministic subject rotation and ignores non-class periods', async () => {
  const db = createDb();

  const result = await generate(db, { days: [1] });

  assert.equal(result.createdCount, 2);
  assert.deepEqual(
    entryMatrix(result.entries as any),
    [
      { dayOfWeek: 1, periodId: 'period-1', subjectId: 'subject-english', teacherId: 'teacher-english', classRoomId: ROOM_ID, room: 'Room 101' },
      { dayOfWeek: 1, periodId: 'period-2', subjectId: 'subject-math', teacherId: 'teacher-math', classRoomId: ROOM_ID, room: 'Room 101' },
    ],
  );
});

test('modern generator rejects published timetable versions and keeps published versions immutable', async () => {
  const db = createDb({
    version: {
      id: VERSION_ID,
      schoolId: SCHOOL_ID,
      academicYearId: ACADEMIC_YEAR_ID,
      status: 'PUBLISHED',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
  });

  await assert.rejects(() => generate(db, { days: [1] }), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'Draft timetable version not found');
    assert.equal(db.state.entries.length, 0);
    return true;
  });
});

test('modern timetable write path operates without class_routines access', async () => {
  const db = createDb();
  assert.equal('classRoutine' in db, false);

  const result = await generate(db, { days: [1] });

  assert.equal(result.createdCount, 2);
});

test('modern generator supports Friday/day 7 and room FK coverage', async () => {
  const db = createDb({ weekends: [] });

  const result = await generate(db, { days: [7] });

  assert.equal(result.createdCount, 2);
  assert.deepEqual([...new Set(result.entries.map((entry: any) => entry.dayOfWeek))], [7]);
  assert.ok(result.entries.every((entry: any) => entry.classRoomId === ROOM_ID));
  assert.ok(result.entries.every((entry: any) => entry.classRoom?.roomNumber === 'Room 101'));
});

test('modern generator rejects all-weekend requests like the legacy generator', async () => {
  const db = createDb({ weekends: [{ id: 'friday', isWeekend: true }] });

  await assert.rejects(() => generate(db, { days: [7] }), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, 'All selected days are configured as weekend');
    return true;
  });
});

test('modern generator output is parity-compatible with legacy generator slot output and skipped counts', async () => {
  const db = createDb({ weekends: [] });
  const legacyExpected = legacyGenerateMatrix({ requestedDays: [1, 7], classRoomId: ROOM_ID, room: 'Room 101' });

  const result = await generate(db, { days: [1, 7] });

  assert.equal(result.createdCount, legacyExpected.rows.length);
  assert.equal(result.skippedCount, legacyExpected.skipped.length);
  assert.deepEqual(entryMatrix(result.entries as any), legacyExpected.rows);
  assert.deepEqual(result.skipped, legacyExpected.skipped);
});
