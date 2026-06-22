import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/permissions/permission_codes.dart';
import 'package:school_flutter/features/attendance/domain/entities/attendance_summary.dart';
import 'package:school_flutter/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:school_flutter/features/auth/domain/entities/auth_session.dart';
import 'package:school_flutter/features/auth/domain/entities/staff_user.dart';
import 'package:school_flutter/features/auth/domain/repositories/auth_repository.dart';
import 'package:school_flutter/features/classes/domain/entities/class_assignment.dart';
import 'package:school_flutter/features/classes/domain/repositories/class_assignment_repository.dart';
import 'package:school_flutter/features/dashboard/data/datasources/dashboard_remote_datasource.dart';
import 'package:school_flutter/features/dashboard/data/repositories/dashboard_repository_impl.dart';
import 'package:school_flutter/features/exams/domain/entities/exam.dart';
import 'package:school_flutter/features/exams/domain/repositories/exam_repository.dart';
import 'package:school_flutter/features/homework/domain/entities/homework.dart';
import 'package:school_flutter/features/homework/domain/repositories/homework_repository.dart';
import 'package:school_flutter/features/leave/domain/entities/leave_entities.dart';
import 'package:school_flutter/features/leave/domain/repositories/leave_repository.dart';
import 'package:school_flutter/features/marks/domain/entities/marks.dart';
import 'package:school_flutter/features/marks/domain/repositories/marks_repository.dart';
import 'package:school_flutter/features/notices/domain/entities/notice.dart';
import 'package:school_flutter/features/notices/domain/repositories/notice_repository.dart';
import 'package:school_flutter/features/notifications/domain/entities/staff_notification.dart';
import 'package:school_flutter/features/notifications/domain/repositories/notification_repository.dart';
import 'package:school_flutter/features/timetable/domain/entities/timetable_entry.dart';
import 'package:school_flutter/features/timetable/domain/repositories/timetable_repository.dart';

void main() {
  test(
    'dashboard loads attendance card only when attendance is visible',
    () async {
      final fixture = _DashboardFixture({
        PermissionCodes.attendanceView,
        PermissionCodes.attendanceCreate,
      });

      final snapshot = await fixture.repository.getDashboard();

      expect(
        snapshot.cards.map((card) => card.title),
        contains('Today attendance'),
      );
      expect(
        snapshot.cards.map((card) => card.title),
        isNot(contains('Today timetable')),
      );
      expect(fixture.attendance.calls, 1);
      expect(fixture.timetable.calls, 0);
    },
  );

  test(
    'dashboard loads timetable card only when timetable is visible',
    () async {
      final fixture = _DashboardFixture({PermissionCodes.timetableView});

      final snapshot = await fixture.repository.getDashboard();

      expect(
        snapshot.cards.map((card) => card.title),
        contains('Today timetable'),
      );
      expect(
        snapshot.cards.map((card) => card.title),
        isNot(contains('Attendance records')),
      );
      expect(fixture.attendance.calls, 0);
      expect(fixture.timetable.calls, 1);
    },
  );

  test('dashboard exposes fee card for finance permissions', () async {
    final fixture = _DashboardFixture({PermissionCodes.feesView});

    final snapshot = await fixture.repository.getDashboard();

    expect(snapshot.cards.map((card) => card.title), contains('Fee metrics'));
    expect(
      snapshot.cards.map((card) => card.title),
      isNot(contains('Staff overview')),
    );
  });

  test('dashboard exposes staff overview for HR permissions', () async {
    final fixture = _DashboardFixture({PermissionCodes.staffView});

    final snapshot = await fixture.repository.getDashboard();

    expect(
      snapshot.cards.map((card) => card.title),
      contains('Staff overview'),
    );
    expect(
      snapshot.cards.map((card) => card.title),
      isNot(contains('Fee metrics')),
    );
  });

  test('dashboard does not use role labels to choose cards', () async {
    final fixture = _DashboardFixture({
      PermissionCodes.libraryView,
    }, role: 'ACCOUNTANT');

    final snapshot = await fixture.repository.getDashboard();

    expect(snapshot.user.role, 'ACCOUNTANT');
    expect(
      snapshot.cards.map((card) => card.title),
      isNot(contains('Fee metrics')),
    );
  });
}

class _DashboardFixture {
  _DashboardFixture(Set<String> permissions, {String role = 'STAFF'})
    : attendance = _CountingAttendanceRepository(),
      timetable = _CountingTimetableRepository() {
    repository = DashboardRepositoryImpl(
      DashboardRemoteDatasource(
        authRepository: _FakeAuthRepository(
          StaffUser(
            id: 'user-1',
            email: 'staff@example.com',
            displayName: 'Staff User',
            role: role,
            permissionCodes: permissions,
          ),
        ),
        attendanceRepository: attendance,
        timetableRepository: timetable,
        notificationRepository: _FakeNotificationRepository(),
        leaveRepository: _FakeLeaveRepository(),
        noticeRepository: _FakeNoticeRepository(),
        classAssignmentRepository: _FakeClassAssignmentRepository(),
        homeworkRepository: _FakeHomeworkRepository(),
        examRepository: _FakeExamRepository(),
        marksRepository: _FakeMarksRepository(),
      ),
    );
  }

  final _CountingAttendanceRepository attendance;
  final _CountingTimetableRepository timetable;
  late final DashboardRepositoryImpl repository;
}

class _FakeAuthRepository implements AuthRepository {
  const _FakeAuthRepository(this.user);

  final StaffUser user;

  @override
  Future<AuthSession> restoreSession() async => AuthSession.authenticated(user);

  @override
  Future<AuthSession> login({
    required String identifier,
    required String password,
    String? schoolCode,
    bool rememberMe = false,
  }) async => AuthSession.authenticated(user);

  @override
  Future<AuthSession> verifyMfa({
    required String challengeId,
    required String code,
    bool rememberMe = false,
  }) async => AuthSession.authenticated(user);

  @override
  Future<void> logout() async {}

  @override
  Future<void> requestPasswordReset({
    required String email,
    String? schoolCode,
  }) async {}

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {}
}

class _CountingAttendanceRepository implements AttendanceRepository {
  int calls = 0;

  @override
  Future<AttendanceSummary> getSummary({DateTime? date}) async {
    calls += 1;
    return const AttendanceSummary(
      totals: AttendanceTotals(
        sessions: 1,
        records: 2,
        present: 1,
        absent: 1,
        late: 0,
        halfDay: 0,
      ),
      sessions: [],
    );
  }

  @override
  Future<List<TeacherAttendanceRecord>> getTeacherHistory({
    DateTime? fromDate,
    DateTime? toDate,
  }) async => const [];

  @override
  Future<TeacherAttendanceRecord> markSelfAttendance({
    required String status,
    DateTime? date,
  }) async => TeacherAttendanceRecord(
    id: 'record-1',
    date: DateTime(2026),
    status: status,
  );

  @override
  Future<StudentAttendanceOptions> getStudentAttendanceOptions() async =>
      const StudentAttendanceOptions(
        academicYears: [],
        classes: [],
        sections: [],
      );

  @override
  Future<StudentAttendanceSheet> loadStudentAttendance(
    StudentAttendanceQuery query,
  ) async => StudentAttendanceSheet(date: query.date, students: const []);

  @override
  Future<void> saveStudentAttendance(
    StudentAttendanceSaveRequest request,
  ) async {}

  @override
  Future<AttendanceConfiguration> getResolvedAttendanceConfig(
    AttendanceScopeQuery query,
  ) async => const AttendanceConfiguration(
    id: null,
    mode: AttendanceMode.daily,
    source: 'DEFAULT',
  );

  @override
  Future<List<AttendanceUnit>> getAttendanceUnits(
    AttendanceScopeQuery query,
  ) async => const [
    AttendanceUnit(
      unitType: AttendanceUnitType.day,
      label: 'Day',
      source: 'DAY',
    ),
  ];

  @override
  Future<AttendanceSheet> getAttendanceSheet(
    AttendanceSheetQuery query,
  ) async => AttendanceSheet(
    configuration: const AttendanceConfiguration(
      id: null,
      mode: AttendanceMode.daily,
      source: 'DEFAULT',
    ),
    unit: query.unit,
    rows: const [],
  );

  @override
  Future<AttendanceSheet> saveAttendanceSheet(
    AttendanceSheetSaveRequest request,
  ) async => getAttendanceSheet(request.query);

  @override
  Future<AttendanceSheetSession> lockAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async => AttendanceSheetSession(
    id: sessionId,
    status: 'CLOSED',
    approvalStatus: 'PENDING',
    lockedAt: DateTime(2026),
    lockReason: reason,
  );

  @override
  Future<AttendanceSheetSession> reopenAttendanceSheet({
    required String sessionId,
    String? reason,
  }) async => AttendanceSheetSession(
    id: sessionId,
    status: 'OPEN',
    approvalStatus: 'PENDING',
  );

  @override
  Future<List<AttendanceConfiguration>> listAttendanceConfigurations({
    String? academicYearId,
    String? classId,
    String? sectionId,
    bool? active,
  }) async => const [];
}

class _CountingTimetableRepository implements TimetableRepository {
  int calls = 0;

  @override
  Future<TeacherTimetable> getTeacherTimetable({DateTime? date}) async {
    calls += 1;
    return TeacherTimetable(
      date: date ?? DateTime(2026),
      dayOfWeek: 1,
      entries: const [
        TimetableEntry(
          id: 'entry-1',
          timetableVersionId: 'version-1',
          dayOfWeek: 1,
          className: 'Grade 8',
          subjectName: 'Science',
          teacherName: 'Staff User',
          period: AttendancePeriod(
            id: 'period-1',
            name: 'Period 1',
            type: 'CLASS_TIME',
            startTime: '09:00',
            endTime: '09:45',
          ),
        ),
      ],
    );
  }
}

class _FakeNotificationRepository implements NotificationRepository {
  @override
  Future<NotificationCenterState> getNotificationCenter() async {
    return const NotificationCenterState(
      items: [
        StaffNotification(
          id: 'n1',
          title: 'Alert',
          type: 'info',
          isRead: false,
        ),
      ],
    );
  }

  @override
  Future<void> markAllAsRead() async {}

  @override
  Future<void> markAsRead(String id) async {}
}

class _FakeLeaveRepository implements LeaveRepository {
  @override
  Future<LeaveHomeData> getHomeData() async =>
      const LeaveHomeData(balances: [], types: [], applications: []);

  @override
  Future<List<LeaveApplication>> getApplications() async => const [];

  @override
  Future<LeaveApplication> getApplication(String id) async {
    throw UnimplementedError();
  }

  @override
  Future<List<LeaveBalance>> getBalances() async => const [];

  @override
  Future<List<LeaveType>> getTypes() async => const [];

  @override
  Future<void> cancelApplication(String id) async {}

  @override
  Future<LeaveApplication> submitApplication({
    required String leaveTypeId,
    required DateTime fromDate,
    required DateTime toDate,
    required String reason,
  }) async {
    return LeaveApplication(
      id: 'leave-1',
      leaveTypeId: leaveTypeId,
      fromDate: fromDate,
      toDate: toDate,
      reason: reason,
      status: 'PENDING',
      durationDays: 1,
    );
  }
}

class _FakeNoticeRepository implements NoticeRepository {
  @override
  Future<NoticeBoardState> getNoticeBoard() async =>
      const NoticeBoardState(notices: []);

  @override
  Future<void> markRead(String id) async {}
}

class _FakeClassAssignmentRepository implements ClassAssignmentRepository {
  @override
  Future<ClassAssignments> getAssignments() async =>
      const ClassAssignments(classes: [], sections: [], subjects: []);
}

class _FakeHomeworkRepository implements HomeworkRepository {
  @override
  Future<List<Homework>> list({String? classId, String? sectionId}) async =>
      const [];

  @override
  Future<Homework> create(HomeworkDraft draft) async {
    throw UnimplementedError();
  }

  @override
  Future<void> delete(String id) async {}

  @override
  Future<Homework> update(String id, HomeworkDraft draft) async {
    throw UnimplementedError();
  }
}

class _FakeExamRepository implements ExamRepository {
  @override
  Future<ExamHomeData> getHomeData() async =>
      const ExamHomeData(exams: [], assignedPapers: [], duties: []);

  @override
  Future<Exam> getExam(String id) async {
    throw UnimplementedError();
  }

  @override
  Future<List<ExamPaper>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async => const [];

  @override
  Future<List<Exam>> listExams() async => const [];

  @override
  Future<List<ExamDuty>> listMyDuties() async => const [];
}

class _FakeMarksRepository implements MarksRepository {
  @override
  Future<MarksSummary> getSummary(ExamPaper paper) async =>
      MarksSummary(paper: paper, records: const []);

  @override
  Future<List<MarkRecord>> listMarks(String examPaperId) async => const [];

  @override
  Future<List<AssignedStudent>> listStudents({
    String? classId,
    String? sectionId,
  }) async => const [];

  @override
  Future<List<ExamPaper>> listTasks({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async => const [];

  @override
  Future<MarksUploadResult> submitMarks(MarksDraft draft) async =>
      const MarksUploadResult(results: []);
}
