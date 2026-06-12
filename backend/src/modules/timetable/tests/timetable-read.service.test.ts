import assert from 'node:assert/strict';
import test from 'node:test';

import { ClassRoutineAdapter } from '../adapters/class-routine.adapter';
import { TimetableEntryAdapter } from '../adapters/timetable-entry.adapter';
import { TimetableReadService } from '../services/timetable-read.service';
import type { TimetableAdapter, TimetableSlot } from '../models/timetable-read-model';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const SECTION_ID = '44444444-4444-4444-8444-444444444444';
const TEACHER_ID = '55555555-5555-4555-8555-555555555555';
const SUBJECT_ID = '66666666-6666-4666-8666-666666666666';

const comparableSlot = (slot: TimetableSlot) => ({
  dayOfWeek: slot.dayOfWeek,
  startTime: slot.startTime,
  endTime: slot.endTime,
  subjectId: slot.subjectId,
  subjectName: slot.subjectName,
  teacherId: slot.teacherId,
  teacherName: slot.teacherName,
  classId: slot.classId,
  sectionId: slot.sectionId,
  roomName: slot.roomName,
});

const slot = (source: 'class-routine' | 'timetable-entry', overrides: Partial<TimetableSlot> = {}): TimetableSlot => ({
  schoolId: SCHOOL_ID,
  dayOfWeek: 1,
  periodId: source === 'class-routine' ? 'time-period-1' : 'attendance-period-1',
  periodName: 'Period 1',
  periodType: source === 'class-routine' ? 'CLASS_TIME' : null,
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
  roomId: source === 'class-routine' ? 'room-1' : null,
  roomName: 'Room 101',
  roomCapacity: source === 'class-routine' ? 40 : null,
  isActive: true,
  createdAt: null,
  updatedAt: null,
  source,
  sourceId: source === 'class-routine' ? 'routine-1' : 'entry-1',
  timetableVersionId: source === 'timetable-entry' ? 'version-1' : null,
  academicYearId: source === 'timetable-entry' ? 'academic-year-1' : null,
  ...overrides,
});

const adapter = (source: 'class-routine' | 'timetable-entry', slots: TimetableSlot[]): TimetableAdapter => ({
  source,
  getTimetable: async () => slots,
});

test('ClassRoutineAdapter and TimetableEntryAdapter map rows into identical canonical slot structures', async () => {
  const classRoutineAdapter = new ClassRoutineAdapter({
    classRoutine: {
      findMany: async () => [
        {
          id: 'routine-1',
          schoolId: SCHOOL_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          timePeriodId: 'time-period-1',
          dayOfWeek: 1,
          subjectId: SUBJECT_ID,
          teacherId: TEACHER_ID,
          classRoomId: 'room-1',
          timePeriod: { startTime: '09:00', endTime: '09:45' },
          subject: { name: 'Mathematics' },
          teacher: { firstName: 'Riya', lastName: 'Sharma' },
          classRoom: { id: 'room-1', roomNumber: 'Room 101' },
        },
      ],
    },
  } as any);
  const timetableEntryAdapter = new TimetableEntryAdapter({
    timetableEntry: {
      findMany: async () => [
        {
          id: 'entry-1',
          schoolId: SCHOOL_ID,
          timetableVersionId: 'version-1',
          academicYearId: 'academic-year-1',
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          attendancePeriodId: 'attendance-period-1',
          dayOfWeek: 1,
          subjectId: SUBJECT_ID,
          teacherId: TEACHER_ID,
          room: 'Room 101',
          period: { startTime: '09:00', endTime: '09:45' },
          subject: { name: 'Mathematics' },
          teacher: { firstName: 'Riya', lastName: 'Sharma' },
        },
      ],
    },
  } as any);

  const [legacy] = await classRoutineAdapter.getTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID });
  const [modern] = await timetableEntryAdapter.getTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID });

  assert.deepEqual(comparableSlot(legacy), comparableSlot(modern));
  assert.equal(legacy.source, 'class-routine');
  assert.equal(modern.source, 'timetable-entry');
  assert.equal(legacy.roomId, 'room-1');
  assert.equal(modern.roomId, null);
});

test('TimetableReadService returns teacher timetable from selected read modes', async () => {
  const service = new TimetableReadService({
    classRoutineAdapter: adapter('class-routine', [slot('class-routine')]),
    timetableEntryAdapter: adapter('timetable-entry', [slot('timetable-entry', { startTime: '10:00', endTime: '10:45' })]),
  });

  const legacy = await service.getTeacherTimetable({ schoolId: SCHOOL_ID, teacherId: TEACHER_ID, mode: 'legacy' });
  const modern = await service.getTeacherTimetable({ schoolId: SCHOOL_ID, teacherId: TEACHER_ID, mode: 'modern' });
  const combined = await service.getTeacherTimetable({ schoolId: SCHOOL_ID, teacherId: TEACHER_ID });

  assert.deepEqual(legacy.slots.map((row) => row.source), ['class-routine']);
  assert.deepEqual(modern.slots.map((row) => row.source), ['timetable-entry']);
  assert.deepEqual(combined.slots.map((row) => row.source), ['class-routine', 'timetable-entry']);
  assert.equal(combined.mode, 'combined');
});

test('TimetableReadService returns class timetable without changing canonical slot shape', async () => {
  const service = new TimetableReadService({
    classRoutineAdapter: adapter('class-routine', [slot('class-routine')]),
    timetableEntryAdapter: adapter('timetable-entry', [slot('timetable-entry')]),
  });

  const result = await service.getClassTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID, sectionId: SECTION_ID });

  assert.equal(result.classId, CLASS_ID);
  assert.equal(result.sectionId, SECTION_ID);
  assert.equal(result.slots.length, 2);
  assert.deepEqual(comparableSlot(result.slots[0]), comparableSlot(result.slots[1]));
});

test('TimetableReadService resolves parent and student timetable from student class scope', async () => {
  const service = new TimetableReadService({
    classRoutineAdapter: adapter('class-routine', [slot('class-routine')]),
    timetableEntryAdapter: adapter('timetable-entry', []),
    prisma: {
      student: {
        findFirst: async () => ({ classId: CLASS_ID, sectionId: SECTION_ID }),
      },
    } as any,
  });

  const parent = await service.getParentTimetable({ schoolId: SCHOOL_ID, studentId: STUDENT_ID, mode: 'legacy' });
  const student = await service.getStudentTimetable({ schoolId: SCHOOL_ID, studentId: STUDENT_ID, mode: 'legacy' });

  assert.equal(parent.studentId, STUDENT_ID);
  assert.equal(parent.classId, CLASS_ID);
  assert.equal(parent.sectionId, SECTION_ID);
  assert.deepEqual(parent.slots, student.slots);
});

test('TimetableReadService returns dashboard timetable in sorted canonical order', async () => {
  const service = new TimetableReadService({
    classRoutineAdapter: adapter('class-routine', [slot('class-routine', { dayOfWeek: 2, startTime: '11:00' })]),
    timetableEntryAdapter: adapter('timetable-entry', [slot('timetable-entry', { dayOfWeek: 1, startTime: '09:00' })]),
  });

  const dashboard = await service.getDashboardTimetable({ schoolId: SCHOOL_ID });

  assert.equal(dashboard.schoolId, SCHOOL_ID);
  assert.deepEqual(
    dashboard.slots.map((row) => ({ source: row.source, dayOfWeek: row.dayOfWeek })),
    [
      { source: 'timetable-entry', dayOfWeek: 1 },
      { source: 'class-routine', dayOfWeek: 2 },
    ],
  );
});
