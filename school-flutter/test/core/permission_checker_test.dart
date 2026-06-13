import 'package:flutter_test/flutter_test.dart';
import 'package:school_flutter/core/permissions/permission_checker.dart';
import 'package:school_flutter/core/permissions/permission_codes.dart';
import 'package:school_flutter/core/permissions/permission_registry.dart';

void main() {
  test('PermissionChecker evaluates exact permission codes', () {
    const checker = PermissionChecker({'attendance.view', 'timetable.view'});

    expect(checker.can('attendance.view'), isTrue);
    expect(checker.can('attendance.mark'), isFalse);
    expect(checker.canAny(['attendance.mark', 'timetable.view']), isTrue);
  });

  test('hasPermission returns false for absent code', () {
    const checker = PermissionChecker({'fees.view'});

    expect(checker.hasPermission(PermissionCodes.feesView), isTrue);
    expect(checker.hasPermission(PermissionCodes.payrollView), isFalse);
  });

  test(
    'hasAnyPermission treats an empty requirement as authenticated access',
    () {
      const checker = PermissionChecker({});

      expect(checker.hasAnyPermission(const []), isTrue);
    },
  );

  test('hasAnyPermission accepts one matching permission', () {
    const checker = PermissionChecker({PermissionCodes.libraryView});

    expect(
      checker.hasAnyPermission([
        PermissionCodes.transportView,
        PermissionCodes.libraryView,
      ]),
      isTrue,
    );
  });

  test('hasAllPermissions requires every permission', () {
    const checker = PermissionChecker({
      PermissionCodes.attendanceView,
      PermissionCodes.attendanceCreate,
    });

    expect(
      checker.hasAllPermissions([
        PermissionCodes.attendanceView,
        PermissionCodes.attendanceCreate,
      ]),
      isTrue,
    );
    expect(
      checker.hasAllPermissions([
        PermissionCodes.attendanceView,
        PermissionCodes.attendanceEdit,
      ]),
      isFalse,
    );
  });

  test('dashboard is visible without module permissions', () {
    const checker = PermissionChecker({});
    final dashboard = PermissionRegistry.moduleForRoute('/dashboard')!;

    expect(checker.canAccessModule(dashboard), isTrue);
  });

  test('attendance route requires attendance-related permissions', () {
    const checker = PermissionChecker({PermissionCodes.attendanceView});

    expect(checker.canAccessRoute('/attendance'), isTrue);
    expect(checker.canAccessRoute('/attendance/history'), isTrue);
  });

  test('fees route is hidden from users without fee permissions', () {
    const checker = PermissionChecker({PermissionCodes.attendanceView});

    expect(checker.canAccessRoute('/fees'), isFalse);
    expect(checker.missingPermissionForRoute('/fees'), contains('fees.view'));
  });

  test('staff attendance permission can access attendance module', () {
    const checker = PermissionChecker({PermissionCodes.staffAttendanceView});

    expect(checker.canAccessRoute('/attendance'), isTrue);
  });

  test('mark attendance action requires mutation permissions', () {
    const viewer = PermissionChecker({PermissionCodes.attendanceView});
    const marker = PermissionChecker({PermissionCodes.attendanceCreate});

    expect(
      viewer.canPerformAction(PermissionActionIds.markAttendance),
      isFalse,
    );
    expect(marker.canPerformAction(PermissionActionIds.markAttendance), isTrue);
  });

  test('unknown actions are denied', () {
    const checker = PermissionChecker({PermissionCodes.dashboardOverview});

    expect(checker.canPerformAction('unknown.action'), isFalse);
  });

  test('visibleModules filters modules by permissions', () {
    const checker = PermissionChecker({
      PermissionCodes.feesView,
      PermissionCodes.libraryView,
    });
    final modules = checker.visibleModules().map((module) => module.id);

    expect(modules, containsAll(['dashboard', 'fees', 'library', 'profile']));
    expect(modules, isNot(contains('attendance')));
    expect(modules, isNot(contains('payroll')));
  });
}
