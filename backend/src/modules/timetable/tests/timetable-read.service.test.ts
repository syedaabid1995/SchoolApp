import assert from 'node:assert/strict';
import test from 'node:test';

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

const slot = (overrides: Partial<TimetableSlot> = {}): TimetableSlot => ({
  schoolId: SCHOOL_ID,
  dayOfWeek: 1,
  periodId: 'attendance-period-1',
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
  createdAt: null,
  updatedAt: null,
  source: 'timetable-entry',
  sourceId: 'entry-1',
  timetableVersionId: 'version-1',
  academicYearId: 'academic-year-1',
  ...overrides,
});

const adapter = (slots: TimetableSlot[]): TimetableAdapter => ({
  source: 'timetable-entry',
  getTimetable: async () => slots,
});

test('TimetableEntryAdapter maps modern rows into canonical slot structures', async () => {
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
          classRoomId: 'room-1',
          room: 'Room 101',
          isActive: true,
          createdAt: null,
          updatedAt: null,
          period: { id: 'attendance-period-1', name: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'CLASS_TIME' },
          subject: { name: 'Mathematics', code: 'MATH', type: 'THEORY' },
          teacher: { firstName: 'Riya', lastName: 'Sharma', employeeNo: 'EMP-1' },
          class: { id: CLASS_ID, name: 'Grade 4' },
          section: { id: SECTION_ID, name: 'A' },
          classRoom: { id: 'room-1', roomNumber: 'Room 101', capacity: 40 },
        },
      ],
    },
  } as any);

  const [modern] = await timetableEntryAdapter.getTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID });

  assert.deepEqual(comparableSlot(modern), comparableSlot(slot()));
  assert.equal(modern.source, 'timetable-entry');
  assert.equal(modern.roomId, 'room-1');
  assert.equal(modern.roomCapacity, 40);
});

test('TimetableEntryAdapter falls back to room label when classRoom relation is absent', async () => {
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
          classRoomId: null,
          room: 'Fallback Room',
          isActive: true,
          createdAt: null,
          updatedAt: null,
          period: { id: 'attendance-period-1', name: 'Period 1', startTime: '09:00', endTime: '09:45', type: 'CLASS_TIME' },
          subject: { name: 'Mathematics', code: 'MATH', type: 'THEORY' },
          teacher: { firstName: 'Riya', lastName: 'Sharma', employeeNo: 'EMP-1' },
          class: { id: CLASS_ID, name: 'Grade 4' },
          section: { id: SECTION_ID, name: 'A' },
          classRoom: null,
        },
      ],
    },
  } as any);

  const [modern] = await timetableEntryAdapter.getTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID });

  assert.equal(modern.roomId, null);
  assert.equal(modern.roomName, 'Fallback Room');
  assert.equal(modern.roomCapacity, null);
});

test('TimetableReadService returns teacher timetable from canonical modern source only', async () => {
  const service = new TimetableReadService({
    timetableEntryAdapter: adapter([slot({ startTime: '10:00', endTime: '10:45' })]),
  });

  const modern = await service.getTeacherTimetable({ schoolId: SCHOOL_ID, teacherId: TEACHER_ID, mode: 'modern' });
  const combined = await service.getTeacherTimetable({ schoolId: SCHOOL_ID, teacherId: TEACHER_ID });

  assert.deepEqual(modern.slots.map((row) => row.source), ['timetable-entry']);
  assert.deepEqual(combined.slots.map((row) => row.source), ['timetable-entry']);
  assert.equal(combined.mode, 'combined');
});

test('TimetableReadService returns class timetable without changing canonical slot shape', async () => {
  const service = new TimetableReadService({
    timetableEntryAdapter: adapter([slot()]),
  });

  const result = await service.getClassTimetable({ schoolId: SCHOOL_ID, classId: CLASS_ID, sectionId: SECTION_ID });

  assert.equal(result.classId, CLASS_ID);
  assert.equal(result.sectionId, SECTION_ID);
  assert.equal(result.slots.length, 1);
  assert.deepEqual(comparableSlot(result.slots[0]), comparableSlot(slot()));
});

test('TimetableReadService resolves parent and student timetable from student class scope', async () => {
  const service = new TimetableReadService({
    timetableEntryAdapter: adapter([slot()]),
    prisma: {
      student: {
        findFirst: async () => ({ classId: CLASS_ID, sectionId: SECTION_ID }),
      },
    } as any,
  });

  const parent = await service.getParentTimetable({ schoolId: SCHOOL_ID, studentId: STUDENT_ID });
  const student = await service.getStudentTimetable({ schoolId: SCHOOL_ID, studentId: STUDENT_ID });

  assert.equal(parent.studentId, STUDENT_ID);
  assert.equal(parent.classId, CLASS_ID);
  assert.equal(parent.sectionId, SECTION_ID);
  assert.deepEqual(parent.slots, student.slots);
});

test('TimetableReadService returns dashboard timetable in sorted canonical order', async () => {
  const service = new TimetableReadService({
    timetableEntryAdapter: adapter([
      slot({ sourceId: 'entry-2', dayOfWeek: 2, startTime: '11:00' }),
      slot({ sourceId: 'entry-1', dayOfWeek: 1, startTime: '09:00' }),
    ]),
  });

  const dashboard = await service.getDashboardTimetable({ schoolId: SCHOOL_ID });

  assert.equal(dashboard.schoolId, SCHOOL_ID);
  assert.deepEqual(
    dashboard.slots.map((row) => ({ source: row.source, dayOfWeek: row.dayOfWeek })),
    [
      { source: 'timetable-entry', dayOfWeek: 1 },
      { source: 'timetable-entry', dayOfWeek: 2 },
    ],
  );
});
