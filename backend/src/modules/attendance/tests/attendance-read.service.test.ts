import assert from 'node:assert/strict';
import test from 'node:test';

import { PeriodAttendanceReadAdapter } from '../adapters/period-attendance.adapter';
import { SessionAttendanceReadAdapter } from '../adapters/session-attendance.adapter';
import { StaffAttendanceReadAdapter } from '../adapters/staff-attendance.adapter';
import { StudentAttendanceReadAdapter } from '../adapters/student-attendance.adapter';
import { AttendanceReadService } from '../services/attendance-read.service';

const SCHOOL_ID = '11111111-1111-4111-8111-111111111111';
const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
const CLASS_ID = '33333333-3333-4333-8333-333333333333';
const SECTION_ID = '44444444-4444-4444-8444-444444444444';
const ACADEMIC_SESSION_ID = '55555555-5555-4555-8555-555555555555';
const SESSION_ID = '66666666-6666-4666-8666-666666666666';
const RECORD_ID = '77777777-7777-4777-8777-777777777777';
const STAFF_ID = '88888888-8888-4888-8888-888888888888';
const DATE = new Date('2026-02-05T00:00:00.000Z');

const comparableStudentRow = (row: any) => ({
  schoolId: row.schoolId,
  studentId: row.studentId,
  classId: row.classId,
  sectionId: row.sectionId,
  date: row.date,
  status: row.status,
});

test('attendance adapters translate all student attendance sources into the same canonical daily shape', async () => {
  const studentAdapter = new StudentAttendanceReadAdapter({
    studentAttendance: {
      findMany: async () => [
        {
          id: 'student-attendance-row',
          schoolId: SCHOOL_ID,
          academicSessionId: ACADEMIC_SESSION_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          studentId: STUDENT_ID,
          attendanceDate: DATE,
          status: 'PRESENT',
          note: null,
        },
      ],
    },
  } as any);

  const sessionAdapter = new SessionAttendanceReadAdapter({
    studentAttendanceSession: {
      findMany: async () => [
        {
          id: SESSION_ID,
          schoolId: SCHOOL_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          date: DATE,
          records: [
            {
              id: 'session-attendance-row',
              studentId: STUDENT_ID,
              status: 'PRESENT',
              remarks: null,
            },
          ],
        },
      ],
    },
  } as any);

  const periodAdapter = new PeriodAttendanceReadAdapter({
    attendanceRecord: {
      findMany: async () => [
        {
          id: 'period-attendance-row',
          sessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: 'PRESENT',
          manualOverrideReason: null,
          session: {
            id: SESSION_ID,
            schoolId: SCHOOL_ID,
            periodId: 'period-1',
            timetableEntryId: null,
            date: DATE,
          },
          student: {
            classId: CLASS_ID,
            sectionId: SECTION_ID,
            academicSessionId: ACADEMIC_SESSION_ID,
          },
        },
      ],
    },
  } as any);

  const [studentRow] = await studentAdapter.getStudentAttendance({ schoolId: SCHOOL_ID, studentId: STUDENT_ID, date: DATE });
  const [sessionRow] = await sessionAdapter.getStudentAttendance({ schoolId: SCHOOL_ID, studentId: STUDENT_ID, date: DATE });
  const [periodRow] = await periodAdapter.getStudentAttendance({ schoolId: SCHOOL_ID, studentId: STUDENT_ID, date: DATE });

  assert.deepEqual(comparableStudentRow(studentRow), comparableStudentRow(sessionRow));
  assert.deepEqual(comparableStudentRow(sessionRow), comparableStudentRow(periodRow));
  assert.equal(studentRow.source, 'student-attendance');
  assert.equal(sessionRow.source, 'session-attendance');
  assert.equal(periodRow.source, 'period-attendance');
});

test('AttendanceReadService builds monthly summaries from canonical student rows', async () => {
  const service = new AttendanceReadService({
    studentAttendanceAdapter: {
      source: 'student-attendance',
      getStudentAttendance: async () => [
        {
          source: 'student-attendance',
          sourceId: 'daily-1',
          schoolId: SCHOOL_ID,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          academicSessionId: ACADEMIC_SESSION_ID,
          date: '2026-02-01',
          status: 'PRESENT',
          note: null,
          sessionId: null,
          periodId: null,
          timetableEntryId: null,
        },
        {
          source: 'student-attendance',
          sourceId: 'daily-2',
          schoolId: SCHOOL_ID,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          academicSessionId: ACADEMIC_SESSION_ID,
          date: '2026-02-02',
          status: 'ABSENT',
          note: null,
          sessionId: null,
          periodId: null,
          timetableEntryId: null,
        },
      ],
    },
    sessionAttendanceAdapter: {
      source: 'session-attendance',
      getStudentAttendance: async () => [],
    },
    periodAttendanceAdapter: {
      source: 'period-attendance',
      getStudentAttendance: async () => [],
    },
  });

  const summary = await service.getStudentMonthlyAttendance({
    schoolId: SCHOOL_ID,
    studentId: STUDENT_ID,
    month: 2,
    year: 2026,
    source: 'student-attendance',
  });

  assert.equal(summary.fromDate, '2026-02-01');
  assert.equal(summary.toDate, '2026-02-28');
  assert.equal(summary.totalRecords, 2);
  assert.equal(summary.present, 1);
  assert.equal(summary.absent, 1);
  assert.equal(summary.byStudent[0].percentage, 50);
});

test('AttendanceReadService combines student sources without source-specific response logic', async () => {
  const service = new AttendanceReadService({
    studentAttendanceAdapter: {
      source: 'student-attendance',
      getStudentAttendance: async () => [
        {
          source: 'student-attendance',
          sourceId: 'daily-1',
          schoolId: SCHOOL_ID,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          academicSessionId: ACADEMIC_SESSION_ID,
          date: '2026-02-01',
          status: 'PRESENT',
          note: null,
          sessionId: null,
          periodId: null,
          timetableEntryId: null,
        },
      ],
    },
    sessionAttendanceAdapter: {
      source: 'session-attendance',
      getStudentAttendance: async () => [
        {
          source: 'session-attendance',
          sourceId: 'session-record-1',
          schoolId: SCHOOL_ID,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          academicSessionId: null,
          date: '2026-02-02',
          status: 'LATE',
          note: null,
          sessionId: SESSION_ID,
          periodId: null,
          timetableEntryId: null,
        },
      ],
    },
    periodAttendanceAdapter: {
      source: 'period-attendance',
      getStudentAttendance: async () => [
        {
          source: 'period-attendance',
          sourceId: RECORD_ID,
          schoolId: SCHOOL_ID,
          studentId: STUDENT_ID,
          classId: CLASS_ID,
          sectionId: SECTION_ID,
          academicSessionId: ACADEMIC_SESSION_ID,
          date: '2026-02-03',
          status: 'EXCUSED',
          note: null,
          sessionId: SESSION_ID,
          periodId: 'period-1',
          timetableEntryId: null,
        },
      ],
    },
  });

  const summary = await service.getAttendanceSummary({
    schoolId: SCHOOL_ID,
    fromDate: '2026-02-01',
    toDate: '2026-02-03',
  });
  const analytics = await service.getAttendanceAnalytics({
    schoolId: SCHOOL_ID,
    fromDate: '2026-02-01',
    toDate: '2026-02-03',
  });

  assert.equal(summary.source, 'combined');
  assert.equal(summary.totalRecords, 3);
  assert.equal(summary.present, 1);
  assert.equal(summary.late, 1);
  assert.equal(summary.excused, 1);
  assert.equal(analytics.attendanceRate, 100);
});

test('StaffAttendanceAdapter and AttendanceReadService return canonical teacher attendance summaries', async () => {
  const staffAdapter = new StaffAttendanceReadAdapter({
    staffAttendance: {
      findMany: async () => [
        {
          id: 'staff-attendance-1',
          schoolId: SCHOOL_ID,
          staffId: STAFF_ID,
          attendanceDate: new Date('2026-02-01T00:00:00.000Z'),
          status: 'PRESENT',
          note: null,
        },
        {
          id: 'staff-attendance-2',
          schoolId: SCHOOL_ID,
          staffId: STAFF_ID,
          attendanceDate: new Date('2026-02-02T00:00:00.000Z'),
          status: 'LEAVE',
          note: 'Approved leave',
        },
      ],
    },
  } as any);

  const service = new AttendanceReadService({ staffAttendanceAdapter: staffAdapter });
  const summary = await service.getTeacherAttendance({
    schoolId: SCHOOL_ID,
    teacherId: STAFF_ID,
    fromDate: '2026-02-01',
    toDate: '2026-02-28',
  });

  assert.equal(summary.source, 'staff-attendance');
  assert.equal(summary.totalRecords, 2);
  assert.equal(summary.present, 1);
  assert.equal(summary.leave, 1);
  assert.deepEqual(summary.records.map((row) => row.date), ['2026-02-01', '2026-02-02']);
});

test('AttendanceReadService maps legacy and modern timetable rows into canonical timetable slots', async () => {
  const service = new AttendanceReadService({
    prisma: {
      classRoutine: {
        findMany: async () => [
          {
            id: 'routine-1',
            schoolId: SCHOOL_ID,
            classId: CLASS_ID,
            sectionId: SECTION_ID,
            timePeriodId: 'legacy-period-1',
            dayOfWeek: 1,
            subjectId: 'subject-1',
            teacherId: STAFF_ID,
            classRoom: { roomNumber: '101' },
            timePeriod: { startTime: '09:00', endTime: '09:45' },
          },
        ],
      },
      timetableEntry: {
        findMany: async () => [
          {
            id: 'entry-1',
            schoolId: SCHOOL_ID,
            academicYearId: ACADEMIC_SESSION_ID,
            timetableVersionId: 'version-1',
            classId: CLASS_ID,
            sectionId: SECTION_ID,
            attendancePeriodId: 'modern-period-1',
            dayOfWeek: 1,
            subjectId: 'subject-1',
            teacherId: STAFF_ID,
            room: 'Lab',
            period: { startTime: '10:00', endTime: '10:45' },
          },
        ],
      },
    } as any,
  });

  const slots = await service.getTimetable({ schoolId: SCHOOL_ID, teacherId: STAFF_ID, dayOfWeek: 1 });

  assert.equal(slots.length, 2);
  assert.deepEqual(
    slots.map((slot) => ({ source: slot.source, periodId: slot.periodId, room: slot.room })),
    [
      { source: 'legacy-routine', periodId: 'legacy-period-1', room: '101' },
      { source: 'timetable-entry', periodId: 'modern-period-1', room: 'Lab' },
    ],
  );
});

