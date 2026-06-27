import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive/hive.dart';
import 'package:school_flutter/global_ui/core/storage/hive_cache_service.dart';
import 'package:school_flutter/global_ui/features/attendance/data/datasources/attendance_remote_datasource.dart';
import 'package:school_flutter/global_ui/features/attendance/data/models/attendance_summary_model.dart';
import 'package:school_flutter/global_ui/features/attendance/data/repositories/attendance_repository_impl.dart';
import 'package:school_flutter/global_ui/features/attendance/domain/entities/attendance_summary.dart';
import 'package:school_flutter/global_ui/features/attendance/domain/repositories/attendance_repository.dart';
import 'package:school_flutter/global_ui/features/attendance/presentation/providers/attendance_providers.dart';
import 'package:school_flutter/global_ui/features/dashboard/domain/entities/dashboard_snapshot.dart';
import 'package:school_flutter/global_ui/features/dashboard/domain/repositories/dashboard_repository.dart';
import 'package:school_flutter/global_ui/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:school_flutter/global_ui/features/exams/data/datasources/exam_remote_datasource.dart';
import 'package:school_flutter/global_ui/features/exams/data/models/exam_models.dart';
import 'package:school_flutter/global_ui/features/exams/data/repositories/exam_repository_impl.dart';
import 'package:school_flutter/global_ui/features/notifications/domain/entities/staff_notification.dart';
import 'package:school_flutter/global_ui/features/notifications/domain/repositories/notification_repository.dart';
import 'package:school_flutter/global_ui/features/notifications/presentation/providers/notification_providers.dart';
import 'package:school_flutter/global_ui/features/leave/data/datasources/leave_remote_datasource.dart';
import 'package:school_flutter/global_ui/features/leave/data/models/leave_models.dart';
import 'package:school_flutter/global_ui/features/leave/data/repositories/leave_repository_impl.dart';
import 'package:school_flutter/global_ui/features/timetable/data/datasources/timetable_remote_datasource.dart';
import 'package:school_flutter/global_ui/features/timetable/data/models/timetable_model.dart';
import 'package:school_flutter/global_ui/features/timetable/data/repositories/timetable_repository_impl.dart';
import 'package:school_flutter/global_ui/features/timetable/domain/entities/timetable_entry.dart';
import 'package:school_flutter/global_ui/features/timetable/domain/repositories/timetable_repository.dart';
import 'package:school_flutter/global_ui/features/timetable/presentation/providers/timetable_providers.dart';
import 'package:school_flutter/global_ui/features/auth/domain/entities/staff_user.dart';

void main() {
  late Directory hiveDir;
  late Box<dynamic> cacheBox;

  setUpAll(() async {
    hiveDir = Directory.systemTemp.createTempSync('staff_repo_provider_');
    Hive.init(hiveDir.path);
    cacheBox = await Hive.openBox<dynamic>('repository_provider_cache');
  });

  setUp(() async {
    await cacheBox.clear();
  });

  tearDownAll(() async {
    await Hive.close();
    if (hiveDir.existsSync()) {
      hiveDir.deleteSync(recursive: true);
    }
  });

  test('AttendanceRepository delegates summary loading', () async {
    final repository = AttendanceRepositoryImpl(
      _FakeAttendanceRemoteDatasource(),
    );

    final summary = await repository.getSummary();

    expect(summary.totals.records, 10);
  });

  test('AttendanceRepository delegates self-attendance marking', () async {
    final repository = AttendanceRepositoryImpl(
      _FakeAttendanceRemoteDatasource(),
    );

    final record = await repository.markSelfAttendance(status: 'PRESENT');

    expect(record.status, 'PRESENT');
  });

  test('TimetableRepository delegates teacher timetable loading', () async {
    final repository = TimetableRepositoryImpl(
      _FakeTimetableRemoteDatasource(),
    );

    final timetable = await repository.getTeacherTimetable();

    expect(timetable.entries.single.subjectName, 'Science');
  });

  test(
    'TimetableRepository returns empty timetable for missing teacher profile',
    () async {
      final repository = TimetableRepositoryImpl(
        _MissingTeacherTimetableRemoteDatasource(),
      );

      final timetable = await repository.getTeacherTimetable(
        date: DateTime.utc(2026, 6, 14),
      );

      expect(timetable.entries, isEmpty);
      expect(timetable.dayOfWeek, 7);
    },
  );

  test(
    'LeaveRepository treats missing staff profile as empty optional data',
    () async {
      final repository = LeaveRepositoryImpl(
        remote: _MissingStaffLeaveRemoteDatasource(),
        cache: HiveCacheService(cacheBox),
      );

      final home = await repository.getHomeData();

      expect(home.balances, isEmpty);
      expect(home.types.single.name, 'Casual Leave');
      expect(home.applications, isEmpty);
    },
  );

  test(
    'ExamRepository treats missing teacher assignment scope as empty papers',
    () async {
      final repository = ExamRepositoryImpl(
        remote: _MissingTeacherExamRemoteDatasource(),
        cache: HiveCacheService(cacheBox),
      );

      final papers = await repository.listAssignedPapers();

      expect(papers, isEmpty);
    },
  );

  test('attendanceSummaryProvider reads repository override', () async {
    final container = ProviderContainer(
      overrides: [
        attendanceRepositoryProvider.overrideWithValue(
          _FakeAttendanceRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    final summary = await container.read(attendanceSummaryProvider.future);

    expect(summary.totals.sessions, 1);
  });

  test('todayTimetableProvider reads repository override', () async {
    final container = ProviderContainer(
      overrides: [
        timetableRepositoryProvider.overrideWithValue(
          _FakeTimetableRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    final timetable = await container.read(todayTimetableProvider.future);

    expect(timetable.entries.length, 1);
  });

  test('notification controller computes unread count', () async {
    final container = ProviderContainer(
      overrides: [
        notificationRepositoryProvider.overrideWithValue(
          _FakeNotificationRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    final center = await container.read(notificationCenterProvider.future);

    expect(center.unreadCount, 1);
  });

  test('dashboardProvider reads repository override', () async {
    final container = ProviderContainer(
      overrides: [
        dashboardRepositoryProvider.overrideWithValue(
          _FakeDashboardRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);

    final snapshot = await container.read(dashboardProvider.future);

    expect(snapshot.user.displayName, 'Asha Teacher');
    expect(snapshot.cards.single.value, '1');
  });
}

class _FakeAttendanceRemoteDatasource extends AttendanceRemoteDatasource {
  _FakeAttendanceRemoteDatasource() : super(Dio());

  @override
  Future<AttendanceSummaryModel> getSummary({DateTime? date}) async {
    return const AttendanceSummaryModel(
      totals: AttendanceTotals(
        sessions: 1,
        records: 10,
        present: 9,
        absent: 1,
        late: 0,
        halfDay: 0,
      ),
      sessions: [],
    );
  }

  @override
  Future<List<TeacherAttendanceRecordModel>> getTeacherHistory({
    DateTime? fromDate,
    DateTime? toDate,
  }) async {
    return [
      TeacherAttendanceRecordModel(
        id: 'teacher-record-1',
        date: DateTime(2026),
        status: 'PRESENT',
      ),
    ];
  }

  @override
  Future<TeacherAttendanceRecordModel> markSelfAttendance({
    required String status,
    DateTime? date,
    AttendanceUnit? unit,
  }) async {
    return TeacherAttendanceRecordModel(
      id: 'teacher-record-1',
      date: DateTime(2026),
      status: status,
    );
  }
}

class _FakeTimetableRemoteDatasource extends TimetableRemoteDatasource {
  _FakeTimetableRemoteDatasource() : super(Dio());

  @override
  Future<TeacherTimetableModel> getTeacherTimetable({DateTime? date}) async {
    return TeacherTimetableModel(
      date: date ?? DateTime(2026),
      dayOfWeek: 1,
      entries: const [
        TimetableEntry(
          id: 'entry-1',
          timetableVersionId: 'version-1',
          dayOfWeek: 1,
          className: 'Grade 8',
          subjectName: 'Science',
          teacherName: 'Asha',
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

class _FakeAttendanceRepository implements AttendanceRepository {
  @override
  Future<AttendanceSummary> getSummary({DateTime? date}) async {
    return const AttendanceSummary(
      totals: AttendanceTotals(
        sessions: 1,
        records: 1,
        present: 1,
        absent: 0,
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
    AttendanceUnit? unit,
  }) async {
    return TeacherAttendanceRecord(
      id: 'record-1',
      date: DateTime(2026),
      status: status,
    );
  }

  @override
  Future<SelfAttendanceOptions> getSelfAttendanceOptions({
    DateTime? date,
  }) async => const SelfAttendanceOptions(
    configuration: AttendanceConfiguration(
      id: null,
      mode: AttendanceMode.daily,
      source: 'DEFAULT',
    ),
    units: [
      AttendanceUnit(
        unitType: AttendanceUnitType.day,
        label: 'Day',
        source: 'DAY',
      ),
    ],
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

class _FakeTimetableRepository implements TimetableRepository {
  @override
  Future<TeacherTimetable> getTeacherTimetable({DateTime? date}) async {
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
          teacherName: 'Asha',
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

class _MissingTeacherTimetableRemoteDatasource
    extends TimetableRemoteDatasource {
  _MissingTeacherTimetableRemoteDatasource() : super(Dio());

  @override
  Future<TeacherTimetableModel> getTeacherTimetable({DateTime? date}) async {
    throw _dioFailure(404, 'Teacher profile not found');
  }
}

class _MissingStaffLeaveRemoteDatasource extends LeaveRemoteDatasource {
  _MissingStaffLeaveRemoteDatasource() : super(Dio());

  @override
  Future<List<LeaveBalanceModel>> getBalances() async {
    throw _dioFailure(404, 'Staff profile not found');
  }

  @override
  Future<List<LeaveTypeModel>> getTypes() async {
    return const [
      LeaveTypeModel(id: 'type-1', name: 'Casual Leave', totalDays: 12),
    ];
  }

  @override
  Future<List<LeaveApplicationModel>> getApplications({
    bool mine = true,
  }) async {
    throw _dioFailure(404, 'Staff profile not found');
  }
}

class _MissingTeacherExamRemoteDatasource extends ExamRemoteDatasource {
  _MissingTeacherExamRemoteDatasource() : super(Dio());

  @override
  Future<List<ExamPaperModel>> listAssignedPapers({
    String? examId,
    String? classId,
    String? sectionId,
    String? subjectId,
  }) async {
    throw _dioFailure(403, 'Employee profile is not assigned to this workflow');
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

class _FakeDashboardRepository implements DashboardRepository {
  @override
  Future<DashboardSnapshot> getDashboard() async {
    return DashboardSnapshot(
      user: const StaffUser(
        id: 'user-1',
        email: 'asha@example.com',
        displayName: 'Asha Teacher',
        role: 'TEACHER',
        permissionCodes: {'attendance.view'},
      ),
      cards: const [
        DashboardCard(
          title: 'Attendance',
          value: '1',
          permissionCode: 'attendance.view',
        ),
      ],
      attendanceSummary: await _FakeAttendanceRepository().getSummary(),
      todayTimetable: await _FakeTimetableRepository().getTeacherTimetable(),
      notifications: await _FakeNotificationRepository()
          .getNotificationCenter(),
    );
  }
}

DioException _dioFailure(int statusCode, String message) {
  final requestOptions = RequestOptions(path: '/test');
  return DioException(
    requestOptions: requestOptions,
    response: Response<Map<String, dynamic>>(
      requestOptions: requestOptions,
      statusCode: statusCode,
      data: {'message': message},
    ),
  );
}
