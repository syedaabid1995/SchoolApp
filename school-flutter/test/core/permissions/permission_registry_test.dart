import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/permissions/permission_checker.dart';
import 'package:school_flutter/core/permissions/permission_codes.dart';
import 'package:school_flutter/core/permissions/permission_registry.dart';

void main() {
  test('module registry defines required staff app modules', () {
    final ids = PermissionRegistry.modules.map((module) => module.id).toSet();

    expect(
      ids,
      containsAll({
        'dashboard',
        'attendance',
        'timetable',
        'notifications',
        'profile',
        'settings',
        'homework',
        'exams',
        'library',
        'transport',
        'payroll',
        'hr',
      }),
    );
  });

  test('moduleForRoute matches nested paths', () {
    final module = PermissionRegistry.moduleForRoute('/attendance/detail/1');

    expect(module?.id, 'attendance');
  });

  test('teacher-like permissions produce attendance and timetable menu', () {
    const checker = PermissionChecker({
      PermissionCodes.attendanceView,
      PermissionCodes.attendanceCreate,
      PermissionCodes.timetableView,
    });
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, containsAll(['dashboard', 'attendance', 'timetable']));
    expect(modules, isNot(contains('fees')));
  });

  test('accounting permissions produce finance menu without attendance', () {
    const checker = PermissionChecker({
      PermissionCodes.feesView,
      PermissionCodes.feesCollect,
      PermissionCodes.reportsFeesView,
    });
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, containsAll(['dashboard', 'fees', 'reports']));
    expect(modules, isNot(contains('attendance')));
    expect(modules, isNot(contains('library')));
  });

  test('library permissions produce library menu only for that domain', () {
    const checker = PermissionChecker({PermissionCodes.libraryView});
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, contains('library'));
    expect(modules, isNot(contains('fees')));
    expect(modules, isNot(contains('payroll')));
  });

  test('principal-like broad permissions produce operational modules', () {
    const checker = PermissionChecker({
      PermissionCodes.attendanceReport,
      PermissionCodes.staffAttendanceView,
      PermissionCodes.reportsView,
      PermissionCodes.dashboardOverview,
    });
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, containsAll(['attendance', 'reports', 'hr', 'timetable']));
  });

  test('profile settings and notifications are authenticated modules', () {
    const checker = PermissionChecker({});
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, containsAll(['dashboard', 'profile', 'settings']));
    expect(modules, contains('notifications'));
  });

  test('action registry exposes high-risk actions', () {
    expect(
      PermissionRegistry.actionForId(
        PermissionActionIds.generateTimetable,
      )?.requiredPermissions,
      contains(PermissionCodes.academicRoutineCreate),
    );
    expect(
      PermissionRegistry.actionForId(
        PermissionActionIds.publishTimetable,
      )?.requiredPermissions,
      contains(PermissionCodes.academicRoutineEdit),
    );
  });
}
