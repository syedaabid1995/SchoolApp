import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_checker.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_codes.dart';
import 'package:school_flutter/global_ui/core/permissions/permission_registry.dart';
import 'package:school_flutter/global_ui/features/notices/domain/entities/notice.dart';

void main() {
  group('NoticeBoardState communication filters', () {
    const notices = NoticeBoardState(
      notices: [
        Notice(
          id: 'notice-1',
          title: 'Exam schedule published',
          category: 'Announcement',
          message: 'Final exam starts Monday',
          isRead: false,
        ),
        Notice(
          id: 'notice-2',
          title: 'Fee reminder',
          category: 'Important',
          message: 'Collection closes Friday',
          isRead: true,
        ),
        Notice(
          id: 'notice-3',
          title: 'Sports day',
          category: 'General',
          message: 'Bring house uniforms',
          isRead: false,
        ),
      ],
    );

    test('counts unread notices', () {
      expect(notices.unreadCount, 2);
    });

    test('filters categories case-insensitively', () {
      final important = notices.category('important');

      expect(important, hasLength(1));
      expect(important.single.title, 'Fee reminder');
    });

    test('searches notice titles', () {
      final results = notices.search('exam');

      expect(results.single.id, 'notice-1');
    });

    test('searches notice messages', () {
      final results = notices.search('uniforms');

      expect(results.single.id, 'notice-3');
    });

    test('searches notice categories', () {
      final results = notices.search('general');

      expect(results.single.id, 'notice-3');
    });

    test('empty search returns all notices', () {
      expect(notices.search('   '), hasLength(3));
    });
  });

  group('permission-driven quick actions', () {
    test('attendance create permission enables mark attendance action', () {
      const checker = PermissionChecker({PermissionCodes.attendanceCreate});

      expect(
        checker.canPerformAction(PermissionActionIds.markAttendance),
        isTrue,
      );
    });

    test('staff attendance create permission also enables mark action', () {
      const checker = PermissionChecker({
        PermissionCodes.staffAttendanceCreate,
      });

      expect(
        checker.canPerformAction(PermissionActionIds.markAttendance),
        isTrue,
      );
    });

    test('missing attendance permissions hide mark action', () {
      const checker = PermissionChecker({PermissionCodes.attendanceView});

      expect(
        checker.canPerformAction(PermissionActionIds.markAttendance),
        isFalse,
      );
    });

    test('leave create permission enables apply leave action', () {
      const checker = PermissionChecker({PermissionCodes.leaveApplyCreate});

      expect(
        checker.canPerformAction(PermissionActionIds.requestLeave),
        isTrue,
      );
    });

    test('homework create permission enables add homework action', () {
      const checker = PermissionChecker({PermissionCodes.homeworkCreate});

      expect(
        checker.canPerformAction(PermissionActionIds.createHomework),
        isTrue,
      );
    });

    test('marks permission enables enter marks action', () {
      const checker = PermissionChecker({PermissionCodes.academicsMarks});

      expect(checker.canPerformAction(PermissionActionIds.enterMarks), isTrue);
    });

    test('unknown action is never visible', () {
      const checker = PermissionChecker({PermissionCodes.dashboardOverview});

      expect(checker.canPerformAction('unknown.action'), isFalse);
    });
  });

  group('permission-driven module access', () {
    test('teacher-style permissions expose operational modules', () {
      const checker = PermissionChecker({
        PermissionCodes.dashboardOverview,
        PermissionCodes.attendanceView,
        PermissionCodes.timetableView,
        PermissionCodes.homeworkView,
        PermissionCodes.leaveApplyView,
        PermissionCodes.leaveBalanceView,
        PermissionCodes.academicsExams,
        PermissionCodes.academicsMarks,
      });

      final ids = checker.visibleModules().map((module) => module.id).toSet();

      expect(
        ids,
        containsAll(['dashboard', 'student-attendance', 'timetable']),
      );
      expect(ids, containsAll(['homework', 'leave', 'exams', 'marks']));
      expect(ids, isNot(contains('fees')));
    });

    test('accounting permissions expose finance modules only', () {
      const checker = PermissionChecker({
        PermissionCodes.feesView,
        PermissionCodes.feesCollect,
        PermissionCodes.reportsFeesView,
      });

      final ids = checker.visibleModules().map((module) => module.id).toSet();

      expect(ids, contains('fees'));
      expect(ids, contains('reports'));
      expect(ids, isNot(contains('attendance')));
      expect(ids, isNot(contains('homework')));
    });

    test('profile and settings remain visible without role assumptions', () {
      const checker = PermissionChecker({});

      final ids = checker.visibleModules().map((module) => module.id).toSet();

      expect(ids, containsAll(['dashboard', 'notices', 'profile', 'settings']));
    });

    test('nested routes resolve through their parent module permission', () {
      const checker = PermissionChecker({PermissionCodes.homeworkView});

      expect(checker.canAccessRoute('/homework/detail/homework-1'), isTrue);
      expect(checker.canAccessRoute('/marks/entry/paper-1'), isFalse);
    });

    test('unknown routes are allowed for router fallback handling', () {
      const checker = PermissionChecker({});

      expect(checker.canAccessRoute('/unknown-route'), isTrue);
    });

    test('missing permission message names required route permissions', () {
      const checker = PermissionChecker({});

      final missing = checker.missingPermissionForRoute('/attendance/history');

      expect(missing, contains(PermissionCodes.attendanceView));
    });

    test('available route has no missing permission', () {
      const checker = PermissionChecker({PermissionCodes.timetableView});

      expect(checker.missingPermissionForRoute('/timetable/today'), isNull);
    });
  });
}
