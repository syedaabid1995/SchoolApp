import assert from 'node:assert/strict';
import test from 'node:test';

import { prisma } from '../../../config/db';
import { listSessionRecords } from '../../../controllers/attendance.controller';
import { getParentAttendance } from '../../../controllers/parentPortal.controller';
import { loadStaffAttendance, getStaffAttendanceReport } from '../../../controllers/staff.controller';
import { loadStudentAttendance, getStudentAttendanceReport } from '../../../controllers/studentOperations.controller';
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
const STAFF_ID = '88888888-8888-4888-8888-888888888888';
const ACADEMIC_SESSION_ID = '99999999-9999-4999-8999-999999999999';
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
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async (params: any) => {
    assert.equal(params.source, 'session-attendance');
    return [canonicalStudentRecord({ source: 'session-attendance', sourceId: 'sr-1', status: 'LATE' })];
  }) as any);
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

test('student attendance load preserves holiday and row payload through AttendanceReadService', async () => {
  const holiday = {
    id: 'holiday-1',
    schoolId: SCHOOL_ID,
    academicSessionId: ACADEMIC_SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    holidayDate: new Date(`${DATE}T00:00:00.000Z`),
    reason: 'Sports day',
  };
  const restoreAcademicYear = replaceMethod(prisma.academicYear, 'findFirst', (async () => ({ id: ACADEMIC_SESSION_ID })) as any);
  const restoreClass = replaceMethod(prisma.class, 'findFirst', (async () => ({ id: CLASS_ID })) as any);
  const restoreSection = replaceMethod(prisma.section, 'findFirst', (async () => ({ id: SECTION_ID })) as any);
  const restoreClassSection = replaceMethod(prisma.classSection, 'findFirst', (async () => ({ id: 'class-section-1' })) as any);
  const restoreStudents = replaceMethod(prisma.student, 'findMany', (async () => [
    { id: STUDENT_ID, admissionNo: 'ADM-1', rollNo: '7', fullName: 'Asha Rao', firstName: 'Asha', lastName: 'Rao' },
  ]) as any);
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async (params: any) => {
    assert.equal(params.source, 'session-attendance');
    return [
      canonicalStudentRecord({
        source: 'session-attendance',
        sourceId: 'sr-1',
        academicSessionId: ACADEMIC_SESSION_ID,
        status: 'HALF_DAY',
        note: 'Left early',
      }),
    ];
  }) as any);
  const restoreHoliday = replaceMethod(attendanceReadService, 'getStudentAttendanceHoliday', (async () => holiday) as any);
  const res = response();

  try {
    await loadStudentAttendance(
      {
        auth: { userId: USER_ID, schoolId: SCHOOL_ID },
        query: { academicSessionId: ACADEMIC_SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, date: DATE },
      } as any,
      res as any,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      date: DATE,
      holiday,
      students: [
        {
          id: STUDENT_ID,
          admissionNo: 'ADM-1',
          rollNo: '7',
          fullName: 'Asha Rao',
          firstName: 'Asha',
          lastName: 'Rao',
          status: 'HALF_DAY',
          note: 'Left early',
          attendanceId: 'sr-1',
        },
      ],
    });
  } finally {
    restoreAcademicYear();
    restoreClass();
    restoreSection();
    restoreClassSection();
    restoreStudents();
    restoreRead();
    restoreHoliday();
  }
});

test('student attendance monthly report preserves holiday totals and daily rows through AttendanceReadService', async () => {
  const holiday = {
    id: 'holiday-1',
    schoolId: SCHOOL_ID,
    academicSessionId: ACADEMIC_SESSION_ID,
    classId: CLASS_ID,
    sectionId: SECTION_ID,
    holidayDate: new Date('2026-02-02T00:00:00.000Z'),
    reason: 'Founders day',
  };
  const restoreAcademicYear = replaceMethod(prisma.academicYear, 'findFirst', (async () => ({ id: ACADEMIC_SESSION_ID })) as any);
  const restoreClass = replaceMethod(prisma.class, 'findFirst', (async () => ({ id: CLASS_ID })) as any);
  const restoreSection = replaceMethod(prisma.section, 'findFirst', (async () => ({ id: SECTION_ID })) as any);
  const restoreClassSection = replaceMethod(prisma.classSection, 'findFirst', (async () => ({ id: 'class-section-1' })) as any);
  const restoreStudents = replaceMethod(prisma.student, 'findMany', (async () => [
    { id: STUDENT_ID, admissionNo: 'ADM-1', rollNo: '7', fullName: null, firstName: 'Asha', lastName: 'Rao' },
  ]) as any);
  const restoreRead = replaceMethod(attendanceReadService, 'getStudentAttendance', (async (params: any) => {
    assert.equal(params.source, 'session-attendance');
    return [
      canonicalStudentRecord({
        source: 'session-attendance',
        sourceId: 'sr-1',
        academicSessionId: ACADEMIC_SESSION_ID,
        date: '2026-02-01',
        status: 'PRESENT',
      }),
      canonicalStudentRecord({
        source: 'session-attendance',
        sourceId: 'sr-2',
        academicSessionId: ACADEMIC_SESSION_ID,
        date: '2026-02-03',
        status: 'ABSENT',
        note: 'Sick',
      }),
    ];
  }) as any);
  const restoreHolidays = replaceMethod(attendanceReadService, 'getStudentAttendanceHolidays', (async () => [holiday]) as any);
  const res = response();

  try {
    await getStudentAttendanceReport(
      {
        auth: { userId: USER_ID, schoolId: SCHOOL_ID },
        query: { academicSessionId: ACADEMIC_SESSION_ID, classId: CLASS_ID, sectionId: SECTION_ID, month: '2', year: '2026' },
      } as any,
      res as any,
    );

    assert.equal(res.statusCode, 200);
    const body = res.body as any;
    assert.equal(body.daysInMonth, 28);
    assert.deepEqual(body.holidays, [holiday]);
    assert.equal(body.rows[0].studentName, 'Asha Rao');
    assert.equal(body.rows[0].present, 1);
    assert.equal(body.rows[0].absent, 1);
    assert.equal(body.rows[0].holiday, 1);
    assert.deepEqual(body.rows[0].daily.slice(0, 3), [
      { day: 1, status: 'PRESENT', note: null },
      { day: 2, status: 'HOLIDAY' },
      { day: 3, status: 'ABSENT', note: 'Sick' },
    ]);
  } finally {
    restoreAcademicYear();
    restoreClass();
    restoreSection();
    restoreClassSection();
    restoreStudents();
    restoreRead();
    restoreHolidays();
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

  const res = response();

  try {
    await getParentAttendance({ auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: { month: '2026-02' } } as any, res as any);

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

test('staff attendance load preserves holiday and row payload through AttendanceReadService', async () => {
  const holiday = {
    id: 'staff-holiday-1',
    schoolId: SCHOOL_ID,
    roleName: 'TEACHER',
    holidayDate: new Date(`${DATE}T00:00:00.000Z`),
    reason: 'Training',
  };
  const restoreStaff = replaceMethod(prisma.teacherProfile, 'findMany', (async () => [
    {
      id: STAFF_ID,
      employeeNo: 'EMP-1',
      firstName: 'Riya',
      lastName: 'Sharma',
      user: { id: USER_ID, email: 'riya@example.com', status: 'ACTIVE', roles: [{ role: { name: 'TEACHER' } }] },
      bankDetails: null,
      leaveBalances: [],
    },
  ]) as any);
  const restoreRead = replaceMethod(attendanceReadService, 'getTeacherAttendance', (async () => ({
    schoolId: SCHOOL_ID,
    source: 'staff-attendance',
    fromDate: DATE,
    toDate: DATE,
    totalRecords: 1,
    present: 1,
    absent: 0,
    late: 0,
    halfDay: 0,
    leave: 0,
    holiday: 0,
    records: [{ source: 'staff-attendance', sourceId: 'st-1', schoolId: SCHOOL_ID, teacherId: STAFF_ID, date: DATE, status: 'PRESENT', note: 'On time' }],
  })) as any);
  const restoreHoliday = replaceMethod(attendanceReadService, 'getStaffAttendanceHoliday', (async () => holiday) as any);
  const res = response();

  try {
    await loadStaffAttendance(
      { auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: { role: 'TEACHER', date: DATE } } as any,
      res as any,
    );

    assert.equal(res.statusCode, 200);
    const body = res.body as any;
    assert.equal(body.date, DATE);
    assert.deepEqual(body.holiday, holiday);
    assert.equal(body.staff[0].status, 'PRESENT');
    assert.equal(body.staff[0].note, 'On time');
    assert.equal(body.staff[0].attendanceId, 'st-1');
    assert.equal(body.staff[0].staffNo, 'EMP-1');
  } finally {
    restoreStaff();
    restoreRead();
    restoreHoliday();
  }
});

test('staff attendance report preserves holiday totals and daily rows through AttendanceReadService', async () => {
  const holiday = {
    id: 'staff-holiday-1',
    schoolId: SCHOOL_ID,
    roleName: 'TEACHER',
    holidayDate: new Date('2026-02-02T00:00:00.000Z'),
    reason: 'Training',
  };
  const restoreStaff = replaceMethod(prisma.teacherProfile, 'findMany', (async () => [
    {
      id: STAFF_ID,
      employeeNo: 'EMP-1',
      firstName: 'Riya',
      lastName: 'Sharma',
      user: { id: USER_ID, email: 'riya@example.com', status: 'ACTIVE', roles: [{ role: { name: 'TEACHER' } }] },
      bankDetails: null,
      leaveBalances: [],
    },
  ]) as any);
  const restoreRead = replaceMethod(attendanceReadService, 'getTeacherAttendance', (async () => ({
    schoolId: SCHOOL_ID,
    source: 'staff-attendance',
    fromDate: '2026-02-01',
    toDate: '2026-02-28',
    totalRecords: 2,
    present: 1,
    absent: 1,
    late: 0,
    halfDay: 0,
    leave: 0,
    holiday: 0,
    records: [
      { source: 'staff-attendance', sourceId: 'st-1', schoolId: SCHOOL_ID, teacherId: STAFF_ID, date: '2026-02-01', status: 'PRESENT', note: null },
      { source: 'staff-attendance', sourceId: 'st-2', schoolId: SCHOOL_ID, teacherId: STAFF_ID, date: '2026-02-03', status: 'ABSENT', note: 'Sick' },
    ],
  })) as any);
  const restoreHolidays = replaceMethod(attendanceReadService, 'getStaffAttendanceHolidays', (async () => [holiday]) as any);
  const res = response();

  try {
    await getStaffAttendanceReport(
      { auth: { userId: USER_ID, schoolId: SCHOOL_ID }, query: { role: 'TEACHER', month: '2', year: '2026' } } as any,
      res as any,
    );

    assert.equal(res.statusCode, 200);
    const body = res.body as any;
    assert.equal(body.daysInMonth, 28);
    assert.equal(body.rows[0].present, 1);
    assert.equal(body.rows[0].absent, 1);
    assert.equal(body.rows[0].holiday, 1);
    assert.deepEqual(body.rows[0].daily.slice(0, 3), [
      { day: 1, status: 'PRESENT', note: null },
      { day: 2, status: 'HOLIDAY' },
      { day: 3, status: 'ABSENT', note: 'Sick' },
    ]);
  } finally {
    restoreStaff();
    restoreRead();
    restoreHolidays();
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
  const res = response();

  try {
    await listSessionRecords(
      { auth: { userId: USER_ID, schoolId: SCHOOL_ID }, params: { sessionId: SESSION_ID }, query: { schoolId: SCHOOL_ID } } as any,
      res as any,
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [rawRecord]);
  } finally {
    restoreSession();
    restoreRecords();
  }
});
