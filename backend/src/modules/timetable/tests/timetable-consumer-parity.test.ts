import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../config/db';
import { listClassRoutines } from '../../../controllers/academicSetup.controller';
import { getMyTimetableApi } from '../../../controllers/user.controller';
import { getReportData } from '../../../services/report.service';
import { getTeacherTimetableByDate, listTimetableEntries } from '../../../services/timetable.service';
import { timetableReadService } from '../services/timetable-read.service';
import type { TimetableSlot } from '../models/timetable-read-model';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const TEACHER_ID = '33333333-3333-4333-8333-333333333333';
const CLASS_ID = '44444444-4444-4444-8444-444444444444';
const SECTION_ID = '55555555-5555-4555-8555-555555555555';
const SUBJECT_ID = '66666666-6666-4666-8666-666666666666';
const VERSION_ID = '77777777-7777-4777-8777-777777777777';
const ACADEMIC_YEAR_ID = '88888888-8888-4888-8888-888888888888';

const replaceMethod = <T extends object, K extends keyof T>(target: T, key: K, replacement: T[K]) => {
  const original = target[key];
  (target as any)[key] = replacement;
  return () => {
    (target as any)[key] = original;
  };
};

const response = () => ({
  statusCode: 0,
  body: undefined as unknown,
  status(code: number) {
    this.statusCode = code;
    return this;
  },
  json(payload: unknown) {
    this.body = payload;
    return this;
  },
});

const slot = (overrides: Partial<TimetableSlot> = {}): TimetableSlot => ({
  schoolId: SCHOOL_ID,
  dayOfWeek: 1,
  periodId: 'period-1',
  periodName: 'Period 1',
  periodType: 'CLASS_TIME',
  startTime: '09:00',
  endTime: '09:45',
  subjectId: SUBJECT_ID,
  subjectName: 'Mathematics',
  subjectCode: 'MATH',
  subjectType: 'THEORY',
  teacherId: TEACHER_ID,
  teacherName: 'Riya Sharma',
  teacherEmployeeNo: 'EMP-1',
  teacherFirstName: 'Riya',
  teacherLastName: 'Sharma',
  classId: CLASS_ID,
  className: 'Grade 4',
  sectionId: SECTION_ID,
  sectionName: 'A',
  roomId: 'room-1',
  roomName: 'Room 101',
  roomCapacity: 40,
  isActive: true,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-02T00:00:00.000Z'),
  source: 'class-routine',
  sourceId: 'routine-1',
  timetableVersionId: null,
  academicYearId: null,
  ...overrides,
});

test('teacher /users/me/timetable preserves legacy response shape through TimetableReadService', async () => {
  const restoreTeacher = replaceMethod(prisma.teacherProfile, 'findFirst', (async () => ({
    id: TEACHER_ID,
    firstName: 'Riya',
    lastName: 'Sharma',
  })) as any);
  const restorePeriods = replaceMethod(prisma.timePeriod, 'findMany', (async () => [
    { id: 'period-1', name: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'CLASS_TIME' },
  ]) as any);
  const restoreSettings = replaceMethod(prisma.schoolSystemSetting, 'findUnique', (async () => null) as any);
  const restoreAcademicYear = replaceMethod(prisma.academicYear, 'findFirst', (async () => ({ id: ACADEMIC_YEAR_ID })) as any);
  const restoreTimetable = replaceMethod(timetableReadService, 'getTeacherTimetable', (async () => ({
    schoolId: SCHOOL_ID,
    teacherId: TEACHER_ID,
    mode: 'legacy',
    slots: [slot()],
  })) as any);
  const res = response();

  try {
    await getMyTimetableApi({ auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: {} } as any, res as any);

    assert.equal(res.statusCode, 200);
    assert.deepEqual((res.body as any).teacher, { id: TEACHER_ID, firstName: 'Riya', lastName: 'Sharma' });
    assert.deepEqual((res.body as any).periods, [
      { id: 'period-1', name: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'CLASS_TIME' },
    ]);
    assert.equal((res.body as any).routines[0].id, 'routine-1');
    assert.equal((res.body as any).routines[0].timePeriod.name, 'Period 1');
    assert.equal((res.body as any).routines[0].subject.name, 'Mathematics');
    assert.equal((res.body as any).routines[0].classRoom.roomNumber, 'Room 101');
    assert.equal((res.body as any).activeAcademicYearId, ACADEMIC_YEAR_ID);
  } finally {
    restoreTeacher();
    restorePeriods();
    restoreSettings();
    restoreAcademicYear();
    restoreTimetable();
  }
});

test('admin class routine listing preserves included legacy routine fields through TimetableReadService', async () => {
  const restoreTimetable = replaceMethod(timetableReadService, 'getTimetable', (async () => [slot()]) as any);
  const res = response();

  try {
    await listClassRoutines({ auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: { classId: CLASS_ID } } as any, res as any);

    assert.equal(res.statusCode, 200);
    const row = (res.body as any[])[0];
    assert.equal(row.id, 'routine-1');
    assert.equal(row.teacher.employeeNo, 'EMP-1');
    assert.equal(row.subject.code, 'MATH');
    assert.equal(row.classRoom.capacity, 40);
  } finally {
    restoreTimetable();
  }
});

test('modern timetable entry listing preserves entry payload shape through TimetableReadService', async () => {
  const restoreVersion = replaceMethod(prisma.timetableVersion, 'findFirst', (async () => ({ id: VERSION_ID })) as any);
  const restoreTimetable = replaceMethod(timetableReadService, 'getTimetable', (async () => [
    slot({
      source: 'timetable-entry',
      sourceId: 'entry-1',
      roomId: null,
      periodType: null,
      timetableVersionId: VERSION_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    }),
  ]) as any);

  try {
    const rows = await listTimetableEntries({ schoolId: SCHOOL_ID, timetableVersionId: VERSION_ID });

    assert.equal(rows[0].id, 'entry-1');
    assert.equal(rows[0].timetableVersionId, VERSION_ID);
    assert.equal(rows[0].attendancePeriodId, 'period-1');
    assert.equal(rows[0].period.name, 'Period 1');
    assert.equal(rows[0].teacher.firstName, 'Riya');
  } finally {
    restoreVersion();
    restoreTimetable();
  }
});

test('teacher timetable by date preserves modern period payload through TimetableReadService', async () => {
  const restoreTeacher = replaceMethod(prisma.teacherProfile, 'findFirst', (async () => ({
    id: TEACHER_ID,
    firstName: 'Riya',
    lastName: 'Sharma',
  })) as any);
  const restoreYear = replaceMethod(prisma.academicYear, 'findFirst', (async () => ({ id: ACADEMIC_YEAR_ID, name: '2026' })) as any);
  const restoreVersion = replaceMethod(prisma.timetableVersion, 'findFirst', (async () => ({
    id: VERSION_ID,
    name: 'Published',
    publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  })) as any);
  const restoreTimetable = replaceMethod(timetableReadService, 'getTeacherTimetable', (async () => ({
    schoolId: SCHOOL_ID,
    teacherId: TEACHER_ID,
    mode: 'modern',
    slots: [
      slot({
        source: 'timetable-entry',
        sourceId: 'entry-1',
        roomId: null,
        periodType: null,
        timetableVersionId: VERSION_ID,
        academicYearId: ACADEMIC_YEAR_ID,
      }),
    ],
  })) as any);

  try {
    const result = await getTeacherTimetableByDate({
      schoolId: SCHOOL_ID,
      userId: USER_ID,
      date: '2026-02-02',
    });

    assert.equal(result.teacher.id, TEACHER_ID);
    assert.equal(result.version?.id, VERSION_ID);
    assert.equal(result.periods[0].id, 'entry-1');
    assert.equal(result.periods[0].subject.name, 'Mathematics');
    assert.equal(result.periods[0].period.startTime, '09:00');
  } finally {
    restoreTeacher();
    restoreYear();
    restoreVersion();
    restoreTimetable();
  }
});

test('timetable report preserves report row contract through TimetableReadService', async () => {
  const restoreTimetable = replaceMethod(timetableReadService, 'getTimetable', (async () => [
    slot({
      source: 'timetable-entry',
      sourceId: 'entry-1',
      roomId: null,
      periodType: null,
      timetableVersionId: VERSION_ID,
      academicYearId: ACADEMIC_YEAR_ID,
    }),
  ]) as any);

  try {
    const result = await getReportData('academics.timetable', {
      schoolId: SCHOOL_ID,
      page: 1,
      pageSize: 25,
    });

    assert.equal(result.total, 1);
    assert.deepEqual(result.rows, [
      {
        day: 'Monday',
        class: 'Grade 4',
        section: 'A',
        period: 'Period 1',
        subject: 'Mathematics',
        teacher: 'Riya Sharma',
        room: 'Room 101',
        active: 'Yes',
      },
    ]);
  } finally {
    restoreTimetable();
  }
});
